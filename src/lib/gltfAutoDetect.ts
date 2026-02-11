export function detectMorphsAndBones(model: import('three').Object3D) {
  const meshes: { name: string; morphTargetDictionary?: Record<string, number> }[] = [];
  const boneNames: string[] = [];
  model.traverse((n: any) => {
    if (n.isMesh) {
      meshes.push({ name: n.name || '(unnamed)', morphTargetDictionary: n.morphTargetDictionary || undefined });
    }
    if (n.isBone) {
      boneNames.push(n.name || '(unnamed-bone)');
    }
  });

  // Ready Player Me / common viseme hints
  const rpmeHints = [
    'viseme_A', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
    'v_mouthOpen', 'mouthOpen', 'MouthOpen', 'jawOpen', 'Aa', 'OPEN'
  ];

  // collect candidate morph names found
  const morphCandidates = new Set<string>();
  for (const m of meshes) {
    if (m.morphTargetDictionary) {
      for (const name of Object.keys(m.morphTargetDictionary)) {
        morphCandidates.add(name);
      }
    }
  }

  // find matching candidates per hints
  const matchedHints: string[] = [];
  for (const hint of rpmeHints) if (morphCandidates.has(hint)) matchedHints.push(hint);

  // fallback heuristic: any morph name containing mouth/jaw/aa/oo
  for (const name of Array.from(morphCandidates)) {
    const low = name.toLowerCase();
    if (low.includes('mouth') || low.includes('jaw') || low.includes('aa') || low.includes('oo') || low.includes('open')) {
      if (!matchedHints.includes(name)) matchedHints.push(name);
    }
  }

  // guess jaw bone names
  const jawCandidates = boneNames.filter((n) => {
    const low = n.toLowerCase();
    return low.includes('jaw') || low.includes('head') || low.includes('neck');
  });

  return {
    meshes,
    boneNames,
    morphCandidates: Array.from(morphCandidates),
    matchedHints,
    jawCandidates
  };
}

export function autoConfigureController(viewer: any, controller: any) {
  try {
    const info = detectMorphsAndBones(viewer.model);
    // If matchedHints exist, try to add them to controller heuristics by setting options or by direct mapping
    if (info.matchedHints.length > 0) {
      console.log('[gltfAutoDetect] matched morph hints', info.matchedHints);
      // Attempt to set morph candidates on controller if available
      // some controllers accept updating internal arrays; otherwise consumer should pass explicit options
      if (controller && typeof controller.setMorphCandidates === 'function') {
        controller.setMorphCandidates(info.matchedHints);
      }
    }
    // If jawCandidates present and controller exposes setJawCandidates, set them
    if (info.jawCandidates.length > 0 && controller && typeof controller.setJawCandidates === 'function') {
      controller.setJawCandidates(info.jawCandidates);
    }
    return info;
  } catch (err) {
    console.warn('autoConfigureController failed', err);
    return null;
  }
}