import { useState, useEffect, useRef } from "react";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useMeshStore } from "./XRMeshes";
import { AnimationMixer, Clock } from "three";
import { loadVRM } from "~/lib/xr/vrm/loadVRM";
import { createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { useFrame, useThree } from "@react-three/fiber";
import { setupNavMeshAndCrowd } from "~/lib/xr/navigation/setupNavMeshAndCrowd";
import { Crowd, CrowdAgent, NavMeshQuery } from "recast-navigation";
import { init } from "@recast-navigation/core";

export default function VRM() {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const mixer = useRef<AnimationMixer | null>(null);
  const clock = useRef(new Clock());

  const isSetupComplete = useRef(false);
  const isNavMeshBaked = useRef(false);

  const crowdRef = useRef<Crowd | null>(null);
  const agentRef = useRef<CrowdAgent | null>(null);
  const navMeshQueryRef = useRef<NavMeshQuery | null>(null);

  const { gl } = useThree();
  const meshes = useMeshStore((state) => state.meshes);

  useEffect(() => {
    if (isSetupComplete.current) return;

    const setUpModels = async () => {
      const loadedGltf = await loadVRM("/models/shibu.vrm");
      setGltf(loadedGltf);
      mixer.current = new AnimationMixer(loadedGltf.scene);

      const animGltf = await loadVRM("/anim/vrma/VRMA_03.vrma");
      const anim = animGltf.userData.vrmAnimations?.[0];
      if (anim) {
        const clip = createVRMAnimationClip(anim, loadedGltf.userData.vrm);
        mixer.current.clipAction(clip).play();
      }
    };

    init();
    setUpModels();
    isSetupComplete.current = true;
  }, []);

  gl.xr.addEventListener("planesdetected", () => {
    if (meshes.size <= 0) return;
    if (!isSetupComplete.current || isNavMeshBaked.current) return;

    const meshList = [];

    for (const mesh of meshes.values()) {
      meshList.push(mesh);
    }

    const { crowd, agent, navMeshQuery } = setupNavMeshAndCrowd(meshList) || {};
    crowdRef.current = crowd || null;
    agentRef.current = agent || null;
    navMeshQueryRef.current = navMeshQuery || null;

    const moveAgent = () => {
      if (navMeshQuery && agent) {
        const { randomPoint } = navMeshQuery.findRandomPointAroundCircle(
          gl.xr.getCamera().position,
          0.2
        );
        agent.requestMoveTarget(randomPoint);
      }
    };

    isNavMeshBaked.current = true;

    moveAgent();
    setInterval(moveAgent, 10000);
  });

  useFrame(() => {
    const deltaTime = clock.current.getDelta();
    gltf?.userData.vrm?.update(deltaTime);
    mixer.current?.update(deltaTime);

    if (crowdRef.current && agentRef.current && gltf) {
      crowdRef.current.update(1 / 60);
      const { x, z } = agentRef.current.position();
      gltf.scene.position.set(x, 0, z);
    }
  });

  return gltf ? <primitive object={gltf.scene} /> : null;
}
