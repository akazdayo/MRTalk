import { useState, useEffect, useRef } from "react";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useMeshStore } from "./XRMeshes";
import {
  AnimationClip,
  AnimationMixer,
  Clock,
  Euler,
  Quaternion,
  Vector3,
} from "three";
import { loadVRM } from "~/lib/xr/vrm/loadVRM";
import { useFrame, useThree } from "@react-three/fiber";
import { setupNavMeshAndCrowd } from "~/lib/xr/navigation/setupNavMeshAndCrowd";
import { Crowd, CrowdAgent, NavMeshQuery } from "recast-navigation";
import { init } from "@recast-navigation/core";
import { Text } from "@react-three/drei";
import { createVRMAnimationClip } from "@pixiv/three-vrm-animation";

export default function VRM() {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [isWalking, setIsWalking] = useState<boolean>(false);

  const mixer = useRef<AnimationMixer | null>(null);
  const clock = useRef(new Clock());

  const isSetupComplete = useRef(false);
  const isNavMeshBaked = useRef(false);

  const animations = useRef<Map<string, AnimationClip>>(
    new Map<string, AnimationClip>()
  );
  const crowdRef = useRef<Crowd | null>(null);
  const agentRef = useRef<CrowdAgent | null>(null);
  const navMeshQueryRef = useRef<NavMeshQuery | null>(null);

  const { gl } = useThree();
  const meshes = useMeshStore((state) => state.meshes);
  const getMeshByLabel = useMeshStore((state) => state.getMeshByLabel);

  function updateModelMovement() {
    if (agentRef.current && gltf && isWalking) {
      const agentPosition = new Vector3().copy(agentRef.current.position());
      const agentDestination = new Vector3().copy(agentRef.current.target());

      const distanceToTarget = agentPosition.distanceTo(agentDestination);
      const thresholdDistance = 0.1;

      if (distanceToTarget > thresholdDistance) {
        const direction = new Vector3()
          .subVectors(agentDestination, agentPosition)
          .normalize();
        const targetQuaternion = new Quaternion().setFromUnitVectors(
          new Vector3(0, 0, 1),
          direction
        );
        const euler = new Euler().setFromQuaternion(targetQuaternion, "YXZ");
        euler.x = 0;
        euler.z = 0;
        const fixedQuaternion = new Quaternion().setFromEuler(euler);

        gltf.scene.quaternion.slerp(fixedQuaternion, 0.5);
      }
    }
  }

  useEffect(() => {
    if (isSetupComplete.current) return;

    const setUpModels = async () => {
      const loadedGltf = await loadVRM("/models/shibu.vrm");
      setGltf(loadedGltf);
      mixer.current = new AnimationMixer(loadedGltf.scene);

      const sitAnim = await loadVRM("/anim/vrma/sit_anim.vrma");
      const sit = sitAnim.userData.vrmAnimations?.[0];

      const walkAnim = await loadVRM("/anim/vrma/walk.vrma");
      const walk = walkAnim.userData.vrmAnimations?.[0];
      if (sit && walk) {
        const sitClip = createVRMAnimationClip(sit, loadedGltf.userData.vrm);
        const walkClip = createVRMAnimationClip(walk, loadedGltf.userData.vrm);

        animations.current.set("sit", sitClip);
        animations.current.set("walk", walkClip);

        mixer.current.clipAction(walkClip).play();
      }
    };

    init();
    setUpModels();
    isSetupComplete.current = true;
  }, []);

  gl.xr.addEventListener("planesdetected", () => {
    if (
      meshes.size <= 0 ||
      !isWalking ||
      !isSetupComplete.current ||
      isNavMeshBaked.current
    )
      return;

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
    setInterval(updateModelMovement, 500);
  });

  useFrame(() => {
    const deltaTime = clock.current.getDelta();
    gltf?.userData.vrm?.update(deltaTime);
    mixer.current?.update(deltaTime);

    if (crowdRef.current && agentRef.current && gltf && isWalking) {
      crowdRef.current.update(1 / 60);
      const { x, z } = agentRef.current.position();
      gltf.scene.position.set(x, 0, z);
    } else {
      const couch = getMeshByLabel("couch");
      const screen = getMeshByLabel("screen");

      if (couch && gltf) {
        const { x, z } = new Vector3().setFromMatrixPosition(couch.matrixWorld);

        gltf.scene.position.set(x, -0.3, z);
      }

      if (screen && gltf) {
        const { x, z } = new Vector3().setFromMatrixPosition(
          screen.matrixWorld
        );

        gltf.scene.lookAt(x, -0.3, z);
      }
    }
  });

  return (
    <>
      {gltf ? (
        <>
          <primitive
            object={gltf.scene}
            onClick={() => {
              console.log("触らないでください！");
            }}
          />

          <mesh
            onClick={() => {
              const sitAnim = animations.current.get("sit");
              const walkAnim = animations.current.get("walk");

              if (sitAnim && walkAnim && mixer.current) {
                if (isWalking) {
                  mixer.current.clipAction(sitAnim).play();
                  mixer.current.clipAction(walkAnim).stop();
                }

                if (!isWalking) {
                  mixer.current.clipAction(walkAnim).play();
                  mixer.current.clipAction(sitAnim).stop();
                }
              }

              setIsWalking(!isWalking);
            }}
            scale={0.1}
            position={[0, 1.4, 0]}
          >
            <group position={[0, 1.7, 0]}>
              <Text>{isWalking ? "止める" : "歩かせる"}</Text>
            </group>
            <boxGeometry />
          </mesh>
        </>
      ) : null}
    </>
  );
}
