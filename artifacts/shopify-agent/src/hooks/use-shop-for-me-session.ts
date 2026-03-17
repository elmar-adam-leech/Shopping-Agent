import { useState, useEffect, useCallback } from "react";

const SESSION_TTL_MS = 23 * 60 * 60 * 1000;

export function useShopForMeSession(storeDomain: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatDisabled, setChatDisabled] = useState(false);

  const createNewSession = useCallback((key: string) => {
    return fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeDomain }),
    })
      .then((res) => {
        if (res.status === 403) {
          setChatDisabled(true);
          throw new Error("Chat disabled");
        }
        if (!res.ok) throw new Error("Session creation failed");
        return res.json();
      })
      .then((data) => {
        const sessionData = {
          sessionId: data.sessionId,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(sessionData));
        setSessionId(data.sessionId);
        return data.sessionId;
      })
      .catch((err) => {
        if (err.message !== "Chat disabled") {
          console.error("Failed to create session", err);
        }
        return null;
      });
  }, [storeDomain]);

  const refreshSession = useCallback(() => {
    const key = `shop_for_me_session_${storeDomain}`;
    localStorage.removeItem(key);
    return createNewSession(key);
  }, [storeDomain, createNewSession]);

  useEffect(() => {
    if (!storeDomain) return;
    const key = `shop_for_me_session_${storeDomain}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.sessionId && parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setSessionId(parsed.sessionId);
          return;
        }
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
    createNewSession(key);
  }, [storeDomain, createNewSession]);

  return { sessionId, chatDisabled, refreshSession };
}
