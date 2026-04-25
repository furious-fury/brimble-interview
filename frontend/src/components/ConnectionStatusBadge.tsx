import type { ConnectionStatus } from "../hooks/useLogStream.js";

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
}

/**
 * Displays the current SSE connection status.
 */
export function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  const text = {
    connecting: "Connecting…",
    live: "Live",
    reconnecting: "Reconnecting…",
    error: "Error",
  }[status];

  return (
    <div className="ml-auto min-w-0 text-xs text-slate-500">
      {text}
    </div>
  );
}
