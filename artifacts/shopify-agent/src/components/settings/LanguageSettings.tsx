import { useState, useEffect } from "react";
import { Globe, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetStore, useUpdateStore } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LOCALE_LABELS } from "@/lib/i18n";

interface LanguageSettingsProps {
  storeDomain: string;
}

const ALL_LANGUAGES = Object.entries(SUPPORTED_LOCALE_LABELS).map(([code, label]) => ({
  code,
  label,
}));

export function LanguageSettings({ storeDomain }: LanguageSettingsProps) {
  const { data: store } = useGetStore(storeDomain);
  const { mutateAsync: updateStore } = useUpdateStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      const s = store as any;
      setDefaultLanguage(s.defaultLanguage || "en");
      setSupportedLanguages(s.supportedLanguages || []);
      setDirty(false);
    }
  }, [store]);

  const addLanguage = (code: string) => {
    if (!supportedLanguages.includes(code)) {
      setSupportedLanguages([...supportedLanguages, code]);
      setDirty(true);
    }
  };

  const removeLanguage = (code: string) => {
    setSupportedLanguages(supportedLanguages.filter((l) => l !== code));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStore({
        storeDomain,
        data: { defaultLanguage, supportedLanguages } as any,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeDomain}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeDomain}/public`] });
      toast({ title: "Saved", description: "Language settings updated." });
      setDirty(false);
    } catch {
      toast({ title: "Error", description: "Failed to save language settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = ALL_LANGUAGES.filter(
    (l) => !supportedLanguages.includes(l.code)
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold">Language Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure which languages your AI shopping assistant supports. The agent will
            automatically detect the customer's language and respond accordingly.
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div className="space-y-2">
          <Label>Default Language</Label>
          <p className="text-xs text-muted-foreground">
            The language used when the customer's language cannot be detected or isn't supported.
          </p>
          <Select
            value={defaultLanguage}
            onValueChange={(val) => {
              setDefaultLanguage(val);
              setDirty(true);
            }}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Supported Languages</Label>
          <p className="text-xs text-muted-foreground">
            When set, the agent will only respond in these languages. Leave empty to auto-detect
            and respond in any language the customer uses.
          </p>

          {supportedLanguages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {supportedLanguages.map((code) => (
                <Badge key={code} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  {SUPPORTED_LOCALE_LABELS[code] || code}
                  <button
                    onClick={() => removeLanguage(code)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    aria-label={`Remove ${SUPPORTED_LOCALE_LABELS[code] || code}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {availableToAdd.length > 0 && (
            <Select onValueChange={addLanguage} value="">
              <SelectTrigger className="w-full max-w-xs mt-2">
                <SelectValue placeholder="Add a language..." />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Language Settings"}
        </Button>
      </div>
    </section>
  );
}
