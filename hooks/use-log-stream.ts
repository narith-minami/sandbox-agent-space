'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LogLevel } from '@/types/sandbox';

interface StreamLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface UseLogStreamResult {
  logs: StreamLogEntry[];
  isConnected: boolean;
  error: string | null;
  isComplete: boolean;
}

export function useLogStream(sessionId: string | null): UseLogStreamResult {
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const connect = useCallback(() => {
    if (!sessionId) return;

    setError(null);
    setIsComplete(false);

    const eventSource = new EventSource(`/api/sandbox/${sessionId}/logs`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            setIsConnected(true);
            break;
          case 'log':
            setLogs((prev) => [...prev, {
              timestamp: data.timestamp,
              level: data.level,
              message: data.message,
            }]);
            break;
          case 'complete':
            setIsComplete(true);
            eventSource.close();
            break;
          case 'error':
            setError(data.message);
            eventSource.close();
            break;
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setLogs([]);
      setIsConnected(false);
      setError(null);
      setIsComplete(false);
      return;
    }

    const cleanup = connect();
    return cleanup;
  }, [sessionId, connect]);

  return {
    logs,
    isConnected,
    error,
    isComplete,
  };
}
