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

  const createNewSession = useCallback(async (key: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeDomain }),
      });

      if (res.status === 403) {
        setChatDisabled(true);
        return null;
      }

      if (!res.ok) {
        console.warn("[useSession] Session creation failed:", res.status);
        return null;
      }

      const data = await res.json();
      saveSession(key, data.sessionId, ttlMs);
      setSessionId(data.sessionId);
      return data.sessionId;
    } catch (err) {
      console.warn("[useSession] Failed to create session:", err);
      return null;
    }
  }, [storeDomain, ttlMs]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
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

  return { sessionId, chatDisabled, refreshSession };
}
