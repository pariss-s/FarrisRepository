import { useEffect, useRef, useState } from 'react';

// In-memory bearer token only (never persisted in localStorage/sessionStorage)
let memoryBearerToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryBearerToken = token;
}

export function getAuthToken(): string | null {
  return memoryBearerToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryBearerToken) {
    headers.set('Authorization', `Bearer ${memoryBearerToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const errMsg =
      typeof data.error === 'string'
        ? data.error
        : `Permintaan gagal (${response.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export interface WsMessage {
  event: string;
  payload: unknown;
  timestamp: string;
}

export function useLibraryWebSocket(
  onEvent: (msg: WsMessage) => void,
  onPollRefresh?: () => void
): {
  connected: boolean;
  syncMode: 'websocket' | 'polling' | 'reconnecting';
} {
  const [connected, setConnected] = useState(false);
  const [syncMode, setSyncMode] = useState<'websocket' | 'polling' | 'reconnecting'>('reconnecting');
  const handlerRef = useRef(onEvent);
  const pollRef = useRef(onPollRefresh);
  handlerRef.current = onEvent;
  pollRef.current = onPollRefresh;

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;
    let consecutiveFailures = 0;
    let openedOnce = false;

    function startPollingFallback() {
      if (!active) return;
      setSyncMode('polling');
      if (pollTimer === null) {
        pollTimer = window.setInterval(() => {
          pollRef.current?.();
        }, 15_000);
      }
    }

    function connect() {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (!active) return;
        openedOnce = true;
        consecutiveFailures = 0;
        setConnected(true);
        setSyncMode('websocket');
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(String(evt.data)) as WsMessage;
          handlerRef.current(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
        consecutiveFailures += 1;
        if (!openedOnce && consecutiveFailures >= 2) {
          startPollingFallback();
          return;
        }
        setSyncMode('reconnecting');
        reconnectTimer = window.setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      ws?.close();
    };
  }, []);

  return { connected, syncMode };
}
