import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/api";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "error";

interface UseLogStreamResult {
  logs: LogEntry[];
  connectionStatus: ConnectionStatus;
  clearLogs: () => void;
}

/**
 * Custom hook for managing Server-Sent Events (SSE) log streaming.
 * Handles connection, reconnection, log accumulation, and cleanup.
 */
export function useLogStream(deploymentId: string): UseLogStreamResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset state when deploymentId changes
    setLogs([]);
    lastIdRef.current = null;
    setConnectionStatus("connecting");

    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const open = (after: string | null) => {
      if (!active) return;
      const q = after
        ? `?afterId=${encodeURIComponent(after)}`
        : "";
      es = new EventSource(`/api/deployments/${deploymentId}/logs${q}`);
      if (after) setConnectionStatus("reconnecting");
      else setConnectionStatus("connecting");

      const onLog = (e: Event) => {
        const data = JSON.parse(
          (e as MessageEvent).data as string
        ) as LogEntry;
        setLogs((prev) => {
          if (prev.some((l) => l.id === data.id)) return prev;
          return [...prev, data];
        });
        lastIdRef.current = data.id;
      };

      es.addEventListener("log", onLog);
      es.addEventListener("logs_cleared", () => {
        // Clear local logs when backend signals a fresh start (redeploy)
        setLogs([]);
        lastIdRef.current = null;
      });
      es.addEventListener("replay_done", () => {
        if (active) setConnectionStatus("live");
      });
      es.onerror = () => {
        if (!active) return;
        try {
          es?.close();
        } catch {
          // ignore
        }
        if (!active) return;
        setConnectionStatus("reconnecting");
        const cursor = lastIdRef.current;
        timer = setTimeout(() => {
          if (active) open(cursor);
        }, 1500);
      };
    };

    open(null);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, [deploymentId]);

  const clearLogs = () => {
    setLogs([]);
    lastIdRef.current = null;
  };

  return { logs, connectionStatus, clearLogs };
}
