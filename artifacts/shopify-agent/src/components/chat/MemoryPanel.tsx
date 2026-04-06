import { memo, useState } from "react";
import { Brain, ChevronDown, ChevronUp, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemoryPanelProps {
  userPrefs: Record<string, string>;
  onPrefChange: (key: string, value: string) => void;
  onPrefDelete: (key: string) => void;
}

const PREF_LABELS: Record<string, string> = {
  displayName: "Name",
  units: "Preferred Units",
  budget: "Budget Range",
  style: "Communication Style",
  topSize: "Top Size",
  bottomSize: "Bottom Size",
  shoeSize: "Shoe Size",
  materials: "Material Preferences",
  brands: "Favorite Brands",
  colors: "Color Preferences",
  lifestyle: "Lifestyle Filters",
};

export const MemoryPanel = memo(function MemoryPanel({ userPrefs, onPrefChange, onPrefDelete }: MemoryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const entries = Object.entries(userPrefs).filter(([, v]) => v && v.trim());

  if (entries.length === 0) return null;

  const startEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const confirmEdit = () => {
    if (editingKey) {
      onPrefChange(editingKey, editValue);
      setEditingKey(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <div className="mx-auto max-w-4xl mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50 w-full"
        aria-expanded={expanded}
        aria-controls="memory-panel-content"
      >
        <Brain className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span className="font-medium">What I remember about you</span>
        <span className="text-muted-foreground/60">({entries.length} {entries.length === 1 ? "item" : "items"})</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {expanded && (
        <div id="memory-panel-content" className="mt-2 border border-border/50 rounded-lg bg-card/50 divide-y divide-border/30 animate-in slide-in-from-top-1 duration-150">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 px-4 py-2.5 group">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-muted-foreground">{PREF_LABELS[key] || key}</span>
                {editingKey === key ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="flex-1 text-sm px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") cancelEdit(); }}
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={confirmEdit} aria-label="Confirm edit">
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit} aria-label="Cancel edit">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-foreground truncate">{value}</p>
                )}
              </div>
              {editingKey !== key && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(key, value)} aria-label={`Edit ${PREF_LABELS[key] || key}`}>
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onPrefDelete(key)} aria-label={`Delete ${PREF_LABELS[key] || key}`}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
