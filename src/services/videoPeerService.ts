import Peer, { type MediaConnection } from "peerjs";

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalised = value.trim().toLowerCase();
  if (normalised === "true") return true;
  if (normalised === "false") return false;
  return fallback;
};

const parsePort = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const host =
  import.meta.env.VITE_PEER_HOST ||
  import.meta.env.VITE_PEERJS_HOST_VIDEO ||
  import.meta.env.VITE_PEERJS_HOST ||
  "localhost";

const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(host);

const secure = parseBoolean(
  import.meta.env.VITE_PEER_SECURE ||
    import.meta.env.VITE_PEERJS_SECURE_VIDEO ||
    import.meta.env.VITE_PEERJS_SECURE,
  !isLocalHost
);

const port = parsePort(
  import.meta.env.VITE_PEER_PORT ||
    import.meta.env.VITE_PEERJS_PORT_VIDEO ||
    import.meta.env.VITE_PEERJS_PORT,
  isLocalHost ? 3003 : secure ? 443 : 80
);

const path =
  import.meta.env.VITE_PEER_PATH ||
  import.meta.env.VITE_PEERJS_PATH_VIDEO ||
  import.meta.env.VITE_PEERJS_PATH ||
  "/peerjs";

const PEER_CONFIG = {
  host,
  port,
  path,
  secure,
  debug: import.meta.env.DEV ? 2 : 0,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
    ],
  },
};

/**
 * Service class for managing PeerJS connections for RealTime video/audio calls.
 */
class VideoPeerService {
  private peer: Peer | null = null;
  private currentCalls: Map<string, MediaConnection> = new Map();
  private localStream: MediaStream | null = null;

  initialize(userId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        resolve(this.peer.id);
        return;
      }

      this.peer = new Peer(userId, PEER_CONFIG);

      this.peer.on("open", (id) => {
        console.log("[VideoPeerService] Peer ready:", id);
        resolve(id);
      });

      this.peer.on("error", (error) => {
        console.error("[VideoPeerService] Peer error:", error);
        reject(error);
      });

      this.peer.on("close", () => {
        console.log("[VideoPeerService] Peer closed");
      });

      this.peer.on("disconnected", () => {
        console.log("[VideoPeerService] Peer disconnected, attempting reconnect");
        this.peer?.reconnect();
      });
    });
  }

  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
  }

  call(remotePeerId: string, localStream: MediaStream): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error("Peer not initialized"));
        return;
      }

      if (this.currentCalls.has(remotePeerId)) {
        console.log("[VideoPeerService] Already connected with", remotePeerId);
        return;
      }

      const call = this.peer.call(remotePeerId, localStream);
      this.currentCalls.set(remotePeerId, call);

      const timeout = setTimeout(() => {
        if (!call.open) {
          this.currentCalls.delete(remotePeerId);
          reject(new Error("Call timeout"));
        }
      }, 15000);

      call.on("stream", (remoteStream) => {
        clearTimeout(timeout);
        resolve(remoteStream);
      });

      call.on("error", (error) => {
        clearTimeout(timeout);
        this.currentCalls.delete(remotePeerId);
        reject(error);
      });

      call.on("close", () => {
        clearTimeout(timeout);
        this.currentCalls.delete(remotePeerId);
      });
    });
  }

  onCall(
    callback: (remotePeerId: string, remoteStream: MediaStream) => void
  ): void {
    if (!this.peer) {
      console.error("[VideoPeerService] Cannot set onCall without peer");
      return;
    }

    this.peer.on("call", (call) => {
      const answerWith = this.localStream;
      if (answerWith) {
        call.answer(answerWith);
      } else {
        navigator.mediaDevices
          .getUserMedia({ audio: true, video: true })
          .then((stream) => {
            this.localStream = stream;
            call.answer(stream);
          })
          .catch((error) => {
            console.error("[VideoPeerService] Error acquiring media:", error);
          });
      }

      call.on("stream", (remoteStream) => {
        callback(call.peer, remoteStream);
      });

      call.on("close", () => {
        this.currentCalls.delete(call.peer);
      });

      call.on("error", (error) => {
        console.error("[VideoPeerService] Call error:", error);
        this.currentCalls.delete(call.peer);
      });

      this.currentCalls.set(call.peer, call);
    });
  }

  closeCall(remotePeerId: string): void {
    const call = this.currentCalls.get(remotePeerId);
    if (call) {
      call.close();
      this.currentCalls.delete(remotePeerId);
    }
  }

  closeAllCalls(): void {
    this.currentCalls.forEach((call) => call.close());
    this.currentCalls.clear();
  }

  destroy(): void {
    this.closeAllCalls();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  getPeerId(): string | null {
    return this.peer?.id || null;
  }
}

export const videoPeerService = new VideoPeerService();
