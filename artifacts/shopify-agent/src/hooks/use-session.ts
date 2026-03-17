import { useState, useEffect } from 'react';
import { useCreateSession } from '@workspace/api-client-react';

export function useSession(storeDomain: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { mutateAsync: createSessionApi } = useCreateSession();

  useEffect(() => {
    if (!storeDomain) return;

    const initSession = async () => {
      const storageKey = `shopify_agent_session_${storeDomain}`;
      const currentSessionId = localStorage.getItem(storageKey);

      if (currentSessionId) {
        setSessionId(currentSessionId);
        return;
      }

      try {
        const response = await createSessionApi({ data: { storeDomain } });
        const newSessionId = (response as { sessionId: string }).sessionId;
        localStorage.setItem(storageKey, newSessionId);
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
