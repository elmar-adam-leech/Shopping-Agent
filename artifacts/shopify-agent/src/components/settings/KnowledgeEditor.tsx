import { useState } from "react";
import { useListKnowledge, useCreateKnowledge, useDeleteKnowledge, useUpdateKnowledge, getListKnowledgeQueryKey } from "@workspace/api-client-react";
import { Trash2, Plus, ArrowUp, ArrowDown, Edit2, Check, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BulkKnowledgeImport } from "./BulkKnowledgeImport";

interface KnowledgeEntry {
  id: number;
  storeDomain: string;
  category: string;
  title: string;
  content: string;
  sortOrder: number;
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

export function KnowledgeEditor({ storeDomain }: { storeDomain: string }) {
  const { data: knowledgeList, refetch } = useListKnowledge(storeDomain, undefined, {
    query: { queryKey: getListKnowledgeQueryKey(storeDomain), staleTime: 60_000 },
  });
  const { mutateAsync: createKnowledge, isPending: creating } = useCreateKnowledge();
  const { mutateAsync: deleteKnowledge } = useDeleteKnowledge();
  const { mutateAsync: updateKnowledge } = useUpdateKnowledge();
  const { toast } = useToast();

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!newTitle || !newContent) return;
    try {
      await createKnowledge({
        storeDomain,
        data: { title: newTitle, content: newContent, category: category as "general" | "sizing" | "compatibility" | "required_accessories" | "restrictions" | "policies" | "custom", sortOrder: 0 }
      });
      setNewTitle("");
      setNewContent("");
      refetch();
      toast({ title: "Knowledge entry added" });
    } catch {
      toast({ title: "Failed to add", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteKnowledge({ storeDomain, knowledgeId: id });
      refetch();
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const startEdit = (item: KnowledgeEntry) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle || !editContent) return;
    try {
      await updateKnowledge({
        storeDomain,
        knowledgeId: editingId,
        data: { title: editTitle, content: editContent }
      });
      cancelEdit();
      refetch();
      toast({ title: "Updated" });
    } catch {
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

  const entriesByCategory: Record<string, KnowledgeEntry[]> = {};
  if (knowledgeList) {
    for (const entry of knowledgeList as KnowledgeEntry[]) {
      if (!entriesByCategory[entry.category]) entriesByCategory[entry.category] = [];
      entriesByCategory[entry.category].push(entry);
    }
    for (const cat of Object.keys(entriesByCategory)) {
      entriesByCategory[cat].sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  return (
    <section className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 md:p-8 border-b border-border/50 bg-secondary/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent/20 text-accent-foreground rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Shop Knowledge Base</h2>
        </div>
        <p className="text-muted-foreground">Teach your AI agent about your business, products, and policies so it can provide expert guidance.</p>
      </div>

      <div className="p-6 md:p-8 space-y-10">
        <BulkKnowledgeImport storeDomain={storeDomain} />

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
                          className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Move ${item.title} up`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          disabled={itemIdx === items.length - 1}
                          onClick={() => handleReorder(cat.id, item.id, 'down')}
                          className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Move ${item.title} down`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
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
                            <h5 className="font-semibold text-sm mb-1">{item.title}</h5>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
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
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
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

      </div>
    </section>
  );
}
