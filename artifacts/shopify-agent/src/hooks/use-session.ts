import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCreateSession } from '@workspace/api-client-react';

export function useSession(storeDomain: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { mutateAsync: createSessionApi } = useCreateSession();

  useEffect(() => {
    if (!storeDomain) return;

    const initSession = async () => {
      const storageKey = `shopify_agent_session_${storeDomain}`;
      let currentSessionId = localStorage.getItem(storageKey);

      if (!currentSessionId) {
        currentSessionId = uuidv4();
        try {
          await createSessionApi({ data: { storeDomain } });
          localStorage.setItem(storageKey, currentSessionId);
          setSessionId(currentSessionId);
        } catch (error) {
          console.error('[Session] Failed to register session with backend', error);
          // Fallback to local session if backend fails
          localStorage.setItem(storageKey, currentSessionId);
          setSessionId(currentSessionId);
        }
      } else {
        setSessionId(currentSessionId);
      }
    };

    initSession();
  }, [storeDomain, createSessionApi]);

  return sessionId;
}
