import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_VOICE_SOCKET_URL ||
  import.meta.env.VITE_VOICE_BACKEND_URL ||
  "http://localhost:3003";

/**
 * Service class for managing Socket.io connections used for video/audio signaling.
 * Mirrors the VCweb implementation but adapts to the RealTime environment variables.
 */
class VideoSocketService {
  /** Active Socket.io instance */
  private socket: Socket | null = null;

  /**
   * Establishes a signaling connection.
   * @param userId identifier of the authenticated user
   * @param token optional JWT for backend auth
   */
  connect(userId: string, token?: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: {
        userId,
        token,
      },
    });

    this.socket.on("connect", () => {
      console.log("[VideoSocket] Connected:", this.socket?.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[VideoSocket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[VideoSocket] Connection error:", error.message);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  joinVideoRoom(
    meetingId: string,
    peerId: string,
    userId: string,
    displayName: string
  ): void {
    this.socket?.emit("join-video-room", {
      meetingId,
      peerId,
      userId,
      displayName,
    });
  }

  leaveVideoRoom(meetingId: string, peerId: string): void {
    this.socket?.emit("leave-video-room", { meetingId, peerId });
  }

  updateMediaState(roomId: string, isVideoEnabled: boolean): void {
    this.socket?.emit("media-state-change", {
      roomId,
      isVideoEnabled,
    });
  }

  onVideoJoined(callback: (data: { peers: string[] }) => void): void {
    this.socket?.on("video-joined", callback);
  }

  onPeerJoined(callback: (peerId: string) => void): void {
    this.socket?.on("peer-joined", callback);
  }

  onPeerDisconnected(callback: (peerId: string) => void): void {
    this.socket?.on("peer-disconnected", callback);
  }

  onRoomParticipants(callback: (data: any) => void): void {
    this.socket?.on("room-participants", callback);
  }

  onParticipantJoined(callback: (data: any) => void): void {
    this.socket?.on("participant-joined", callback);
  }

  onMediaStateChanged(callback: (data: any) => void): void {
    this.socket?.on("media-state-changed", callback);
  }

  onForceDisconnect(callback: () => void): void {
    this.socket?.on("force-disconnect", callback);
  }

  onVideoError(callback: (message: string) => void): void {
    this.socket?.on("video-error", callback);
  }

  onError(callback: (data: any) => void): void {
    this.socket?.on("error", callback);
  }
}

export const videoSocketService = new VideoSocketService();
