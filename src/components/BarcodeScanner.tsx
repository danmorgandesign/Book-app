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
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 500,
    });

    let controls: { stop: () => void } | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (!videoRef.current) return;

        // Request rear camera with high resolution and continuous autofocus.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // Non-standard but widely supported hints for better barcode scanning
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ focusMode: "continuous", advanced: [{ focusMode: "continuous" }] } as any),
          },
        });

        // Apply continuous-focus and other capabilities post-hoc if supported.
        const track = stream.getVideoTracks()[0];
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const caps: any = track.getCapabilities?.() ?? {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const advanced: any[] = [];
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
            advanced.push({ focusMode: "continuous" });
          }
          if (caps.exposureMode && caps.exposureMode.includes?.("continuous")) {
            advanced.push({ exposureMode: "continuous" });
          }
          if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes?.("continuous")) {
            advanced.push({ whiteBalanceMode: "continuous" });
          }
          if (advanced.length) {
            await track.applyConstraints({ advanced } as MediaTrackConstraints);
          }
        } catch {
          // ignore — focus controls aren't available on this device
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});

        controls = await reader.decodeFromStream(
          stream,
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
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  // Tap-to-focus: nudge the camera to refocus where the user taps.
  async function handleTapFocus() {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps: any = track.getCapabilities?.() ?? {};
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes("single-shot")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "single-shot" }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        // Return to continuous after the single-shot lock.
        setTimeout(() => {
          if (caps.focusMode.includes("continuous")) {
            track
              .applyConstraints({
                advanced: [{ focusMode: "continuous" }],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any)
              .catch(() => {});
          }
        }, 800);
      }
    } catch {
      // ignore
    }
  }

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
      <div className="relative flex-1 overflow-hidden" onClick={handleTapFocus}>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
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
        Hold ~15&nbsp;cm away so the barcode fills the box. Tap the screen to refocus.
      </p>
    </div>
  );
}
