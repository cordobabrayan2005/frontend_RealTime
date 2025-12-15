import React from 'react';
import { useVideocallController } from '../features/videocall/hooks/useVideocallController';
import { ParticipantsGrid } from '../features/videocall/components/ParticipantsGrid';
import { CallControls } from '../features/videocall/components/CallControls';
import { ChatPanel } from '../features/videocall/components/ChatPanel';
import { MeetingCodeModal } from '../features/videocall/components/MeetingCodeModal';
import { Toast } from '../features/videocall/components/Toast';

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
    remoteStreamsVersion,
    cameraOn,
    micOn,
    handlers,
  } = useVideocallController();

  const {
    toggleCamera,
    toggleMic,
    toggleChat,
    toggleCode,
    closeChat,
    copyCode,
    changeChatInput,
    sendMessage,
    hangup,
  } = handlers;

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
        remoteStreamsVersion={remoteStreamsVersion}
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

      <MeetingCodeModal meetingId={meetingId} isOpen={showCode} onClose={toggleCode} onCopy={copyCode} />

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