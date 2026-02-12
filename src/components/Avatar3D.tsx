import { useRef, useEffect, useState, useCallback } from "react";
import { createAvatarViewer, AvatarViewer } from "@/lib/gltfViewer";
import { attachAvatarInteractions } from "@/lib/avatarInteractions";

const DEFAULT_GLB_URL = "/698bdd8efcad0d2f33536b28.glb";

const ZINDEX_KEY = "aura-overlay-zindex";

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AvatarViewer | null>(null);
  const interactionsRef = useRef<Awaited<ReturnType<typeof attachAvatarInteractions>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Scale (pinch / scroll zoom)
  const [scale, setScale] = useState(1);

  // Z-index from localStorage
  const [zIndex, setZIndex] = useState(() => {
    const stored = localStorage.getItem(ZINDEX_KEY);
    return stored ? parseInt(stored, 10) : 9999;
  });

  // Listen for storage changes (from Settings page)
  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem(ZINDEX_KEY);
      if (stored) setZIndex(parseInt(stored, 10));
    };
    window.addEventListener("storage", handler);
    // Also poll for same-tab changes
    const interval = setInterval(handler, 1000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  // Drag to move the overlay
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from the wrapper background, not the 3D canvas interaction
    if (e.target !== wrapperRef.current) return;
    dragState.current = {
      dragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
      offsetX: position.x,
      offsetY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    setPosition({
      x: e.clientX - dragState.current.startX,
      y: e.clientY - dragState.current.startY,
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  // Scroll to zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.001)));
  }, []);

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
      .then(async (viewer) => {
        if (disposed) { viewer.dispose(); return; }
        viewerRef.current = viewer;

        const interactions = await attachAvatarInteractions(containerRef.current!, viewer);
        if (disposed) { interactions.dispose(); return; }
        interactionsRef.current = interactions;
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
      interactionsRef.current?.dispose();
      interactionsRef.current = null;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [glbUrl]);

  // Sync states
  useEffect(() => {
    viewerRef.current?.setListening(isListening);
    interactionsRef.current?.setState(isListening ? "listening" : "idle");
    if (isListening) {
      interactionsRef.current?.startMic();
    } else {
      interactionsRef.current?.stopMic();
    }
  }, [isListening]);

  useEffect(() => {
    viewerRef.current?.setSpeaking(isSpeaking);
    interactionsRef.current?.setState(isSpeaking ? "speaking" : "idle");
  }, [isSpeaking]);

  useEffect(() => {
    viewerRef.current?.setThinking(isThinking);
    interactionsRef.current?.setState(isThinking ? "thinking" : "idle");
  }, [isThinking]);

  return (
    <div
      ref={wrapperRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      className="absolute inset-0 pointer-events-auto"
      style={{
        zIndex: 1,
        background: "transparent",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
          transformOrigin: "center center",
          width: "100vw",
          height: "100vh",
          transition: dragState.current.dragging ? "none" : "transform 0.1s ease-out",
        }}
      >
        {/* 3D Viewer - no frame, no background */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ background: "transparent" }}
        />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
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
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Avatar3D;
