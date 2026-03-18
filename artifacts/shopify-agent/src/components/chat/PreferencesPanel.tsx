import { memo } from "react";
import { Settings2 } from "lucide-react";

interface PreferencesPanelProps {
  userPrefs: Record<string, string>;
  onPrefChange: (key: string, value: string) => void;
}

export const PreferencesPanel = memo(function PreferencesPanel({ userPrefs, onPrefChange }: PreferencesPanelProps) {
  return (
    <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" /> Your Preferences
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Display Name</label>
          <input
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Your name"
            defaultValue={userPrefs.displayName || ''}
            onBlur={(e) => onPrefChange('displayName', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Preferred Units</label>
          <select
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            defaultValue={userPrefs.units || 'imperial'}
            onChange={(e) => onPrefChange('units', e.target.value)}
          >
            <option value="imperial">Imperial (ft, lbs)</option>
            <option value="metric">Metric (m, kg)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Budget Range</label>
          <select
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
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
          <label className="text-xs font-medium text-muted-foreground">Communication Style</label>
          <select
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
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
