import { useState, useCallback, useRef, memo } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface ImageUploadButtonProps {
  onImageSelected: (base64: string) => void;
  onImageCleared: () => void;
  imagePreview: string | null;
  disabled?: boolean;
  visionSupported?: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImageUploadButton = memo(function ImageUploadButton({
  onImageSelected,
  onImageCleared,
  imagePreview,
  disabled,
  visionSupported = true,
}: ImageUploadButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Please upload a JPEG, PNG, WebP, or GIF image.");
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setError("Image must be less than 4MB.");
        return;
      }

      setError(null);
      setProcessing(true);

      try {
        const base64 = await fileToBase64(file);
        onImageSelected(base64);
      } catch {
        setError("Failed to process image. Please try again.");
      } finally {
        setProcessing(false);
      }
    },
    [onImageSelected],
  );

  const handleClick = useCallback(() => {
    if (!visionSupported) {
      setError("Visual search is not available for this store's AI configuration.");
      return;
    }
    setError(null);
    fileInputRef.current?.click();
  }, [visionSupported]);

  const handleClear = useCallback(() => {
    setError(null);
    onImageCleared();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onImageCleared]);

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {imagePreview ? (
        <div className="relative inline-flex items-center gap-1">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-border">
            <img
              src={imagePreview}
              alt="Selected product"
              className="w-full h-full object-cover"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="min-w-[28px] min-h-[28px] w-7 h-7 rounded-full"
            aria-label="Remove image"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={disabled || processing}
          className="rounded-xl min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
          aria-label="Upload image for visual search"
          title="Upload image to search for similar products"
        >
          {processing ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="w-4 h-4" aria-hidden="true" />
          )}
        </Button>
      )}

      {error && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-destructive/10 text-destructive text-xs rounded-lg whitespace-nowrap max-w-[250px]">
          {error}
        </div>
      )}
    </div>
  );
});
