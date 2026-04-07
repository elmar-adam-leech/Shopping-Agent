import { useState } from "react";
import {
  useListKnowledge,
  useCreateKnowledge,
  useDeleteKnowledge,
  useUpdateKnowledge,
  useListDeletedKnowledge,
  useRestoreKnowledge,
  getListKnowledgeQueryKey,
  getListDeletedKnowledgeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Trash2, Plus, ArrowUp, ArrowDown, Edit2, Check, X,
  BookOpen, RotateCcw, Archive, Search, Tag, Cloud, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LastUpdated } from "@/components/ui/last-updated";
import { BulkKnowledgeImport } from "./BulkKnowledgeImport";
import { ShopifySyncSettings } from "./ShopifySyncSettings";

interface KnowledgeEntry {
  id: number;
  storeDomain: string;
  category: string;
  title: string;
  content: string;
  sortOrder: number;
  tags: string[];
  source: string;
  sourceId?: string | null;
  contentHash?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORIES = [
  { id: 'general', label: 'General Info', desc: 'Brand voice, tone, company history' },
  { id: 'sizing', label: 'Sizing & Recommendations', desc: 'Rules for recommending products' },
  { id: 'compatibility', label: 'Compatibility Rules', desc: 'What works with what' },
  { id: 'required_accessories', label: 'Required Accessories', desc: 'Must-have add-ons' },
  { id: 'restrictions', label: 'Restrictions', desc: 'Regional or product restrictions' },
  { id: 'policies', label: 'Store Policies', desc: 'Returns, shipping, warranties' },
  { id: 'custom', label: 'Custom', desc: 'Other knowledge' },
];

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
          >
            <Tag className="w-3 h-3" />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-destructive ml-0.5"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addTag(); }
          }}
          placeholder="Add tag..."
          className="rounded-lg text-sm h-8"
        />
        <Button size="sm" variant="outline" onClick={addTag} disabled={!input.trim()} className="rounded-lg h-8">
          Add
        </Button>
      </div>
    </div>
  );
}

