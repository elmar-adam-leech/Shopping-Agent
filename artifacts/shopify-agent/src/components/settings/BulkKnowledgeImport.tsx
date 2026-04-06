import { useState, useRef } from "react";
import { useCreateKnowledge, getListKnowledgeQueryKey } from "@workspace/api-client-react";
import { Upload, FileUp, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIES } from "./KnowledgeEditor";

type KnowledgeCategory = "general" | "sizing" | "compatibility" | "required_accessories" | "restrictions" | "policies" | "custom";

interface ParsedEntry {
  title: string;
  content: string;
}

function parseMarkdownEntries(text: string): ParsedEntry[] {
  const lines = text.split("\n");
  const entries: ParsedEntry[] = [];
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentTitle && currentContent.length > 0) {
        entries.push({
          title: currentTitle.trim(),
          content: currentContent.join("\n").trim(),
        });
      }
      currentTitle = headingMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle && currentContent.length > 0) {
    entries.push({
      title: currentTitle.trim(),
      content: currentContent.join("\n").trim(),
    });
  }

  if (entries.length === 0 && text.trim()) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      const firstLine = para.split("\n")[0];
      const rest = para.split("\n").slice(1).join("\n").trim();
      entries.push({
        title: rest ? firstLine : `Entry ${i + 1}`,
        content: rest || firstLine,
      });
    }
  }

  return entries.filter(e => e.title && e.content);
}

export function BulkKnowledgeImport({ storeDomain }: { storeDomain: string }) {
  const { mutateAsync: createKnowledge } = useCreateKnowledge();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bulkText, setBulkText] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  const handleParse = () => {
    const entries = parseMarkdownEntries(bulkText);
    setParsedEntries(entries);
    setImportComplete(false);
    if (entries.length === 0) {
      toast({ title: "No entries found", description: "Use markdown headings (# or ##) to separate entries, or separate with blank lines.", variant: "destructive" });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBulkText(text);
      const entries = parseMarkdownEntries(text);
      setParsedEntries(entries);
      setImportComplete(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (parsedEntries.length === 0) return;
    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < parsedEntries.length; i++) {
      const entry = parsedEntries[i];
      try {
        await createKnowledge({
          storeDomain,
          data: {
            title: entry.title,
            content: entry.content,
            category: category as KnowledgeCategory,
            sortOrder: i,
          },
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setImporting(false);
    setImportComplete(true);
    queryClient.invalidateQueries({ queryKey: getListKnowledgeQueryKey(storeDomain) });

    if (failCount === 0) {
      toast({ title: `Imported ${successCount} entries successfully` });
      setBulkText("");
      setParsedEntries([]);
    } else {
      toast({
        title: `Import partially complete`,
        description: `${successCount} succeeded, ${failCount} failed`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-5 border-2 border-dashed border-border rounded-2xl bg-background/50 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Upload className="w-4 h-4 text-primary" /> Bulk Import
      </h3>
      <p className="text-sm text-muted-foreground">
        Paste markdown content or upload a file. Headings (# or ##) will be used to split content into separate knowledge entries.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          <Label>Category for imported entries</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="rounded-xl bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.markdown"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl gap-2"
          >
            <FileUp className="w-4 h-4" />
            Upload File (.md, .txt)
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Content</Label>
        <Textarea
          value={bulkText}
          onChange={(e) => {
            setBulkText(e.target.value);
            setParsedEntries([]);
            setImportComplete(false);
          }}
          placeholder={`# Return Policy\nWe accept returns within 30 days of purchase...\n\n# Shipping Information\nWe ship worldwide with free shipping on orders over $50...\n\n# Warranty\nAll products come with a 1-year manufacturer warranty...`}
          className="min-h-[160px] rounded-xl resize-y bg-background font-mono text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={handleParse}
          disabled={!bulkText.trim()}
          className="rounded-xl"
        >
          Preview Entries
        </Button>
        {parsedEntries.length > 0 && (
          <Button
            onClick={handleImport}
            disabled={importing || importComplete}
            className="rounded-xl gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : importComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Imported
              </>
            ) : (
              `Import ${parsedEntries.length} Entries`
            )}
          </Button>
        )}
      </div>

      {parsedEntries.length > 0 && !importComplete && (
        <div className="space-y-2 mt-4">
          <p className="text-sm font-medium text-muted-foreground">
            Preview: {parsedEntries.length} entries detected
          </p>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {parsedEntries.map((entry, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-secondary/20 border border-border/50">
                <p className="text-sm font-semibold">{entry.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
