import React from 'react';
import { Toast } from '../components/videocall/Toast';
import { ParticipantsGrid } from '../components/videocall/ParticipantsGrid';
import { CallControls } from '../components/videocall/CallControls';
import { MeetingCodeModal } from '../components/videocall/MeetingCodeModal';
import { ChatPanel } from '../components/videocall/ChatPanel';
import { useVideocallController } from '../hooks/useVideocallController';

/**
 * VideoCall React component.
 * Manages local media (camera/microphone), a simulated participants list and an in-call chat UI.
 *
 * @returns {JSX.Element} The video call page element.
 */
export default function VideoCall() {
  const {
    meetingId,
    meetingEnded,
    modalVisible,
    modalMessage,
    participants,
    showChat,
    showCode,
    chatInput,
    hasNewMessages,
    messages,
    localVideoRef,
    remoteVideoRefs,
    cameraOn,
    micOn,
    handlers: {
      toggleCamera,
      toggleMic,
      toggleChat,
      toggleCode,
      closeChat,
      copyCode,
      changeChatInput,
      sendMessage,
      hangup,
    },
  } = useVideocallController();

  if (meetingEnded) {
    return (
      <main className="videocall-page">
        <div className="vc-ended-message">
          <h2>La reunión ha terminado</h2>
          <p>Serás redirigido en unos segundos...</p>
        </div>
      </main>
    );
  }


  return (
    <main className="videocall-page" role="main" aria-label="Videollamada">
      <Toast message={modalMessage} isVisible={modalVisible} />

      <div className="vc-top-left-back" onClick={() => window.history.back()} aria-hidden>
        ←
      </div>

      <ParticipantsGrid
        participants={participants}
        localVideoRef={localVideoRef}
        cameraOn={cameraOn}
        remoteVideoRefs={remoteVideoRefs}
      />

      <CallControls
        cameraOn={cameraOn}
        micOn={micOn}
        hasNewMessages={hasNewMessages}
        showChat={showChat}
        showCode={showCode}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMic}
        onToggleChat={toggleChat}
        onToggleCode={toggleCode}
        onHangup={hangup}
      />

      <MeetingCodeModal
        meetingId={meetingId}
        isOpen={showCode}
        onClose={toggleCode}
        onCopy={copyCode}
      />

      <ChatPanel
        isOpen={showChat}
        messages={messages}
        chatInput={chatInput}
        onChangeInput={changeChatInput}
        onSendMessage={sendMessage}
        onClose={closeChat}
      />
    </main>
  );
}