export function KnowledgeEditor({ storeDomain }: { storeDomain: string }) {
  const queryClient = useQueryClient();
  const knowledgeQueryKey = getListKnowledgeQueryKey(storeDomain);
  const { data: knowledgeList, refetch, dataUpdatedAt } = useListKnowledge(storeDomain, undefined, {
    query: { queryKey: knowledgeQueryKey, staleTime: 30_000, refetchInterval: 30_000 },
  });
  const { mutateAsync: createKnowledge, isPending: creating } = useCreateKnowledge();
  const { mutateAsync: deleteKnowledge } = useDeleteKnowledge();
  const { mutateAsync: updateKnowledge } = useUpdateKnowledge();
  const { data: deletedList, refetch: refetchDeleted } = useListDeletedKnowledge(storeDomain, {
    query: { queryKey: getListDeletedKnowledgeQueryKey(storeDomain), staleTime: 60_000 },
  });
  const { mutateAsync: restoreKnowledge } = useRestoreKnowledge();
  const { toast } = useToast();
  const [showDeleted, setShowDeleted] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTag, setSearchTag] = useState("");

  const handleAdd = async () => {
    if (!newTitle || !newContent) return;
    const optimisticEntry: KnowledgeEntry = {
      id: -Date.now(),
      storeDomain,
      category,
      title: newTitle,
      content: newContent,
      sortOrder: 0,
      tags: newTags,
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const previousData = queryClient.getQueryData<KnowledgeEntry[]>(knowledgeQueryKey);
    queryClient.setQueryData<KnowledgeEntry[]>(knowledgeQueryKey, (old) => [...(old ?? []), optimisticEntry]);
    setNewTitle("");
    setNewContent("");
    setNewTags([]);
    try {
      await createKnowledge({
        storeDomain,
        data: {
          title: optimisticEntry.title,
          content: optimisticEntry.content,
          category: category as "general" | "sizing" | "compatibility" | "required_accessories" | "restrictions" | "policies" | "custom",
          sortOrder: 0,
          tags: optimisticEntry.tags,
        }
      });
      refetch();
      toast({ title: "Knowledge entry added" });
    } catch {
      queryClient.setQueryData(knowledgeQueryKey, previousData);
      toast({ title: "Failed to add", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    const previousData = queryClient.getQueryData<KnowledgeEntry[]>(knowledgeQueryKey);
    queryClient.setQueryData<KnowledgeEntry[]>(knowledgeQueryKey, (old) => (old ?? []).filter((e) => e.id !== id));
    try {
      await deleteKnowledge({ storeDomain, knowledgeId: id });
      refetch();
      refetchDeleted();
      toast({ title: "Moved to Recently Deleted" });
    } catch {
      queryClient.setQueryData(knowledgeQueryKey, previousData);
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await restoreKnowledge({ storeDomain, knowledgeId: String(id) });
      refetch();
      refetchDeleted();
      toast({ title: "Restored" });
    } catch {
      toast({ title: "Failed to restore", variant: "destructive" });
    }
  };

  const startEdit = (item: KnowledgeEntry) => {
    if (item.source === "synced") {
      const confirmed = window.confirm(
        "This entry is auto-managed by Shopify sync. Manual edits may be overwritten on the next sync. Continue?"
      );
      if (!confirmed) return;
    }
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditTags(item.tags ?? []);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
    setEditTags([]);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle || !editContent) return;
    const previousData = queryClient.getQueryData<KnowledgeEntry[]>(knowledgeQueryKey);
    queryClient.setQueryData<KnowledgeEntry[]>(knowledgeQueryKey, (old) =>
      (old ?? []).map((e) => e.id === editingId ? { ...e, title: editTitle, content: editContent, tags: editTags, updatedAt: new Date().toISOString() } : e)
    );
    cancelEdit();
    try {
      await updateKnowledge({
        storeDomain,
        knowledgeId: editingId,
        data: { title: editTitle, content: editContent, tags: editTags }
      });
      refetch();
      toast({ title: "Updated" });
    } catch {
      queryClient.setQueryData(knowledgeQueryKey, previousData);
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleReorder = async (categoryId: string, entryId: number, direction: 'up' | 'down') => {
    const items = entriesByCategory[categoryId];
    if (!items) return;
    const idx = items.findIndex(i => i.id === entryId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    try {
      await updateKnowledge({
        storeDomain,
        knowledgeId: entryId,
        data: { sortOrder: items[swapIdx].sortOrder }
      });
      await updateKnowledge({
        storeDomain,
        knowledgeId: items[swapIdx].id,
        data: { sortOrder: items[idx].sortOrder }
      });
      refetch();
    } catch {
      toast({ title: "Failed to reorder", variant: "destructive" });
    }
  };

  const allEntries = (knowledgeList ?? []) as KnowledgeEntry[];

  const allTags = Array.from(new Set(allEntries.flatMap(e => e.tags ?? [])));

  const filteredEntries = allEntries.filter(entry => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = entry.title.toLowerCase().includes(q);
      const matchesContent = entry.content.toLowerCase().includes(q);
      const matchesTags = (entry.tags ?? []).some(t => t.toLowerCase().includes(q));
      if (!matchesTitle && !matchesContent && !matchesTags) return false;
    }
    if (searchTag && !(entry.tags ?? []).includes(searchTag)) return false;
    return true;
  });

  const entriesByCategory: Record<string, KnowledgeEntry[]> = {};
  for (const entry of filteredEntries) {
    if (!entriesByCategory[entry.category]) entriesByCategory[entry.category] = [];
    entriesByCategory[entry.category].push(entry);
  }
  for (const cat of Object.keys(entriesByCategory)) {
    entriesByCategory[cat].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return (
    <section className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 md:p-8 border-b border-border/50 bg-secondary/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent/20 text-accent-foreground rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Shop Knowledge Base</h2>
          {dataUpdatedAt > 0 && <LastUpdated dataUpdatedAt={dataUpdatedAt} />}
        </div>
        <p className="text-muted-foreground">Teach your AI agent about your business, products, and policies so it can provide expert guidance.</p>
      </div>

      <div className="p-6 md:p-8 space-y-10">
        <ShopifySyncSettings storeDomain={storeDomain} />

        <BulkKnowledgeImport storeDomain={storeDomain} />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries by title, content, or tag..."
              className="pl-9 rounded-xl bg-background"
            />
          </div>
          {allTags.length > 0 && (
            <Select value={searchTag} onValueChange={(v) => setSearchTag(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-48 rounded-xl bg-background">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="p-5 border-2 border-dashed border-border rounded-2xl bg-background/50 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Add New Instruction
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Title</Label>
              <Input 
                placeholder="e.g. Mini Split Sizing Guide" 
                value={newTitle} 
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl bg-background"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Detailed Instructions</Label>
            <Textarea 
              placeholder="e.g. For rooms under 350 sq ft, always recommend a 9K BTU unit. Emphasize that installation requires a professional."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-[100px] rounded-xl resize-y bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput tags={newTags} onChange={setNewTags} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={creating} className="rounded-xl">
              Add to Knowledge Base
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {CATEGORIES.map(cat => {
            const items = entriesByCategory[cat.id] || [];
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
                    {cat.label}
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground font-medium">{items.length}</span>
                  </h4>
                  <p className="text-sm text-muted-foreground">{cat.desc}</p>
                </div>
                
                <div className="grid gap-3">
                  {items.map((item, itemIdx) => (
                    <div key={item.id} className="group flex gap-4 p-4 rounded-xl bg-secondary/20 border border-border/50 hover:border-primary/30 transition-colors">
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <button
                          disabled={itemIdx === 0}
                          onClick={() => handleReorder(cat.id, item.id, 'up')}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Move ${item.title} up`}
                        >
                          <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          disabled={itemIdx === items.length - 1}
                          onClick={() => handleReorder(cat.id, item.id, 'down')}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Move ${item.title} down`}
                        >
                          <ArrowDown className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="flex-1">
                        {editingId === item.id ? (
                          <div className="space-y-3">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="rounded-lg"
                            />
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="rounded-lg min-h-[80px]"
                            />
                            <TagInput tags={editTags} onChange={setEditTags} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit} className="rounded-lg">
                                <Check className="w-3 h-3 mr-1" /> Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="rounded-lg">
                                <X className="w-3 h-3 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-sm">{item.title}</h5>
                              {item.source === "synced" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-medium">
                                  <Cloud className="w-3 h-3" />
                                  Synced
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                            {(item.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium"
                                  >
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.source === "synced" && item.lastSyncedAt && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Last synced: {new Date(item.lastSyncedAt).toLocaleString()}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {editingId !== item.id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => startEdit(item)}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 -mt-1"
                            aria-label={`Edit ${item.title}`}
                          >
                            {item.source === "synced" ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                            ) : (
                              <Edit2 className="w-4 h-4" aria-hidden="true" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(item.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1"
                            aria-label={`Delete ${item.title}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {deletedList && (deletedList as KnowledgeEntry[]).length > 0 && (
          <div className="space-y-4">
            <button
              onClick={() => setShowDeleted(!showDeleted)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="w-4 h-4" />
              Recently Deleted ({(deletedList as KnowledgeEntry[]).length})
              <span className="text-xs">{showDeleted ? "Hide" : "Show"}</span>
            </button>
            {showDeleted && (
              <div className="grid gap-3">
                {(deletedList as KnowledgeEntry[]).map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                    <div className="flex-1 opacity-60">
                      <h5 className="font-semibold text-sm mb-1">{item.title}</h5>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {CATEGORIES.find(c => c.id === item.category)?.label ?? item.category}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(item.id)}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </section>
  );
}
