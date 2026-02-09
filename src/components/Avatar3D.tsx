import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, Float } from "@react-three/drei";
import * as THREE from "three";
import avatarImage from "@/assets/avatar.png";

// ─── Floating particles around the avatar ───
function Particles({ count = 80, isActive }: { count?: number; isActive: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 3
      ),
      speed: 0.2 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
      scale: 0.01 + Math.random() * 0.025,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      const x = p.position.x + Math.sin(t * p.speed + p.offset) * 0.3;
      const y = p.position.y + Math.cos(t * p.speed * 0.7 + p.offset) * 0.3;
      const z = p.position.z + Math.sin(t * p.speed * 0.5) * 0.2;
      dummy.position.set(x, y, z);
      const s = p.scale * (isActive ? 1.5 : 1);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
    </instancedMesh>
  );
}

// ─── Glowing ring around avatar ───
function GlowRing({ isListening, isSpeaking }: { isListening: boolean; isSpeaking: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = isListening ? 0.08 : isSpeaking ? 0.05 : 0.02;
    const speed = isListening ? 3 : isSpeaking ? 2 : 1;
    ringRef.current.scale.setScalar(1 + Math.sin(t * speed) * pulse);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
      0.3 + Math.sin(t * speed) * 0.15;
  });

  const color = isListening ? "#f59e0b" : isSpeaking ? "#38bdf8" : "#334155";

  return (
    <mesh ref={ringRef} position={[0, 0, -0.05]}>
      <ringGeometry args={[1.55, 1.65, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Second outer ring ───
function OuterRing({ isListening, isSpeaking }: { isListening: boolean; isSpeaking: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    ringRef.current.rotation.z = t * 0.2;
    const pulse = isListening ? 0.06 : isSpeaking ? 0.04 : 0.01;
    ringRef.current.scale.setScalar(1 + Math.sin(t * 1.5 + 1) * pulse);
  });

  return (
    <mesh ref={ringRef} position={[0, 0, -0.06]}>
      <ringGeometry args={[1.7, 1.75, 6]} />
      <meshBasicMaterial
        color={isListening ? "#f59e0b" : "#38bdf8"}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Avatar image on circular plane ───
function AvatarPlane({ isSpeaking }: { isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(avatarImage);

  // Create circular clipping via alpha map
  const alphaMap = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    // Subtle breathing scale
    const breathe = isSpeaking ? 0.03 : 0.01;
    const speed = isSpeaking ? 2.5 : 1;
    meshRef.current.scale.setScalar(1 + Math.sin(t * speed) * breathe);
    // Subtle head tilt when speaking
    if (isSpeaking) {
      meshRef.current.rotation.z = Math.sin(t * 1.8) * 0.02;
      meshRef.current.rotation.y = Math.sin(t * 1.2) * 0.03;
    } else {
      meshRef.current.rotation.z *= 0.95;
      meshRef.current.rotation.y *= 0.95;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[3, 3]} />
      <meshBasicMaterial map={texture} alphaMap={alphaMap} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Sound wave visualizer bars (3D) ───
function SoundWave3D({ isListening }: { isListening: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const barCount = 9;

  useFrame(({ clock }) => {
    if (!groupRef.current || !isListening) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const h = 0.05 + Math.abs(Math.sin(t * 5 + i * 0.6)) * 0.35;
      mesh.scale.y = h;
      mesh.position.y = -1.9 + h * 0.5;
    });
  });

  if (!isListening) return null;

  return (
    <group ref={groupRef}>
      {Array.from({ length: barCount }).map((_, i) => (
        <mesh key={i} position={[(i - barCount / 2) * 0.12, -1.9, 0.1]}>
          <boxGeometry args={[0.06, 1, 0.06]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Lip sync mouth overlay ───
function LipSyncOverlay({ isSpeaking }: { isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isSpeaking) {
      const t = clock.getElapsedTime();
      // Simulate mouth opening/closing at varying speeds
      const openAmount = Math.abs(Math.sin(t * 8)) * 0.06 + Math.abs(Math.sin(t * 12.5)) * 0.03;
      meshRef.current.scale.y = 0.5 + openAmount * 8;
      meshRef.current.scale.x = 1 + Math.sin(t * 6) * 0.1;
      meshRef.current.visible = true;
    } else {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -0.45, 0.02]} scale={[1, 0.5, 1]}>
      <circleGeometry args={[0.15, 32]} />
      <meshBasicMaterial color="#1a1a2e" transparent opacity={0.6} />
    </mesh>
  );
}

// ─── Background grid ───
function BackgroundGrid() {
  const ref = useRef<THREE.GridHelper>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as THREE.Material).opacity = 0.05 + Math.sin(clock.getElapsedTime() * 0.5) * 0.02;
  });

  return (
    <gridHelper
      ref={ref}
      args={[20, 40, "#38bdf8", "#38bdf8"]}
      position={[0, -3, -2]}
      rotation={[Math.PI / 6, 0, 0]}
    />
  );
}

// ─── Camera auto-adjust ───
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ─── Main 3D Scene ───
function Scene({
  isListening,
  isSpeaking,
  isThinking,
}: {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
}) {
  return (
    <>
      <CameraSetup />
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={0.8} color="#38bdf8" />
      <pointLight position={[-3, -2, 2]} intensity={0.4} color="#f59e0b" />

      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.3}>
        <AvatarPlane isSpeaking={isSpeaking} />
        <LipSyncOverlay isSpeaking={isSpeaking} />
        <GlowRing isListening={isListening} isSpeaking={isSpeaking} />
        <OuterRing isListening={isListening} isSpeaking={isSpeaking} />
      </Float>

      <SoundWave3D isListening={isListening} />
      <Particles isActive={isListening || isSpeaking || isThinking} />
      <BackgroundGrid />
    </>
  );
}

// ─── Exported Component ───
interface Avatar3DProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
}

const Avatar3D = ({ isListening, isSpeaking, isThinking }: Avatar3DProps) => {
  return (
    <div className="relative w-full" style={{ height: "340px" }}>
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <Scene isListening={isListening} isSpeaking={isSpeaking} isThinking={isThinking} />
      </Canvas>

      {/* Status overlay */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
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
