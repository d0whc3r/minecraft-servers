// Action buttons shown inside the server details modal (admin side): lifecycle
// requests route through the tab's confirmation dialog; logs/console open
// their modals directly.
import type { ServerStatus } from "@/types";
import { Button } from "@/components/ui";

interface ServerDetailActionsProps {
  server: ServerStatus;
  /** True while another action is in flight. */
  disabled: boolean;
  onStart: () => void;
  onStopRequest: () => void;
  onRestartRequest: () => void;
  onBackupRequest: () => void;
  onLogs: () => void;
  onConsole: () => void;
  onDeleteRequest: () => void;
}

export function ServerDetailActions({
  server: s,
  disabled,
  onStart,
  onStopRequest,
  onRestartRequest,
  onBackupRequest,
  onLogs,
  onConsole,
  onDeleteRequest,
}: ServerDetailActionsProps) {
  const isUp = s.state === "running" || s.state === "starting";
  const isDown = s.state === "stopped" || s.state === "missing";
  return (
    <>
      {isUp ? (
        <Button disabled={disabled} onClick={onStopRequest}>
          Stop server
        </Button>
      ) : (
        <Button variant="primary" disabled={disabled} onClick={onStart}>
          Start server
        </Button>
      )}
      <Button disabled={disabled || isDown} onClick={onRestartRequest}>
        Restart
      </Button>
      <Button disabled={disabled || isDown} onClick={onBackupRequest}>
        Back up
      </Button>
      <Button onClick={onLogs}>Logs</Button>
      <Button onClick={onConsole}>Console</Button>
      {s.custom && (
        <Button
          variant="danger"
          disabled={disabled || !isDown}
          title={
            isDown
              ? "Remove this server from the panel"
              : "Stop the server first"
          }
          onClick={onDeleteRequest}
        >
          Delete
        </Button>
      )}
    </>
  );
}
