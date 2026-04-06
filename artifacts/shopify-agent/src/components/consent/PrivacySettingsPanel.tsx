import { useState, useCallback } from "react";
import { Shield, Download, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useConsentStore,
  updateConsent,
  requestDataExport,
  requestDataDeletion,
  type ConsentCategories,
} from "@/store/use-consent-store";

interface PrivacySettingsPanelProps {
  storeDomain: string;
  sessionId: string;
  onClose?: () => void;
}

const CATEGORIES: Array<{ key: keyof ConsentCategories; label: string; description: string }> = [
  { key: "conversationHistory", label: "Conversation History", description: "Store your chat messages for context" },
  { key: "preferenceStorage", label: "Preference Storage", description: "Remember your shopping preferences" },
  { key: "orderHistoryAccess", label: "Order History Access", description: "Access order history for recommendations" },
  { key: "analytics", label: "Analytics", description: "Collect usage analytics for improvements" },
];

export function PrivacySettingsPanel({ storeDomain, sessionId, onClose }: PrivacySettingsPanelProps) {
  const { categories, setCategories, setHasConsented } = useConsentStore();
  const [localCategories, setLocalCategories] = useState<ConsentCategories>({ ...categories });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleToggle = useCallback((key: keyof ConsentCategories) => {
    setLocalCategories(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateConsent(storeDomain, sessionId, localCategories);
      setCategories(localCategories);
      setHasConsented(true);
      setMessage({ type: "success", text: "Privacy settings updated." });
    } catch {
      setMessage({ type: "error", text: "Failed to update settings." });
    } finally {
      setSaving(false);
    }
  }, [storeDomain, sessionId, localCategories, setCategories, setHasConsented]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setMessage(null);
    try {
      const blob = await requestDataExport(storeDomain, sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data-export-${sessionId.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "Data export downloaded." });
    } catch {
      setMessage({ type: "error", text: "Failed to export data." });
    } finally {
      setExporting(false);
    }
  }, [storeDomain, sessionId]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setMessage(null);
    try {
      await requestDataDeletion(storeDomain, sessionId);
      setMessage({ type: "success", text: "All your data has been deleted." });
      setShowDeleteConfirm(false);
      setCategories({
        conversationHistory: false,
        preferenceStorage: false,
        orderHistoryAccess: false,
        analytics: false,
      });
      setLocalCategories({
        conversationHistory: false,
        preferenceStorage: false,
        orderHistoryAccess: false,
        analytics: false,
      });
    } catch {
      setMessage({ type: "error", text: "Failed to delete data." });
    } finally {
      setDeleting(false);
    }
  }, [storeDomain, sessionId, setCategories]);

  const hasChanges = JSON.stringify(localCategories) !== JSON.stringify(categories);

  return (
    <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-y-auto" role="region" aria-label="Privacy settings">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Privacy & Data
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        )}
      </div>

      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Consent</p>
        {CATEGORIES.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label htmlFor={`privacy-${key}`} className="text-sm font-medium cursor-pointer">{label}</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={`privacy-${key}`}
              checked={localCategories[key]}
              onCheckedChange={() => handleToggle(key)}
            />
          </div>
        ))}
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Data</p>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="w-full justify-start gap-2">
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting..." : "Download My Data"}
        </Button>

        {!showDeleteConfirm ? (
          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} className="w-full justify-start gap-2 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
            Delete My Data
          </Button>
        ) : (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">This will permanently delete all your conversations, preferences, and analytics data. This action cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="flex-1">
                {deleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
