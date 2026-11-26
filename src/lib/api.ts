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

export function useLibraryWebSocket(onEvent: (msg: WsMessage) => void): {
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    function connect() {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (active) setConnected(true);
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
      ws?.close();
    };
  }, []);

  return { connected };
}
