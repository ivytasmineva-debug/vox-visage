// avatarController.ts
// Enhances a glTF avatar with:
// - viseme mapping (morph targets) + jaw bone fallback
// - live mic -> lip sync (RMS based) with smoothing
// - speaking energy driven body micro‑motion (head/torso) and glow triggers
// - gesture clip triggering via AnimationMixer
//
// Usage:
//   const controller = await createAvatarController({ gltf, model, scene, camera, renderer, lipSync });
//   viewer.animate loop should call controller.update(delta);
//   controller.startMic(); controller.stopMic();
//   controller.setState('speaking'|'listening'|'thinking'|'idle');
//   controller.triggerGesture('wave');

import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import { LipSyncAnimator } from "./lipSync"; // your existing module

type ViewerLike = {
  gltf: GLTF;
  model: THREE.Object3D;
  scene: THREE.Scene;
  camera?: THREE.Camera;
  renderer?: THREE.Renderer;
  lipSync?: LipSyncAnimator;
};

type ControllerOptions = {
  mouthMorphCandidates?: string[];
  jawBoneNames?: string[];
  micSmoothing?: number;
  micGain?: number;
  morphSmooth?: number;
  gestureCooldown?: number;
  headIntensity?: number;
  torsoIntensity?: number;
};

export async function createAvatarController(
  viewer: ViewerLike,
  options: Partial<ControllerOptions> = {}
) {
  const opts: ControllerOptions = {
    mouthMorphCandidates: options.mouthMorphCandidates ?? ["v_mouthOpen", "mouthOpen", "MouthOpen", "Aa", "open", "jawOpen"],
    jawBoneNames: options.jawBoneNames ?? ["Jaw", "jaw", "mixamorig:Jaw", "Head_Jaw"],
    micSmoothing: options.micSmoothing ?? 0.12,
    micGain: options.micGain ?? 3.5,
    morphSmooth: options.morphSmooth ?? 0.12,
    gestureCooldown: options.gestureCooldown ?? 1.2,
    headIntensity: options.headIntensity ?? 0.9,
    torsoIntensity: options.torsoIntensity ?? 0.35,
  };

  const { gltf, model, scene } = viewer;
  const animations = gltf.animations ?? [];
  const mixer = new THREE.AnimationMixer(model);

  const clipsByName: Record<string, THREE.AnimationClip> = {};
  for (const clip of animations) clipsByName[clip.name] = clip;

  type MorphCandidate = { mesh: THREE.Mesh; index: number; name: string };
  const morphs: MorphCandidate[] = [];

  model.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      const mesh = n as THREE.Mesh;
      const dict = (mesh as any).morphTargetDictionary as Record<string, number> | undefined;
      if (dict) {
        for (const cand of opts.mouthMorphCandidates) {
          if (cand in dict) morphs.push({ mesh, index: dict[cand], name: cand });
        }
        for (const [nm, idx] of Object.entries(dict)) {
          const low = nm.toLowerCase();
          if (low.includes("mouth") || low.includes("jaw") || low.includes("aa") || low.includes("open")) {
            morphs.push({ mesh, index: idx as number, name: nm });
          }
        }
      }
    }
  });

  let jawBone: THREE.Bone | null = null;
  model.traverse((n) => {
    if ((n as THREE.Bone).isBone) {
      const b = n as THREE.Bone;
      const name = b.name || "";
      if (opts.jawBoneNames.some((jn) => name.toLowerCase().includes(jn.toLowerCase()))) {
        jawBone = b;
      }
    }
  });

  const glowMats: any[] = [];
  model.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      const mat = ((n as THREE.Mesh).material as any);
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m: any) => { if ("emissive" in m) glowMats.push(m); });
        else if ("emissive" in mat) glowMats.push(mat);
      }
    }
  });

  const lipSync = viewer.lipSync ?? null;

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let micStream: MediaStream | null = null;
  let micEnabled = false;
  const data = new Uint8Array(2048);
  let smoothed = 0;

  function computeRMS(buf: Uint8Array) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  async function startMic() {
    if (micEnabled) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      console.warn("Mic permission error", e);
      return;
    }
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode = audioCtx.createMediaStreamSource(micStream);
    sourceNode.connect(analyser);
    micEnabled = true;
  }

  function stopMic() {
    if (!micEnabled) return;
    micEnabled = false;
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    if (sourceNode) sourceNode.disconnect();
    if (analyser) analyser.disconnect();
    if (audioCtx) audioCtx.close();
    audioCtx = analyser = sourceNode = micStream = null;
    smoothed = 0;
    for (const m of morphs) {
      const mesh = m.mesh as any;
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[m.index] = 0;
    }
    if (jawBone) jawBone.rotation.x = 0;
  }

  let lastGestureTime = -999;
  function triggerGesture(name: string, fadeIn = 0.12, fadeOut = 0.18) {
    const clip = clipsByName[name];
    if (!clip) return false;
    const now = performance.now() / 1000;
    if (now - lastGestureTime < opts.gestureCooldown!) return false;
    lastGestureTime = now;
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 0);
    action.clampWhenFinished = true;
    action.fadeIn(fadeIn).play();
    setTimeout(() => action.fadeOut(fadeOut), (clip.duration * 1000) - fadeOut * 1000);
    return true;
  }

  let state: "idle" | "listening" | "speaking" | "thinking" = "idle";
  function setState(s: typeof state) { state = s; }

  function update(delta: number) {
    mixer.update(delta);

    let rms = 0;
    if (micEnabled && analyser) {
      analyser.getByteTimeDomainData(data);
      const r = computeRMS(data);
      smoothed = smoothed * (1 - opts.micSmoothing!) + r * opts.micSmoothing!;
      rms = Math.min(1, smoothed * opts.micGain! * 3.5);
      if (lipSync) {
        lipSync.setAmplitude(rms);
      } else if (morphs.length > 0) {
        for (const m of morphs) {
          const mesh: any = m.mesh;
          mesh.morphTargetInfluences = mesh.morphTargetInfluences || [];
          const cur = mesh.morphTargetInfluences[m.index] || 0;
          mesh.morphTargetInfluences[m.index] = THREE.MathUtils.lerp(cur, rms, opts.morphSmooth!);
        }
      } else if (jawBone) {
        jawBone.rotation.x = THREE.MathUtils.lerp(jawBone.rotation.x, -0.45 * rms, 0.18);
      }
      if (rms > 0.02) setState("speaking");
    } else {
      if (morphs.length > 0) {
        for (const m of morphs) {
          const mesh: any = m.mesh;
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences[m.index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[m.index] || 0, 0, 0.08);
          }
        }
      } else if (jawBone) {
        jawBone.rotation.x = THREE.MathUtils.lerp(jawBone.rotation.x, 0, 0.06);
      }
    }

    const time = performance.now() * 0.001;
    const speakIntensity = state === "speaking" ? (Math.min(1, rms * 3.0)) : 0;
    const head = findBoneByName(model, ["Head", "head", "mixamorig:Head"]);
    const neck = findBoneByName(model, ["Neck", "neck", "mixamorig:Neck"]);
    const spine = findBoneByName(model, ["Spine", "spine", "mixamorig:Spine"]);
    if (head) {
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, Math.sin(time * 2.5) * 0.006 * opts.headIntensity! * (1 + speakIntensity * 0.8), 0.12);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, Math.sin(time * 0.9) * 0.008 * opts.headIntensity! * speakIntensity, 0.08);
    }
    if (spine) {
      spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, Math.sin(time * 0.6) * 0.002 * opts.torsoIntensity! * speakIntensity, 0.08);
    }

    for (const gm of glowMats) {
      if (!gm) continue;
      const base = gm.emissiveIntensity ?? 1.0;
      let target = 0.3;
      if (state === "listening") target = 0.9;
      if (state === "speaking") target = 0.6 + (rms * 1.6);
      if (state === "thinking") target = 0.5;
      gm.emissiveIntensity = THREE.MathUtils.lerp(gm.emissiveIntensity ?? base, target, 0.08);
    }
  }

  function findBoneByName(root: THREE.Object3D, names: string[]) {
    let found: THREE.Bone | null = null;
    root.traverse((n) => {
      if (found) return;
      if ((n as THREE.Bone).isBone) {
        const b = n as THREE.Bone;
        const nm = (b.name || "").toLowerCase();
        for (const cand of names) {
          if (nm.includes(cand.toLowerCase())) { found = b; break; }
        }
      }
    });
    return found;
  }

  return {
    mixer,
    startMic,
    stopMic,
    isMicEnabled: () => micEnabled,
    setState,
    triggerGesture,
    update: update,
    dispose: () => {
      stopMic();
      mixer.stopAllAction();
      (mixer as any)._actions?.forEach((a: any) => a.stop && a.stop());
    }
  };
}