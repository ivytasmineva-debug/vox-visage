import { useRef, useEffect, useState, useCallback } from "react";
import { createAvatarViewer, AvatarViewer } from "@/lib/gltfViewer";
import { attachAvatarInteractions } from "@/lib/avatarInteractions";
import { Move, RotateCcw } from "lucide-react";

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
  const dragState = useRef({ dragging: false, startX: 0, startY: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Scale (pinch / scroll zoom)
  const [scale, setScale] = useState(1);

  // Double-tap detection
  const lastTapRef = useRef(0);

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
    const interval = setInterval(handler, 1000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  // Reset helper
  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
  }, []);

  // Drag to move the overlay — capture on the wrapper, not e.target
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      dragging: true,
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    };
    wrapperRef.current?.setPointerCapture(e.pointerId);

    // Double-tap detection for touch
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      resetPosition();
      dragState.current.dragging = false;
    }
    lastTapRef.current = now;
  }, [position, resetPosition]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragState.current.startX,
      y: e.clientY - dragState.current.startY,
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.dragging = false;
    wrapperRef.current?.releasePointerCapture(e.pointerId);
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
      controls: false,
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
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={resetPosition}
      className="absolute left-0 top-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 1,
        background: "transparent",
      }}
    >
      {/* Floating movable container */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${position.x}px)`,
          top: `calc(50% + ${position.y}px)`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          width: "100vw",
          height: "100vh",
          pointerEvents: "auto",
          touchAction: "none",
          transition: dragState.current.dragging ? "none" : "transform 0.15s ease-out",
        }}
      >
        {/* 3D Viewer */}
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

      {/* Drag handle + reset button */}
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10" style={{ pointerEvents: "auto" }}>
          <div
            onPointerDown={onPointerDown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border/30 text-muted-foreground text-xs select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <Move size={14} />
            <span>ড্র্যাগ করুন</span>
          </div>
          {(position.x !== 0 || position.y !== 0 || scale !== 1) && (
            <button
              onClick={(e) => { e.stopPropagation(); resetPosition(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border/30 text-muted-foreground text-xs hover:text-foreground transition-colors"
            >
              <RotateCcw size={13} />
              <span>রিসেট</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Avatar3D;
