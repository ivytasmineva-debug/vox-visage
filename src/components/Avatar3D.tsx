import { useRef, useEffect, useState, useCallback } from "react";
import { createAvatarViewer, AvatarViewer } from "@/lib/gltfViewer";
import { attachAvatarInteractions } from "@/lib/avatarInteractions";
import { Move, RotateCcw } from "lucide-react";

const DEFAULT_GLB_URL = "/698bdd8efcad0d2f33536b28.glb";

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
  const handleRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AvatarViewer | null>(null);
  const interactionsRef = useRef<
    Awaited<ReturnType<typeof attachAvatarInteractions>> | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const dragState = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
  });

  const lastTapRef = useRef(0);

  /* -------------------- Reset -------------------- */
  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  /* -------------------- Drag Logic -------------------- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragState.current = {
        dragging: true,
        startX: e.clientX - position.x,
        startY: e.clientY - position.y,
      };

      handleRef.current?.setPointerCapture(e.pointerId);

      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        resetPosition();
        dragState.current.dragging = false;
      }
      lastTapRef.current = now;
    },
    [position, resetPosition]
  );

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
    handleRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  /* -------------------- Initialize Viewer -------------------- */
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
        if (disposed) {
          viewer.dispose();
          return;
        }

        viewerRef.current = viewer;

        const interactions = await attachAvatarInteractions(
          containerRef.current!,
          viewer
        );

        if (disposed) {
          interactions.dispose();
          return;
        }

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

  /* -------------------- Sync States -------------------- */
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

  /* -------------------- Render -------------------- */
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Movable container */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${position.x}px)`,
          top: `calc(50% + ${position.y}px)`,
          transform: "translate(-50%, -50%)",
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
          touchAction: "none",
        }}
        onDoubleClick={resetPosition}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ background: "transparent" }}
        />

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground font-display tracking-wider">
                Loading 3D Avatar...
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}
      </div>

      {/* Drag Handle */}
      {!loading && !error && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2"
          style={{ pointerEvents: "auto" }}
        >
          <div
            ref={handleRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border/30 text-muted-foreground text-xs select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <Move size={14} />
            <span>ড্র্যাগ করুন</span>
          </div>

          {(position.x !== 0 || position.y !== 0) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetPosition();
              }}
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
        
