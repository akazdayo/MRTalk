import { useState, useEffect } from "react";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useMeshStore } from "./XRMeshes";
import { AnimationMixer, Clock, Vector3 } from "three";
import { loadVRM } from "~/lib/xr/vrm/loadVRM";
import { createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { useFrame } from "@react-three/fiber";

export default function VRM() {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [mixer, setMixer] = useState<AnimationMixer | null>(null);

  const meshes = useMeshStore((state) => state.meshes);
  const getMeshByLabel = useMeshStore((state) => state.getMeshByLabel);

  useEffect(() => {
    async function setUpModels() {
      const gltf = await loadVRM("/models/shibu.vrm");
      setGltf(gltf);

      setMixer(new AnimationMixer(gltf.scene));
    }

    setUpModels();
  }, []);

  useEffect(() => {
    async function startAnimation() {
      if (!mixer || !gltf) return;
      const animGltf = await loadVRM("/anim/vrma/VRMA_01.vrma");

      const anim = animGltf.userData.vrmAnimations[0];
      const clip = createVRMAnimationClip(anim, gltf.userData.vrm);
      mixer.clipAction(clip).play();
    }

    startAnimation();
  }, [mixer, gltf]);

  useEffect(() => {
    const obj = getMeshByLabel("couch");
    if (obj && gltf) {
      if (obj.matrix) {
        const position = new Vector3();
        position.setFromMatrixPosition(obj.matrixWorld);

        gltf.scene.position.set(position.x, position.y, position.z);
      } else {
        console.warn("Mesh has no matrix to extract position from");
      }
    }
  }, [meshes, getMeshByLabel, gltf]);

  const clock = new Clock();
  clock.start();
  useFrame(() => {
    const deltaTime = clock.getDelta();

    if (gltf) {
      gltf.userData.vrm.update(deltaTime);
    }

    if (mixer) {
      mixer.update(deltaTime);
    }
  });

  return <>{gltf ? <primitive object={gltf.scene} /> : ""}</>;
}
