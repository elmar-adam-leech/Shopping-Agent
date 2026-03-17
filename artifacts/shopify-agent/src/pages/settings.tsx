import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetStore, useUpdateStore, useListKnowledge, useCreateKnowledge, useDeleteKnowledge } from "@workspace/api-client-react";
import { Save, Key, Database, BookOpen, Trash2, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function SettingsPage() {
  const [, params] = useRoute("/:storeDomain/settings");
  const storeDomain = params?.storeDomain || "";
  
  const { data: store, isLoading: storeLoading } = useGetStore(storeDomain);
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { toast } = useToast();

  const [provider, setProvider] = useState<any>("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (store) {
      setProvider(store.provider);
      setModel(store.model);
    }
  }, [store]);

  const handleSaveStore = async () => {
    try {
      await updateStore({
        storeDomain,
        data: {
          provider,
          model,
          ...(apiKey ? { apiKey } : {})
        }
      });
      toast({ title: "Settings saved successfully", variant: "default" });
      setApiKey(""); // clear after save
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout storeDomain={storeDomain}>
      <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-12">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Agent Settings</h1>
          <p className="text-muted-foreground text-lg">Configure the brain behind your AI shopping assistant.</p>
        </div>

        {/* LLM Config Section */}
        <section className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-display">Model Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <Label>AI Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="rounded-xl h-12 bg-secondary/20">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="xai">Grok (xAI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Model Version</Label>
              <Input 
                value={model} 
                onChange={(e) => setModel(e.target.value)} 
                className="rounded-xl h-12 bg-secondary/20"
                placeholder="e.g. gpt-4o, claude-3-sonnet"
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-3">
              <Label>API Key</Label>
              <div className="relative">
                <Input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={store?.hasApiKey ? "•••••••••••••••• (Key is set, enter new to replace)" : "Enter API Key"}
                  className="rounded-xl h-12 bg-secondary/20 pl-10"
                />
                <Key className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
              </div>
              <p className="text-xs text-muted-foreground">We encrypt and store your key securely. It is only used to power your store's agent.</p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleSaveStore} disabled={updating} className="rounded-xl px-8 shadow-lg shadow-primary/20">
              {updating ? "Saving..." : "Save Configuration"}
              <Save className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Shop Knowledge Editor */}
        <KnowledgeEditor storeDomain={storeDomain} />
      </div>
    </AppLayout>
  );
}

function KnowledgeEditor({ storeDomain }: { storeDomain: string }) {
  const { data: knowledgeList, refetch } = useListKnowledge(storeDomain);
  const { mutateAsync: createKnowledge, isPending: creating } = useCreateKnowledge();
  const { mutateAsync: deleteKnowledge } = useDeleteKnowledge();
  const { toast } = useToast();

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [category, setCategory] = useState<any>("general");

  const handleAdd = async () => {
    if (!newTitle || !newContent) return;
    try {
      await createKnowledge({
        storeDomain,
        data: { title: newTitle, content: newContent, category, sortOrder: 0 }
      });
      setNewTitle("");
      setNewContent("");
      refetch();
      toast({ title: "Knowledge entry added" });
    } catch (e) {
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

  // Group by category for rendering
  const entriesByCategory = knowledgeList?.reduce((acc: any, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {}) || {};

  const categories = [
    { id: 'general', label: 'General Info', desc: 'Brand voice, tone, company history' },
    { id: 'sizing', label: 'Sizing & Recommendations', desc: 'Rules for recommending products' },
    { id: 'compatibility', label: 'Compatibility Rules', desc: 'What works with what' },
    { id: 'policies', label: 'Store Policies', desc: 'Returns, shipping, warranties' },
  ];

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
        {/* Add New Entry Form */}
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
                  {categories.map(c => (
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

        {/* Render Entries by Category */}
        <div className="space-y-8">
          {categories.map(cat => {
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
                  {items.map((item: any) => (
                    <div key={item.id} className="group flex gap-4 p-4 rounded-xl bg-secondary/20 border border-border/50 hover:border-primary/30 transition-colors">
                      <div className="mt-1 cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground transition-colors">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-sm mb-1">{item.title}</h5>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(item.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
