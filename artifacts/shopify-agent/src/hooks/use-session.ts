import { useState, useEffect, useCallback } from 'react';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSession {
  sessionId: string;
  createdAt?: number;
  expiresAt?: string;
}

interface UseSessionOptions {
  storageKeyPrefix?: string;
  ttlMs?: number;
}

interface UseSessionResult {
  sessionId: string | null;
  chatDisabled: boolean;
  sessionError: boolean;
  refreshSession: () => Promise<string | null>;
}

function getStorageKey(prefix: string, storeDomain: string) {
  return `${prefix}${storeDomain}`;
}

function loadStoredSession(key: string, ttlMs: number): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let parsed: StoredSession;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localStorage.removeItem(key);
      return null;
    }

    if (!parsed.sessionId) {
      localStorage.removeItem(key);
      return null;
    }

    if (parsed.expiresAt) {
      if (new Date(parsed.expiresAt) > new Date()) return parsed.sessionId;
      localStorage.removeItem(key);
      return null;
    }

    if (parsed.createdAt && (Date.now() - parsed.createdAt) < ttlMs) {
      return parsed.sessionId;
    }

    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

function saveSession(key: string, sessionId: string, ttlMs: number) {
  const data: StoredSession = {
    sessionId,
    createdAt: Date.now(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(data));
}

export function useSession(storeDomain: string, options?: UseSessionOptions): UseSessionResult {
  const prefix = options?.storageKeyPrefix || 'shopify_agent_session_';
  const ttlMs = options?.ttlMs || DEFAULT_TTL_MS;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  const createNewSession = useCallback(async (key: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeDomain }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 403) {
        setChatDisabled(true);
        return null;
      }

      if (res.status === 429) {
        console.warn("[useSession] Rate limited during session creation");
        setSessionError(true);
        return null;
      }

      if (!res.ok) {
        console.warn("[useSession] Session creation failed:", res.status);
        setSessionError(true);
        return null;
      }

      const data = await res.json();
      saveSession(key, data.sessionId, ttlMs);
      setSessionId(data.sessionId);
      setSessionError(false);
      return data.sessionId;
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        console.warn("[useSession] Session creation timed out");
      } else {
        console.warn("[useSession] Failed to create session:", err);
      }
      setSessionError(true);
      return null;
    }
  }, [storeDomain, ttlMs]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    setSessionError(false);
    const key = getStorageKey(prefix, storeDomain);
    localStorage.removeItem(key);
    return createNewSession(key);
  }, [storeDomain, prefix, createNewSession]);

  useEffect(() => {
    if (!storeDomain) return;

    const key = getStorageKey(prefix, storeDomain);
    const existing = loadStoredSession(key, ttlMs);
    if (existing) {
      setSessionId(existing);
      return;
    }

    createNewSession(key);
  }, [storeDomain, prefix, ttlMs, createNewSession]);

  return { sessionId, chatDisabled, sessionError, refreshSession };
}
