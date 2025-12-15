import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_VOICE_SOCKET_URL ||
  import.meta.env.VITE_VOICE_BACKEND_URL ||
  "http://localhost:3003";

/**
 * Service class for managing Socket.io connections used for video/audio signaling.
 * Mirrors the VCweb implementation but adapts to the RealTime environment variables.
 *
 * Responsibilities:
 * - Establish and manage a Socket.IO connection for signaling.
 * - Join and leave video rooms.
 * - Update media state (e.g., camera enabled/disabled).
 * - Listen for signaling events (peer joined, disconnected, errors, etc.).
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

  /**
   * Disconnects the signaling socket and clears the instance.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Retrieves the current Socket.IO instance.
   *
   * @returns {Socket | null} The active socket or null if not connected.
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Joins a video room.
   *
   * @param {string} meetingId - Meeting identifier.
   * @param {string} peerId - PeerJS identifier.
   * @param {string} userId - User identifier.
   * @param {string} displayName - Display name of the participant.
   */
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

  /**
   * Leaves a video room.
   *
   * @param {string} meetingId - Meeting identifier.
   * @param {string} peerId - PeerJS identifier.
   */
  leaveVideoRoom(meetingId: string, peerId: string): void {
    this.socket?.emit("leave-video-room", { meetingId, peerId });
  }

   /**
   * Updates the media state (e.g., video enabled/disabled).
   *
   * @param {string} roomId - Room identifier.
   * @param {boolean} isVideoEnabled - Whether video is enabled.
   */
  updateMediaState(roomId: string, isVideoEnabled: boolean): void {
    this.socket?.emit("media-state-change", {
      roomId,
      isVideoEnabled,
    });
  }

   /** Event listeners **/

  /**
   * Fired when the user successfully joins a video room.
   * @param callback - Handler receiving peers list.
   */
  onVideoJoined(callback: (data: { peers: string[] }) => void): void {
    this.socket?.on("video-joined", callback);
  }

  /**
   * Fired when a new peer joins the room.
   * @param callback - Handler receiving peer ID.
   */
  onPeerJoined(callback: (peerId: string) => void): void {
    this.socket?.on("peer-joined", callback);
  }

  /**
   * Fired when a peer disconnects.
   * @param callback - Handler receiving peer ID.
   */
  onPeerDisconnected(callback: (peerId: string) => void): void {
    this.socket?.on("peer-disconnected", callback);
  }

  /**
   * Fired when the room participants list is updated.
   * @param callback - Handler receiving participants data.
   */
  onRoomParticipants(callback: (data: any) => void): void {
    this.socket?.on("room-participants", callback);
  }

  /**
   * Fired when a new participant joins.
   * @param callback - Handler receiving participant data.
   */
  onParticipantJoined(callback: (data: any) => void): void {
    this.socket?.on("participant-joined", callback);
  }

  /**
   * Fired when a participant's media state changes.
   * @param callback - Handler receiving media state data.
   */
  onMediaStateChanged(callback: (data: any) => void): void {
    this.socket?.on("media-state-changed", callback);
  }

  /**
   * Fired when the server forces a disconnect.
   * @param callback - Handler invoked on force disconnect.
   */
  onForceDisconnect(callback: () => void): void {
    this.socket?.on("force-disconnect", callback);
  }

  /**
   * Fired when a video error occurs.
   * @param callback - Handler receiving error message.
   */
  onVideoError(callback: (message: string) => void): void {
    this.socket?.on("video-error", callback);
  }

  /**
   * Fired when a generic socket error occurs.
   * @param callback - Handler receiving error data.
   */
  onError(callback: (data: any) => void): void {
    this.socket?.on("error", callback);
  }
}

export const videoSocketService = new VideoSocketService();
