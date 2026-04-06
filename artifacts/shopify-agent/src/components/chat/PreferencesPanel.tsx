import { memo } from "react";
import { Settings2 } from "lucide-react";

interface PreferencesPanelProps {
  userPrefs: Record<string, string>;
  onPrefChange: (key: string, value: string) => void;
}

const inputClass = "w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-xs font-medium text-muted-foreground";

export const PreferencesPanel = memo(function PreferencesPanel({ userPrefs, onPrefChange }: PreferencesPanelProps) {
  return (
    <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200 max-h-[70vh] overflow-y-auto" role="region" aria-label="User preferences">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" aria-hidden="true" /> Your Preferences
      </h3>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">General</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="pref-display-name" className={labelClass}>Display Name</label>
            <input
              id="pref-display-name"
              className={inputClass}
              placeholder="Your name"
              defaultValue={userPrefs.displayName || ''}
              onBlur={(e) => onPrefChange('displayName', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-units" className={labelClass}>Preferred Units</label>
            <select id="pref-units" className={inputClass} defaultValue={userPrefs.units || 'imperial'} onChange={(e) => onPrefChange('units', e.target.value)}>
              <option value="imperial">Imperial (ft, lbs)</option>
              <option value="metric">Metric (m, kg)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-budget" className={labelClass}>Budget Range</label>
            <select id="pref-budget" className={inputClass} defaultValue={userPrefs.budget || ''} onChange={(e) => onPrefChange('budget', e.target.value)}>
              <option value="">No preference</option>
              <option value="budget">Budget-friendly</option>
              <option value="mid">Mid-range</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-style" className={labelClass}>Communication Style</label>
            <select id="pref-style" className={inputClass} defaultValue={userPrefs.style || 'friendly'} onChange={(e) => onPrefChange('style', e.target.value)}>
              <option value="friendly">Friendly & Casual</option>
              <option value="professional">Professional</option>
              <option value="concise">Brief & Concise</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clothing Sizes</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label htmlFor="pref-top-size" className={labelClass}>Top Size</label>
            <select id="pref-top-size" className={inputClass} defaultValue={userPrefs.topSize || ''} onChange={(e) => onPrefChange('topSize', e.target.value)}>
              <option value="">Not set</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
              <option value="XXXL">XXXL</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-bottom-size" className={labelClass}>Bottom Size</label>
            <input id="pref-bottom-size" className={inputClass} placeholder="e.g., 32, 32x30" defaultValue={userPrefs.bottomSize || ''} onBlur={(e) => onPrefChange('bottomSize', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-shoe-size" className={labelClass}>Shoe Size</label>
            <input id="pref-shoe-size" className={inputClass} placeholder="e.g., 10, 42" defaultValue={userPrefs.shoeSize || ''} onBlur={(e) => onPrefChange('shoeSize', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Style Preferences</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="pref-materials" className={labelClass}>Material Preferences</label>
            <input id="pref-materials" className={inputClass} placeholder="e.g., organic cotton, silk, linen" defaultValue={userPrefs.materials || ''} onBlur={(e) => onPrefChange('materials', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-brands" className={labelClass}>Favorite Brands</label>
            <input id="pref-brands" className={inputClass} placeholder="e.g., Nike, Patagonia" defaultValue={userPrefs.brands || ''} onBlur={(e) => onPrefChange('brands', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-colors" className={labelClass}>Color Preferences</label>
            <input id="pref-colors" className={inputClass} placeholder="e.g., navy, earth tones, black" defaultValue={userPrefs.colors || ''} onBlur={(e) => onPrefChange('colors', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="pref-lifestyle" className={labelClass}>Lifestyle / Dietary Filters</label>
            <input id="pref-lifestyle" className={inputClass} placeholder="e.g., vegan, sustainable, organic" defaultValue={userPrefs.lifestyle || ''} onBlur={(e) => onPrefChange('lifestyle', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
});
