import { create } from 'zustand';

export interface ConsentCategories {
  conversationHistory: boolean;
  preferenceStorage: boolean;
  orderHistoryAccess: boolean;
  analytics: boolean;
}

interface ConsentState {
  categories: ConsentCategories;
  hasConsented: boolean;
  showBanner: boolean;
  loading: boolean;
  setCategories: (categories: ConsentCategories) => void;
  setHasConsented: (val: boolean) => void;
  setShowBanner: (val: boolean) => void;
  setLoading: (val: boolean) => void;
}

const DEFAULT_CATEGORIES: ConsentCategories = {
  conversationHistory: false,
  preferenceStorage: false,
  orderHistoryAccess: false,
  analytics: false,
};

export const useConsentStore = create<ConsentState>((set) => ({
  categories: { ...DEFAULT_CATEGORIES },
  hasConsented: false,
  showBanner: false,
  loading: false,
  setCategories: (categories) => set({ categories }),
  setHasConsented: (hasConsented) => set({ hasConsented }),
  setShowBanner: (showBanner) => set({ showBanner }),
  setLoading: (loading) => set({ loading }),
}));

export async function fetchConsent(storeDomain: string, sessionId: string): Promise<{ categories: ConsentCategories; hasConsented: boolean }> {
  const res = await fetch(`/api/stores/${storeDomain}/consents`, {
    headers: { 'x-session-id': sessionId },
  });
  if (!res.ok) throw new Error('Failed to fetch consent');
  const data = await res.json();
  return {
    categories: data.categories ?? { ...DEFAULT_CATEGORIES },
    hasConsented: !!data.hasConsented,
  };
}

export async function updateConsent(storeDomain: string, sessionId: string, categories: ConsentCategories): Promise<void> {
  const res = await fetch(`/api/stores/${storeDomain}/consents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({ categories }),
  });
  if (!res.ok) throw new Error('Failed to update consent');
}

export async function requestDataExport(storeDomain: string, sessionId: string): Promise<Blob> {
  const res = await fetch(`/api/stores/${storeDomain}/consents/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to export data');
  return res.blob();
}

export async function requestDataDeletion(storeDomain: string, sessionId: string): Promise<void> {
  const res = await fetch(`/api/stores/${storeDomain}/consents/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to delete data');
}
