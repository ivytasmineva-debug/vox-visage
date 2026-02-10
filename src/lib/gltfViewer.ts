import * as THREE from "three";
import { GLTFLoader, DRACOLoader, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } from "three-stdlib";
import type { GLTF } from "three-stdlib";

export type ViewerOptions = {
  pixelRatio?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  dracoDecoderPath?: string;
  controls?: boolean;
};

export type AvatarViewer = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  gltf: GLTF;
  model: THREE.Object3D;
  setListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  dispose: () => void;
};

export async function createAvatarViewer(
  container: HTMLElement,
  glbUrl: string,
  options: ViewerOptions = {}
): Promise<AvatarViewer> {
  const width = container.clientWidth;
  const height = container.clientHeight;

  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(options.pixelRatio ?? Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  /* Scene */
  const scene = new THREE.Scene();
  scene.background = null;

  /* Camera */
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);
  camera.position.set(0, 1.6, 2.5);

  /* Controls */
  let controls: OrbitControls | null = null;
  if (options.controls !== false) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.target.set(0, 1.2, 0);
    controls.update();
  }

  /* Lighting */
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(1.2, 2.5, 1.5);
  scene.add(key);

  const rimCool = new THREE.DirectionalLight(0x88ccff, 0.45);
  rimCool.position.set(-2, 2, -1.5);
  scene.add(rimCool);

  const rimWarm = new THREE.DirectionalLight(0xffcc88, 0.35);
  rimWarm.position.set(2, 1, -2);
  scene.add(rimWarm);

  // Dynamic glow light for states
  const glowLight = new THREE.PointLight(0x38bdf8, 0, 5);
  glowLight.position.set(0, 1.5, 1.5);
  scene.add(glowLight);

  /* Post Processing */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(width, height),
      options.bloomStrength ?? 0.6,
      options.bloomRadius ?? 0.4,
      options.bloomThreshold ?? 0.85
    )
  );

  /* Loaders */
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    options.dracoDecoderPath ?? "https://www.gstatic.com/draco/v1/decoders/"
  );
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  /* Load Model */
  const gltf: GLTF = await loader.loadAsync(glbUrl);
  const model = gltf.scene;
  scene.add(model);

  model.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      const mat = mesh.material as any;
      if (mat?.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
      }
      mat.metalness ??= 0.9;
      mat.roughness ??= 0.35;
      mat.envMapIntensity ??= 1.0;
      mat.needsUpdate = true;
    }
  });

  /* Auto Center & Frame */
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const avatarHeight = size.y || 1.6;
  camera.position.set(0, avatarHeight * 0.9, avatarHeight * 1.4);
  if (controls) {
    controls.target.set(0, avatarHeight * 0.55, 0);
    controls.update();
  }

  /* State */
  let isListening = false;
  let isSpeaking = false;
  let isThinking = false;

  /* Animation Loop */
  let running = true;
  const baseY = model.position.y;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = performance.now() * 0.001;

    // Idle breathing
    const breathSpeed = isSpeaking ? 2.5 : 1;
    const breathAmp = isSpeaking ? 0.008 : 0.003;
    model.position.y = baseY + Math.sin(t * breathSpeed) * breathAmp;

    // Gentle rotation
    const rotAmp = isSpeaking ? 0.04 : 0.015;
    model.rotation.y = Math.sin(t * 0.15) * rotAmp;

    // Head tilt when speaking
    if (isSpeaking) {
      model.rotation.z = Math.sin(t * 1.8) * 0.015;
      model.rotation.x = Math.sin(t * 1.2) * 0.01;
    } else {
      model.rotation.z *= 0.95;
      model.rotation.x *= 0.95;
    }

    // Dynamic glow light
    if (isListening) {
      glowLight.color.setHex(0xf59e0b);
      glowLight.intensity = 1.5 + Math.sin(t * 4) * 0.5;
    } else if (isSpeaking) {
      glowLight.color.setHex(0x38bdf8);
      glowLight.intensity = 1.2 + Math.sin(t * 3) * 0.4;
    } else if (isThinking) {
      glowLight.color.setHex(0xf59e0b);
      glowLight.intensity = 0.8 + Math.sin(t * 2) * 0.3;
    } else {
      glowLight.intensity *= 0.95;
    }

    controls?.update();
    composer.render();
  }
  animate();

  /* Resize */
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });
  resizeObserver.observe(container);

  return {
    scene,
    camera,
    renderer,
    gltf,
    model,
    setListening(v: boolean) { isListening = v; },
    setSpeaking(v: boolean) { isSpeaking = v; },
    setThinking(v: boolean) { isThinking = v; },
    dispose() {
      running = false;
      resizeObserver.disconnect();
      controls?.dispose();
      (composer as any).dispose?.();
      dracoLoader.dispose();
      scene.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose?.());
          } else {
            (mesh.material as any)?.dispose?.();
          }
          mesh.geometry?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
