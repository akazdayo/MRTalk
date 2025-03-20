import { useMeshStore } from "./XRMeshes";
import { useFrame, useThree } from "@react-three/fiber";
import { useXRInputSourceEvent, useXRInputSourceState } from "@react-three/xr";
import { useReactMediaRecorder } from "react-media-recorder";
import { Character } from "@prisma/client";
import TextBox from "./TextBox";
import SettingsPanel from "./SettingsPanel";
import { MovementManager, StateType } from "~/lib/xr/vrm/MovementManager";
import { AnimationManager } from "~/lib/xr/vrm/AnimationManager";
import { VRMLoader } from "~/lib/xr/vrm/VRMLoader";
import { useRef, useState } from "react";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Chat } from "~/lib/llm/Chat";
import {
  AgentManager,
  NavMeshManager,
  RecastNavMeshFactory,
} from "~/lib/xr/navigation/NavigationManager";
import { init } from "@recast-navigation/core";

export default function VRM({ character }: { character: Character }) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [text, setText] = useState<string>("話しかけてみましょう！");

  const isCompleteSetup = useRef<boolean>(false);
  const chatRef = useRef(new Chat(character.id));
  const movementManager = useRef<MovementManager | null>(null);
  const animationManager = useRef<AnimationManager | null>(null);

  const { gl } = useThree();
  const meshes = useMeshStore((state) => state.meshes);
  const getMeshByLabel = useMeshStore((state) => state.getMeshByLabel);

  const { startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop(blobUrl, blob) {
      onResult(blob);
    },
  });

  async function onResult(blob: Blob) {
    if (animationManager.current) {
      animationManager.current.playAnimation("thinking");
    }

    const res = await chatRef.current.voiceChat(blob);
    if (res.error) {
      setText(res.error);
    } else {
      setText(res.response);

      if (movementManager.current) {
        const currentState = movementManager.current.getState();

        movementManager.current.switchState("talking");
        setTimeout(() => {
          movementManager.current?.switchState(currentState);
        }, 10000);
      }
    }
  }

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

  const toggleMode = (state: StateType) => {
    if (!movementManager.current) return;

    movementManager.current.switchState(state);
  };

  const onSessionStart = async () => {
    await init();
    const loader = new VRMLoader();
    const { gltf } = await loader.load("/models/AliciaSolid-1.0.vrm");
    setGltf(gltf);

    const animation = new AnimationManager(gltf);
    await animation.load({
      idle: "/anim/vrma/idle.vrma",
      walk: "/anim/vrma/walk.vrma",
      sit: "/anim/vrma/sit_anim.vrma",
      thinking: "/anim/vrma/thinking.vrma",
    });

    const movement = new MovementManager(
      "walking",
      gltf,
      animation,
      getMeshByLabel,
      gl.xr.getCamera().position
    );

    animationManager.current = animation;
    movementManager.current = movement;

    animation.playAnimation("idle");
  };

  const onPlanesDetected = () => {
    if (isCompleteSetup.current || !movementManager.current) return;

    //NavMeshをベイク
    const navigation = new NavMeshManager(new RecastNavMeshFactory());
    navigation.bake(Array.from(meshes.values()));

    //NavMeshを取得
    const navMesh = navigation.getNavMesh();
    if (!navMesh) return;

    const agent = new AgentManager(navMesh);

    movementManager.current.setup(navigation, agent);

    isCompleteSetup.current = true;
  };

  gl.xr.addEventListener("sessionstart", onSessionStart);
  gl.xr.addEventListener("planesdetected", onPlanesDetected);

  useFrame(() => {
    if (animationManager.current) {
      animationManager.current.update();
    }

    if (movementManager.current) {
      movementManager.current.update();
    }
  });

  return (
    <>
      {gltf ? (
        <>
          <group>
            <primitive object={gltf.scene} scale={0.85} />
            <directionalLight position={[0, 10, 0]} />
          </group>

          <SettingsPanel onClick={toggleMode} camera={gl.xr.getCamera()} />

          <TextBox text={text} camera={gl.xr.getCamera()} gltf={gltf} />
        </>
      ) : null}
    </>
  );
}
