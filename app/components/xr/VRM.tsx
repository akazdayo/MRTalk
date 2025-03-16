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
import { useEffect, useRef, useState } from "react";
import { VRM as VRMType } from "@pixiv/three-vrm";
import { useXRInputSourceEvent, useXRInputSourceState } from "@react-three/xr";
import { useReactMediaRecorder } from "react-media-recorder";
import { Character } from "@prisma/client";

export default function VRM({ character }: { character: Character }) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [mode, setMode] = useState<"sitting" | "walking">("sitting");
  const [text, setText] = useState<string>("aaaaaaaa");

  const mixer = useRef<AnimationMixer | null>(null);
  const isSetupCompconste = useRef<boolean>(false);
  const isNavMeshBaked = useRef<boolean>(false);
  const crowd = useRef<Crowd | null>(null);
  const agent = useRef<CrowdAgent | null>(null);
  const navMeshQuery = useRef<NavMeshQuery | null>(null);
  const clock = useRef<Clock>(new Clock());
  const animations = useRef<Map<string, AnimationClip>>(new Map());
  const { startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop(blobUrl, blob) {
      talk(blob);
    },
  });

  const { gl } = useThree();
  const meshes = useMeshStore((state) => state.meshes);
  const getMeshByLabel = useMeshStore((state) => state.getMeshByLabel);

  const controller = useXRInputSourceState("hand", "left");

  useXRInputSourceEvent(
    controller?.inputSource,
    "selectstart",
    () => {
      setText("録音中...");
      startRecording();
    },
    [controller]
  );

  useXRInputSourceEvent(
    controller?.inputSource,
    "selectend",
    () => {
      setText("考え中...");
      stopRecording();
    },
    [controller]
  );

  async function talk(blob: Blob) {
    const form = new FormData();
    form.set("file", blob);

    const res = await fetch(`/api/chat/${character.id}`, {
      method: "POST",
      body: form,
    });

    const json = await res.json();

    if (!res.ok) {
      setText("エラーが発生しました。");
    }

    setText(json.response);
  }

  function StopAnim(mixer: AnimationMixer, name: "walk" | "idle" | "sit") {
    const anim = animations.current.get(name);

    if (anim) {
      mixer.clipAction(anim).stop();
    }
  }

  function Anim(mixer: AnimationMixer, name: "walk" | "idle" | "sit") {
    const anim = animations.current.get(name);

    if (anim) {
      mixer.clipAction(anim).play();
    }
  }

  function moveAgent() {
    if (mode !== "walking") return;

    if (navMeshQuery.current && agent.current) {
      const { randomPoint } = navMeshQuery.current.findRandomPointAroundCircle(
        gl.xr.getCamera().position,
        0.2
      );
      agent.current.requestMoveTarget(randomPoint);
    }
  }

  function updateModelMovement() {
    if (mode !== "walking") return;

    if (agent.current && gltf) {
      const agentPosition = new Vector3().copy(agent.current.position());
      const agentDestination = new Vector3().copy(agent.current.target());

      const distanceToTarget = agentPosition.distanceTo(agentDestination);
      const thresholdDistance = 0.1;

      if (distanceToTarget > thresholdDistance) {
        if (mixer.current) {
          StopAnim(mixer.current, "idle");
          Anim(mixer.current, "walk");
        }

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
      } else {
        if (mixer.current) {
          StopAnim(mixer.current, "walk");
          Anim(mixer.current, "idle");
        }
      }
    }
  }

  function lookAtPlayer() {
    if (!gltf) return;
    const vrm: VRMType = gltf.userData.vrm;
    const camera = gl.xr.getCamera();
    const headBone = vrm.humanoid.getBoneNode("head");
    if (!headBone) return;

    const distance = gltf.scene.position.distanceTo(camera.position);

    if (distance > 2) {
      vrm.lookAt?.reset();
      return;
    }

    vrm.lookAt?.lookAt(camera.position);

    const originalRotation = headBone.quaternion.clone();

    headBone.lookAt(camera.position);
    const targetRotation = headBone.quaternion.clone();

    headBone.quaternion.copy(originalRotation);

    const angle = originalRotation.angleTo(targetRotation);

    const maxAngle = Math.PI / 4;

    if (angle > maxAngle) {
      const t = maxAngle / angle;
      headBone.quaternion.slerpQuaternions(originalRotation, targetRotation, t);
    } else {
      headBone.quaternion.slerp(targetRotation, 0.1);
    }
  }

  gl.xr.addEventListener("sessionstart", () => {
    if (isSetupCompconste.current) return;

    const setUpModels = async () => {
      const loadedGltf = await loadVRM("/models/shibu.vrm");
      setGltf(loadedGltf);

      mixer.current = new AnimationMixer(loadedGltf.scene);

      const sitAnim = await loadVRM("/anim/vrma/sit_anim.vrma");
      const sit = sitAnim.userData.vrmAnimations?.[0];

      const walkAnim = await loadVRM("/anim/vrma/walk.vrma");
      const walk = walkAnim.userData.vrmAnimations?.[0];

      const idleAnim = await loadVRM("/anim/vrma/idle.vrma");
      const idle = idleAnim.userData.vrmAnimations?.[0];

      const sitClip = createVRMAnimationClip(sit, loadedGltf.userData.vrm);
      const walkClip = createVRMAnimationClip(walk, loadedGltf.userData.vrm);
      const idleClip = createVRMAnimationClip(idle, loadedGltf.userData.vrm);

      animations.current.set("sit", sitClip);
      animations.current.set("walk", walkClip);
      animations.current.set("idle", idleClip);

      Anim(mixer.current, "sit");
    };

    init();
    setUpModels();

    isSetupCompconste.current = true;
  });

  gl.xr.addEventListener("planesdetected", () => {
    if (
      meshes.size <= 0 ||
      !isSetupCompconste.current ||
      isNavMeshBaked.current
    )
      return;

    const meshList = [];

    for (const mesh of meshes.values()) {
      meshList.push(mesh);
    }

    const result = setupNavMeshAndCrowd(meshList);

    if (result) {
      crowd.current = result.crowd || null;
      agent.current = result.agent || null;
      navMeshQuery.current = result.navMeshQuery || null;

      isNavMeshBaked.current = true;
    }
  });

  useEffect(() => {
    moveAgent();

    const movementInterval = setInterval(moveAgent, 5000);

    return () => {
      clearInterval(movementInterval);
    };
  }, [mode]);

  useFrame(() => {
    const deltaTime = clock.current.getDelta();
    mixer.current?.update(deltaTime);

    if (gltf) {
      gltf.userData.vrm.update(deltaTime);
      lookAtPlayer();
    }

    if (mode === "walking") {
      if (crowd.current && agent.current && gltf) {
        updateModelMovement();

        crowd.current.update(1 / 60);
        const { x, z } = agent.current.position();
        gltf.scene.position.set(x, 0, z);
      }
    }

    if (mode === "sitting") {
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
          <primitive object={gltf.scene} />

          <mesh
            pointerEventsType={{ deny: "grab" }}
            onClick={() => {
              if (mixer.current) {
                mixer.current.stopAllAction();

                if (mode === "walking") {
                  Anim(mixer.current, "sit");
                  setMode("sitting");
                }

                if (mode === "sitting") {
                  Anim(mixer.current, "walk");
                  setMode("walking");
                }
              }
            }}
            scale={0.1}
            position={[0, 1.4, 0]}
          >
            <group position={[0, 1.7, 0]}>
              <Text>{mode === "walking" ? "座る" : "歩かせる"}</Text>
            </group>
            <boxGeometry />
          </mesh>

          <group
            position={[gltf.scene.position.x, 1.5, gltf.scene.position.z]}
            scale={0.1}
            lookAt={[
              gl.xr.getCamera().position.x,
              gl.xr.getCamera().position.y,
              gl.xr.getCamera().position.z,
            ]}
          >
            <Text font="/fonts/keifont.ttf">{text}</Text>
          </group>
        </>
      ) : null}
    </>
  );
}
