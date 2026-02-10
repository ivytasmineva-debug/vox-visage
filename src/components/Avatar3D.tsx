import { useRef, useEffect, useState } from "react";
import { createAvatarViewer, AvatarViewer } from "@/lib/gltfViewer";

// Default GLB model — replace with your own avatar URL
const DEFAULT_GLB_URL =
  "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb";

interface Avatar3DProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  glbUrl?: string;
}

const Avatar3D = ({
  isListening,
  isSpeaking,
  isThinking,
  glbUrl,
}: Avatar3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AvatarViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize viewer
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    setLoading(true);
    setError(null);

    createAvatarViewer(containerRef.current, glbUrl || DEFAULT_GLB_URL, {
      dracoDecoderPath: "https://www.gstatic.com/draco/v1/decoders/",
      bloomStrength: 0.6,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      controls: true,
    })
      .then((viewer) => {
        if (disposed) {
          viewer.dispose();
          return;
        }
        viewerRef.current = viewer;
        setLoading(false);
      })
      .catch((err) => {
        if (!disposed) {
          console.error("Avatar load error:", err);
          setError("3D মডেল লোড করতে ব্যর্থ");
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [glbUrl]);

  // Sync states
  useEffect(() => {
    viewerRef.current?.setListening(isListening);
  }, [isListening]);

  useEffect(() => {
    viewerRef.current?.setSpeaking(isSpeaking);
  }, [isSpeaking]);

  useEffect(() => {
    viewerRef.current?.setThinking(isThinking);
  }, [isThinking]);

  return (
    <div className="relative w-full">
      {/* 3D Viewer container */}
      <div
        ref={containerRef}
        className="viewer w-full rounded-xl overflow-hidden"
        style={{
          height: "480px",
          background: "transparent",
          boxShadow:
            "0 6px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground font-display tracking-wider">
              Loading 3D Avatar...
            </span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            isListening
              ? "bg-accent"
              : isSpeaking
              ? "bg-primary"
              : isThinking
              ? "bg-accent animate-pulse"
              : "bg-muted-foreground"
          }`}
        />
        <span className="text-xs text-muted-foreground font-display tracking-wider uppercase">
          {isListening
            ? "Listening..."
            : isSpeaking
            ? "Speaking..."
            : isThinking
            ? "Thinking..."
            : "Ready"}
        </span>
      </div>
    </div>
  );
};

export default Avatar3D;
