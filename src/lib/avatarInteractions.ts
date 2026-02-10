// Drag positioning + live mic → lip-sync + speaking glow for glTF avatar
import * as THREE from 'three';

type ViewerLike = {
  scene: THREE.Scene;
  gltf: any;
  camera?: THREE.Camera;
  renderer?: THREE.Renderer;
  composer?: any;
};

type Options = {
  camera?: THREE.Camera;
  renderer?: THREE.Renderer;
  domElement?: HTMLElement;
  mouthMorphNames?: string[];
  jawBoneName?: string;
  morphSmooth?: number;
  micSmoothing?: number;
  micGain?: number;
  glowMaterialNames?: string[];
};

export async function attachAvatarInteractions(
  container: HTMLElement,
  viewer: ViewerLike,
  options: Partial<Options> = {}
) {
  const opts: Options = {
    camera: options.camera ?? (viewer as any).camera,
    renderer: options.renderer ?? (viewer as any).renderer,
    domElement: options.domElement ?? container,
    mouthMorphNames: options.mouthMorphNames ?? [
      'mouthOpen', 'JawOpen', 'v_mouthOpen', 'mouth_A', 'MouthOpen', 'Aa', 'OPEN',
    ],
    jawBoneName: options.jawBoneName ?? 'Jaw',
    morphSmooth: options.morphSmooth ?? 0.12,
    micSmoothing: options.micSmoothing ?? 0.12,
    micGain: options.micGain ?? 3.0,
    glowMaterialNames: options.glowMaterialNames ?? [],
  };

  const model = viewer.gltf ? viewer.gltf.scene : viewer.scene;
  if (!model) throw new Error('No model found on viewer to attach interactions.');

  // --- Drag to reposition ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging = false;
  const dragOffset = new THREE.Vector3();
  const dragPlane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();
  const intersectionPoint = new THREE.Vector3();

  function getCamera() {
    return opts.camera ?? (viewer as any).camera;
  }

  function toPointer(event: PointerEvent) {
    const rect = (opts.domElement as HTMLElement).getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(event: PointerEvent) {
    toPointer(event);
    const cam = getCamera();
    if (!cam) return;
    raycaster.setFromCamera(pointer, cam);
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
      dragging = true;
      intersectionPoint.copy(intersects[0].point);
      planeNormal.copy(cam.getWorldDirection(new THREE.Vector3())).negate();
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, intersectionPoint);
      dragOffset.copy(intersectionPoint).sub(model.position);
      (opts.domElement as HTMLElement).setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    toPointer(event);
    const cam = getCamera();
    if (!cam) return;
    raycaster.setFromCamera(pointer, cam);
    if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
      const newPos = intersectionPoint.clone().sub(dragOffset);
      model.position.lerp(newPos, 0.6);
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (dragging) {
      dragging = false;
      try {
        (opts.domElement as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {}
    }
  }

  const el = opts.domElement as HTMLElement;
  el.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // --- Lip-sync (microphone) ---
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let micStream: MediaStream | null = null;
  let micEnabled = false;
  let animationId: number | null = null;
  let smoothedRMS = 0;

  // Find morph target candidates
  interface MorphTargetCandidate {
    mesh: THREE.Mesh;
    index: number;
    name: string;
  }
  const morphCandidates: MorphTargetCandidate[] = [];

  model.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      const dict = (mesh as any).morphTargetDictionary;
      if (dict) {
        for (const candidateName of opts.mouthMorphNames!) {
          if (candidateName in dict) {
            morphCandidates.push({ mesh, index: dict[candidateName], name: candidateName });
          }
        }
        for (const [name, idx] of Object.entries(dict)) {
          const low = name.toLowerCase();
          if (
            low.includes('mouth') || low.includes('jaw') ||
            low.includes('aa') || low.includes('open')
          ) {
            if (!morphCandidates.some((mc) => mc.mesh === mesh && mc.index === idx)) {
              morphCandidates.push({ mesh, index: idx as number, name });
            }
          }
        }
      }
    }
  });

  // Jaw bone fallback
  let jawBone: THREE.Bone | null = null;
  model.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Bone).isBone) {
      const bn = node as THREE.Bone;
      if (bn.name.toLowerCase().includes(opts.jawBoneName!.toLowerCase())) {
        jawBone = bn;
      }
    }
  });

  // Glow materials
  const glowMaterials: any[] = [];
  if (opts.glowMaterialNames && opts.glowMaterialNames.length) {
    model.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mats = Array.isArray((node as THREE.Mesh).material)
          ? (node as THREE.Mesh).material
          : [(node as THREE.Mesh).material];
        (mats as any[]).forEach((m: any) => {
          if (m && opts.glowMaterialNames!.some((n) => (m.name || '').includes(n))) {
            glowMaterials.push(m);
          }
        });
      }
    });
  } else {
    model.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mat = (node as THREE.Mesh).material as any;
        if (mat && 'emissive' in mat) glowMaterials.push(mat);
      }
    });
  }

  let state: 'idle' | 'listening' | 'speaking' | 'thinking' = 'idle';

  function setState(s: typeof state) {
    state = s;
  }

  function computeRMS(timeDomain: Uint8Array) {
    let sum = 0;
    for (let i = 0; i < timeDomain.length; i++) {
      const v = (timeDomain[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / timeDomain.length);
  }

  async function startMic() {
    if (micEnabled) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      console.error('Microphone access denied or not available', err);
      return;
    }
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode = audioCtx.createMediaStreamSource(micStream);
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 1.0;
    sourceNode.connect(gainNode);
    gainNode.connect(analyser);
    micEnabled = true;
    setState('listening');

    const data = new Uint8Array(analyser.fftSize);

    function audioLoop() {
      if (!micEnabled || !analyser) return;
      analyser.getByteTimeDomainData(data);
      const rms = computeRMS(data);
      smoothedRMS = smoothedRMS * (1 - opts.micSmoothing!) + rms * opts.micSmoothing!;
      const scaled = Math.min(1, smoothedRMS * opts.micGain! * 3.5);

      // Apply to morph targets
      if (morphCandidates.length > 0) {
        for (const mc of morphCandidates) {
          const mesh = mc.mesh as any;
          mesh.morphTargetInfluences = mesh.morphTargetInfluences || [];
          mesh.morphTargetInfluences[mc.index] =
            (mesh.morphTargetInfluences[mc.index] || 0) * (1 - opts.morphSmooth!) +
            scaled * opts.morphSmooth!;
        }
      } else if (jawBone) {
        jawBone.rotation.x = THREE.MathUtils.lerp(jawBone.rotation.x, -0.45 * scaled, 0.2);
      } else {
        model.scale.setScalar(THREE.MathUtils.lerp(model.scale.x, 1 + scaled * 0.02, 0.18));
      }

      // Glow modulation
      const isSpeakingNow = scaled > 0.02;
      if (state === 'speaking' || isSpeakingNow) {
        for (const gm of glowMaterials) {
          if (gm && 'emissiveIntensity' in gm) {
            gm.emissiveIntensity = THREE.MathUtils.lerp(
              gm.emissiveIntensity || 1,
              1.0 + scaled * 2.5,
              0.25
            );
          }
        }
      } else {
        for (const gm of glowMaterials) {
          if (gm && 'emissiveIntensity' in gm) {
            gm.emissiveIntensity = THREE.MathUtils.lerp(gm.emissiveIntensity || 1, 0.6, 0.08);
          }
        }
      }

      animationId = requestAnimationFrame(audioLoop);
    }
    audioLoop();
  }

  function stopMic() {
    if (!micEnabled) return;
    micEnabled = false;
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
    if (analyser) { analyser.disconnect(); analyser = null; }
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }

    morphCandidates.forEach((mc) => {
      const mesh = mc.mesh as any;
      if (mesh?.morphTargetInfluences) {
        mesh.morphTargetInfluences[mc.index] = 0;
      }
    });
    if (jawBone) jawBone.rotation.x = 0;
    setState('idle');
  }

  return {
    startMic,
    stopMic,
    isMicEnabled: () => micEnabled,
    setState,
    dispose: () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      stopMic();
    },
  };
}
