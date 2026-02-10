import * as THREE from "three";

/**
 * Ready Player Me viseme morph target names.
 * These blend shapes control mouth/face movement for lip sync.
 */
export const VISEME_NAMES = [
  "viseme_sil",  // 0: silence
  "viseme_PP",   // 1: p, b, m
  "viseme_FF",   // 2: f, v
  "viseme_TH",   // 3: th
  "viseme_DD",   // 4: t, d
  "viseme_kk",   // 5: k, g
  "viseme_CH",   // 6: ch, j, sh
  "viseme_SS",   // 7: s, z
  "viseme_nn",   // 8: n, l
  "viseme_RR",   // 9: r
  "viseme_aa",   // 10: a
  "viseme_E",    // 11: e
  "viseme_I",    // 12: i
  "viseme_O",    // 13: o
  "viseme_U",    // 14: u
] as const;

/**
 * Phoneme-like sequences that simulate natural speech patterns.
 * Each entry is [visemeIndex, durationMs].
 */
const SPEECH_PATTERNS: [number, number][][] = [
  // Pattern 1: general consonant-vowel
  [[10, 120], [1, 80], [11, 100], [4, 70], [13, 130], [0, 60]],
  // Pattern 2: sibilant heavy
  [[7, 90], [12, 110], [8, 80], [10, 120], [6, 70], [0, 50]],
  // Pattern 3: vowel heavy
  [[10, 140], [13, 120], [14, 100], [11, 130], [12, 110], [0, 70]],
  // Pattern 4: plosive mix
  [[1, 70], [10, 120], [5, 80], [11, 110], [4, 70], [13, 100], [0, 60]],
  // Pattern 5: nasal + liquid
  [[8, 90], [10, 130], [9, 80], [12, 100], [8, 70], [14, 110], [0, 50]],
];

export type VisemeMeshInfo = {
  mesh: THREE.Mesh;
  morphTargetIndices: Map<string, number>;
};

/**
 * Find all meshes with viseme morph targets in the model.
 */
export function findVisemeMeshes(model: THREE.Object3D): VisemeMeshInfo[] {
  const results: VisemeMeshInfo[] = [];

  model.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    if (!dict || !mesh.morphTargetInfluences) return;

    const indices = new Map<string, number>();
    for (const name of VISEME_NAMES) {
      if (name in dict) {
        indices.set(name, dict[name]);
      }
    }

    if (indices.size > 0) {
      results.push({ mesh, morphTargetIndices: indices });
    }
  });

  return results;
}

/**
 * Manages procedural lip sync animation using viseme morph targets.
 */
export class LipSyncAnimator {
  private meshes: VisemeMeshInfo[] = [];
  private isSpeaking = false;
  private currentPattern: [number, number][] = SPEECH_PATTERNS[0];
  private patternIndex = 0;
  private stepIndex = 0;
  private stepStartTime = 0;
  private targetWeights: number[] = new Array(VISEME_NAMES.length).fill(0);
  private currentWeights: number[] = new Array(VISEME_NAMES.length).fill(0);
  private smoothing = 0.15; // lower = smoother transitions

  constructor(meshes: VisemeMeshInfo[]) {
    this.meshes = meshes;
  }

  setSpeaking(speaking: boolean) {
    if (speaking && !this.isSpeaking) {
      // Pick a random pattern to start
      this.patternIndex = Math.floor(Math.random() * SPEECH_PATTERNS.length);
      this.currentPattern = SPEECH_PATTERNS[this.patternIndex];
      this.stepIndex = 0;
      this.stepStartTime = performance.now();
    }
    this.isSpeaking = speaking;

    if (!speaking) {
      // Reset all targets to 0 (close mouth)
      this.targetWeights.fill(0);
    }
  }

  /**
   * Call every frame to update morph targets.
   */
  update() {
    const now = performance.now();

    if (this.isSpeaking) {
      const [visemeIdx, durationMs] = this.currentPattern[this.stepIndex];
      const elapsed = now - this.stepStartTime;

      // Set target viseme
      this.targetWeights.fill(0);
      
      // Primary viseme
      const progress = Math.min(elapsed / durationMs, 1);
      // Bell curve: ramp up then down within the step
      const intensity = Math.sin(progress * Math.PI) * (0.6 + Math.random() * 0.35);
      this.targetWeights[visemeIdx] = intensity;

      // Add subtle jaw open (viseme_aa) for naturalness
      if (visemeIdx !== 0 && visemeIdx !== 10) {
        this.targetWeights[10] = intensity * 0.2;
      }

      // Advance to next step
      if (elapsed >= durationMs) {
        this.stepIndex++;
        if (this.stepIndex >= this.currentPattern.length) {
          // Pick next pattern randomly
          this.patternIndex = Math.floor(Math.random() * SPEECH_PATTERNS.length);
          this.currentPattern = SPEECH_PATTERNS[this.patternIndex];
          this.stepIndex = 0;
        }
        this.stepStartTime = now;
      }
    }

    // Smoothly interpolate current weights toward target
    for (let i = 0; i < this.currentWeights.length; i++) {
      this.currentWeights[i] += (this.targetWeights[i] - this.currentWeights[i]) * this.smoothing;
      // Clamp very small values to 0
      if (this.currentWeights[i] < 0.001) this.currentWeights[i] = 0;
    }

    // Apply to all viseme meshes
    for (const { mesh, morphTargetIndices } of this.meshes) {
      if (!mesh.morphTargetInfluences) continue;
      for (const [name, idx] of morphTargetIndices) {
        const visemeI = VISEME_NAMES.indexOf(name as typeof VISEME_NAMES[number]);
        if (visemeI >= 0) {
          mesh.morphTargetInfluences[idx] = this.currentWeights[visemeI];
        }
      }
    }
  }

  /**
   * Returns true if this animator has valid viseme meshes to animate.
   */
  get hasVisemes(): boolean {
    return this.meshes.length > 0;
  }

  get visemeCount(): number {
    let total = 0;
    for (const m of this.meshes) total += m.morphTargetIndices.size;
    return total;
  }
}
