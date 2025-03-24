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
import { useEffect, useRef, useState } from "react";
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
    //考え中アニメーションを再生
    if (animationManager.current) {
      animationManager.current.playAnimation("thinking");
    }

    try {
      const res = await chatRef.current.voiceChat(blob);

      setText(res.content);

      //感情スコアをソート
      const arr = Object.entries(res.emotion);

      arr.sort((a, b) => {
        return b[1] - a[1];
      });

      //返答が帰ってきたら考え中モーションを停止
      if (animationManager.current) {
        animationManager.current.setEmotion(arr[0][0]);
        animationManager.current.stopAnimation("thinking");
      }

      //talkingモード(プレイヤーのほうを向く)に切り替える
      if (movementManager.current) {
        const currentState = movementManager.current.getState(); //talkingの前のstateを保持しておく

        movementManager.current.switchState("talking");

        //10秒後に戻す
        setTimeout(() => {
          movementManager.current?.switchState(currentState);
          animationManager.current?.resetEmotion();
        }, 10000);
      }
    } catch (e: unknown) {
      animationManager.current?.stopAnimation("thinking");
      animationManager.current?.resetEmotion();

      if (e instanceof Error) {
        setText(e.message);
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
      setTimeout(() => {
        setText("考え中...");
        stopRecording();
      }, 1000); //すぐに終了しないように1秒あける
    },
    [controller]
  );

  const toggleMode = (state: StateType) => {
    if (!movementManager.current) return;

    movementManager.current.switchState(state);
  };

  const onSessionStart = async () => {
    try {
      await init();
      const loader = new VRMLoader();

      const { gltf } = await loader.load("/models/AliciaSolid-1.0.vrm");
      setGltf(gltf);

      const animation = new AnimationManager(gltf);
      await animation.load({
        idle: { path: "/anim/vrma/idle.vrma", isAdditive: false },
        walk: { path: "/anim/vrma/walk.vrma", isAdditive: false },
        sit: { path: "/anim/vrma/sit_anim.vrma", isAdditive: false },
        thinking: { path: "/anim/vrma/thinking.vrma", isAdditive: true },
      });

      animationManager.current = animation;

      animation.playAnimation("idle");
    } catch (e) {
      alert("モデルのロードに失敗しました。");
    }
  };

  gl.xr.addEventListener("sessionstart", onSessionStart);

  useEffect(() => {
    try {
      if (isCompleteSetup.current || !gltf || !animationManager.current) return;

      //NavMeshをベイク
      const navigation = new NavMeshManager(new RecastNavMeshFactory());
      navigation.bake(Array.from(meshes.values()));

      //NavMeshを取得
      const navMesh = navigation.getNavMesh();
      if (!navMesh) return;

      const agent = new AgentManager(navMesh);

      const movement = new MovementManager(
        "walking",
        gltf,
        animationManager.current,
        agent,
        getMeshByLabel,
        gl.xr.getCamera().position
      );

      movementManager.current = movement;

      isCompleteSetup.current = true;
    } catch (e) {
      alert("部屋の解析に失敗しました。");
    }
  }, [meshes]);

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
