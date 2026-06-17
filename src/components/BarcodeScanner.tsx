import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";

interface Props {
  onDetected: (isbn: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (!videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              controls?.stop();
              onDetected(text);
            }
          },
        );
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Could not access camera. Check browser permissions.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Point at a book's barcode</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-72 rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-x-4 bottom-6 rounded-lg bg-destructive p-4 text-sm text-destructive-foreground">
            {error}
          </div>
        )}
      </div>
      <p className="px-4 pb-6 pt-3 text-center text-xs text-white/70">
        Hold steady so the ISBN barcode (usually on the back) fits inside the box.
      </p>
    </div>
  );
}
