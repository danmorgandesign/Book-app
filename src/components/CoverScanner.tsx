import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Camera, Loader2 } from "lucide-react";

interface Props {
  onCapture: (imageBase64: string) => Promise<void> | void;
  onClose: () => void;
}

export function CoverScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not access camera.",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setWorking(true);
    try {
      const maxDim = 1024;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      await onCapture(dataUrl);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Snap the front cover</span>
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
          <div className="h-[70%] w-[55%] max-w-sm rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-x-4 bottom-24 rounded-lg bg-destructive p-4 text-sm text-destructive-foreground">
            {error}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 px-4 pb-8 pt-4">
        <p className="text-center text-xs text-white/70">
          Fill the frame with the cover, then tap to identify.
        </p>
        <Button
          size="lg"
          onClick={handleCapture}
          disabled={working || !!error}
          className="h-14 w-full max-w-xs gap-2 text-base"
        >
          {working ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Identifying…
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" /> Capture cover
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
