import { useState, useEffect } from 'react';
import { useCreateSession } from '@workspace/api-client-react';

const SESSION_STORAGE_KEY_PREFIX = 'shopify_agent_session_';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSession {
  sessionId: string;
  createdAt: number;
}

function getStorageKey(storeDomain: string) {
  return `${SESSION_STORAGE_KEY_PREFIX}${storeDomain}`;
}

function loadStoredSession(storeDomain: string): string | null {
  try {
    const key = getStorageKey(storeDomain);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let parsed: StoredSession;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localStorage.removeItem(key);
      return null;
    }

    if (parsed.sessionId && parsed.createdAt && (Date.now() - parsed.createdAt) < SESSION_TTL_MS) {
      return parsed.sessionId;
    }

    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

function saveSession(storeDomain: string, sessionId: string) {
  const key = getStorageKey(storeDomain);
  const data: StoredSession = { sessionId, createdAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(data));
}

export function useSession(storeDomain: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { mutateAsync: createSessionApi } = useCreateSession();

  useEffect(() => {
    if (!storeDomain) return;

    const initSession = async () => {
      const existing = loadStoredSession(storeDomain);
      if (existing) {
        setSessionId(existing);
        return;
      }

      try {
        const response = await createSessionApi({ data: { storeDomain } });
        const newSessionId = (response as { sessionId: string }).sessionId;
        saveSession(storeDomain, newSessionId);
        setSessionId(newSessionId);
      } catch (error) {
        console.error('[Session] Failed to create session', error);
        setSessionId(null);
      }
    };

    initSession();
  }, [storeDomain, createSessionApi]);

  return sessionId;
}
