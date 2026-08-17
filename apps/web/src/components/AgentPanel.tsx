'use client';

import { useAgentSession } from '@/lib/useAgentSession';
import { Transcript } from './Transcript';

/**
 * Self-contained agent chat panel for the workspace: owns its own socket
 * connection and renders the shared transcript. For the session detail page,
 * use `useAgentSession` + `Transcript` directly so the same event stream can
 * also feed a plan/tasks sidebar.
 */
export function AgentPanel({
  sessionId,
  replay = false,
  showHeader = true,
}: {
  sessionId: string;
  replay?: boolean;
  showHeader?: boolean;
}) {
  const socket = useAgentSession(sessionId, { replay });
  return (
    <Transcript
      events={socket.events}
      connected={socket.connected}
      sendMessage={socket.sendMessage}
      stop={socket.stop}
      respondApproval={socket.respondApproval}
      showHeader={showHeader}
    />
  );
}
