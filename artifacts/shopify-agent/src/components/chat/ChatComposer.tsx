import { memo, useState, useCallback } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "./VoiceInputButton";
import { ImageUploadButton } from "./ImageUploadButton";

interface ChatComposerProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onImageSubmit?: (imageBase64: string, message: string) => void;
  visionSupported?: boolean;
}

export const ChatComposer = memo(function ChatComposer({ input, isLoading, onInputChange, onSubmit, onImageSubmit, visionSupported }: ChatComposerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  const handleVoiceTranscript = useCallback((text: string) => {
    onInputChange(text);
  }, [onInputChange]);

  const handleImageSelected = useCallback((base64: string) => {
    setImagePreview(base64);
  }, []);

  const handleImageCleared = useCallback(() => {
    setImagePreview(null);
  }, []);

  const handleFormSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (imagePreview && onImageSubmit) {
      const message = input.trim() || "Find products similar to this image";
      onImageSubmit(imagePreview, message);
      setImagePreview(null);
      onInputChange("");
    } else {
      onSubmit(e);
    }
  }, [imagePreview, onImageSubmit, input, onSubmit, onInputChange]);

  const canSend = imagePreview ? !isLoading : !!(input.trim()) && !isLoading;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-background via-background to-transparent pt-10 mb-[var(--bottom-nav-height)] md:mb-0">
      <div className="max-w-4xl mx-auto relative">
        {imagePreview && (
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shadow-sm">
              <img src={imagePreview} alt="Image to search" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleImageCleared}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">Image attached — send to search for similar products</span>
          </div>
        )}
        <form 
          onSubmit={handleFormSubmit}
          className="relative flex items-end bg-card border border-border shadow-xl shadow-black/5 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
        >
          <div className="flex items-center gap-1 pl-2 pb-2 pt-2">
            <VoiceInputButton onTranscript={handleVoiceTranscript} disabled={isLoading} />
            <ImageUploadButton
              onImageSelected={handleImageSelected}
              onImageCleared={handleImageCleared}
              imagePreview={null}
              disabled={isLoading}
              visionSupported={visionSupported}
            />
          </div>
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={imagePreview ? "Add a description (optional)..." : "Ask about products, sizing, or policies..."}
            className="min-h-[60px] max-h-[200px] w-full resize-none border-0 focus-visible:ring-0 bg-transparent py-4 pl-2 pr-14"
            rows={1}
            aria-label="Message input"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!canSend}
            className="absolute right-2 bottom-2 rounded-xl bg-primary text-white hover:bg-primary/90"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </Button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Powered by Shopify MCP Agent
          </span>
        </div>
      </div>
    </div>
  );
});
