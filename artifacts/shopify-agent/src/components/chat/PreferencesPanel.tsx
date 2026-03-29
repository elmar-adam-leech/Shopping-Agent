import { memo } from "react";
import { Settings2 } from "lucide-react";

interface PreferencesPanelProps {
  userPrefs: Record<string, string>;
  onPrefChange: (key: string, value: string) => void;
}

export const PreferencesPanel = memo(function PreferencesPanel({ userPrefs, onPrefChange }: PreferencesPanelProps) {
  return (
    <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200" role="region" aria-label="User preferences">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" aria-hidden="true" /> Your Preferences
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="pref-display-name" className="text-xs font-medium text-muted-foreground">Display Name</label>
          <input
            id="pref-display-name"
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your name"
            defaultValue={userPrefs.displayName || ''}
            onBlur={(e) => onPrefChange('displayName', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pref-units" className="text-xs font-medium text-muted-foreground">Preferred Units</label>
          <select
            id="pref-units"
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={userPrefs.units || 'imperial'}
            onChange={(e) => onPrefChange('units', e.target.value)}
          >
            <option value="imperial">Imperial (ft, lbs)</option>
            <option value="metric">Metric (m, kg)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="pref-budget" className="text-xs font-medium text-muted-foreground">Budget Range</label>
          <select
            id="pref-budget"
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={userPrefs.budget || ''}
            onChange={(e) => onPrefChange('budget', e.target.value)}
          >
            <option value="">No preference</option>
            <option value="budget">Budget-friendly</option>
            <option value="mid">Mid-range</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="pref-style" className="text-xs font-medium text-muted-foreground">Communication Style</label>
          <select
            id="pref-style"
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={userPrefs.style || 'friendly'}
            onChange={(e) => onPrefChange('style', e.target.value)}
          >
            <option value="friendly">Friendly & Casual</option>
            <option value="professional">Professional</option>
            <option value="concise">Brief & Concise</option>
          </select>
        </div>
      </div>
    </div>
  );
});
