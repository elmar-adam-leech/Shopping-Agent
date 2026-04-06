import { useState, useEffect, useCallback } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useConsentStore,
  fetchConsent,
  updateConsent,
  type ConsentCategories,
} from "@/store/use-consent-store";

interface ConsentBannerProps {
  storeDomain: string;
  sessionId: string;
}

const CATEGORIES: Array<{ key: keyof ConsentCategories; label: string; description: string }> = [
  { key: "conversationHistory", label: "Conversation History", description: "Store your chat messages to provide context in future conversations" },
  { key: "preferenceStorage", label: "Preference Storage", description: "Remember your size, style, and shopping preferences" },
  { key: "orderHistoryAccess", label: "Order History Access", description: "Access your order history for personalized recommendations" },
  { key: "analytics", label: "Analytics", description: "Help us improve by collecting usage analytics" },
];

export function ConsentBanner({ storeDomain, sessionId }: ConsentBannerProps) {
  const { categories, hasConsented, showBanner, setCategories, setHasConsented, setShowBanner, setLoading } = useConsentStore();
  const [localCategories, setLocalCategories] = useState<ConsentCategories>({ ...categories });
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storeDomain || !sessionId) return;
    setLoading(true);
    fetchConsent(storeDomain, sessionId)
      .then(({ categories: c, hasConsented: hc }) => {
        setCategories(c);
        setHasConsented(hc);
        setLocalCategories(c);
        if (!hc) setShowBanner(true);
      })
      .catch(() => {
        setShowBanner(true);
      })
      .finally(() => setLoading(false));
  }, [storeDomain, sessionId, setCategories, setHasConsented, setShowBanner, setLoading]);

  const handleToggle = useCallback((key: keyof ConsentCategories) => {
    setLocalCategories(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAcceptAll = useCallback(async () => {
    const allTrue: ConsentCategories = {
      conversationHistory: true,
      preferenceStorage: true,
      orderHistoryAccess: true,
      analytics: true,
    };
    setSaving(true);
    try {
      await updateConsent(storeDomain, sessionId, allTrue);
      setCategories(allTrue);
      setHasConsented(true);
      setShowBanner(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }, [storeDomain, sessionId, setCategories, setHasConsented, setShowBanner]);

  const handleSaveChoices = useCallback(async () => {
    setSaving(true);
    try {
      await updateConsent(storeDomain, sessionId, localCategories);
      setCategories(localCategories);
      setHasConsented(true);
      setShowBanner(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }, [storeDomain, sessionId, localCategories, setCategories, setHasConsented, setShowBanner]);

  const handleDeclineAll = useCallback(async () => {
    const allFalse: ConsentCategories = {
      conversationHistory: false,
      preferenceStorage: false,
      orderHistoryAccess: false,
      analytics: false,
    };
    setSaving(true);
    try {
      await updateConsent(storeDomain, sessionId, allFalse);
      setCategories(allFalse);
      setHasConsented(true);
      setShowBanner(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }, [storeDomain, sessionId, setCategories, setHasConsented, setShowBanner]);

  if (!showBanner || hasConsented) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base">Your Privacy Matters</h3>
            <p className="text-xs text-muted-foreground">Choose how we use your data</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          We need your consent to store and process your data. You can customize which types of data we collect, or accept/decline all at once.
        </p>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Hide details" : "Customize preferences"}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-border pt-3">
            {CATEGORIES.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`consent-${key}`} className="text-sm font-medium cursor-pointer">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={`consent-${key}`}
                  checked={localCategories[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={handleDeclineAll} disabled={saving} className="flex-1">
            Decline All
          </Button>
          {expanded ? (
            <Button size="sm" onClick={handleSaveChoices} disabled={saving} className="flex-1">
              Save Choices
            </Button>
          ) : (
            <Button size="sm" onClick={handleAcceptAll} disabled={saving} className="flex-1">
              Accept All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
