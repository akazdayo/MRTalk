import { useMeshStore } from "./XRMeshes";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useXR,
  useXRInputSourceEvent,
  useXRInputSourceState,
} from "@react-three/xr";
import { useReactMediaRecorder } from "react-media-recorder";
import { Character } from "@prisma/client";
import TextBox from "./TextBox";
import { MovementManager } from "~/lib/xr/vrm/MovementManager";
import { AnimationManager } from "~/lib/xr/vrm/AnimationManager";
import { VRMLoader } from "~/lib/xr/vrm/VRMLoader";
import { useEffect, useRef, useState } from "react";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Chat, Res } from "~/lib/llm/Chat";
import {
  AgentManager,
  NavMeshManager,
  RecastNavMeshFactory,
} from "~/lib/xr/navigation/NavigationManager";
import { init } from "@recast-navigation/core";
import { VRM as VRMType } from "@pixiv/three-vrm";
import { Buffer } from "buffer";

//TODO:リファクタする
//-> リファクタして
export default function VRM({
  character,
  onChatMessage
}: {
  character: Character;
  onChatMessage?: (userMessage: string, assistantResponse: Res) => void;
}) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [text, setText] = useState<string>("話しかけてみましょう！");
  const [userInput, setUserInput] = useState<string>("");

  const xr = useXR();

  const timeDomainData = new Float32Array(2048);

  const isCompleteSetup = useRef<boolean>(false);

  const chat = useRef(new Chat(character.id));
  const movementManager = useRef<MovementManager | null>(null);
  const animationManager = useRef<AnimationManager | null>(null);

  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  const { gl } = useThree();
  const meshes = useMeshStore((state) => state.meshes);
  const getMeshByLabel = useMeshStore((state) => state.getMeshByLabel);

  const { startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop(blobUrl, blob) {
      onResult(blob);
    },
  });

  const onResult = async (blob: Blob) => {
    movementManager.current?.toggleThinking();

    try {
      const res = await chat.current.voiceChat(blob);
      setText(res.content);

      // チャット履歴に追加（音声入力の場合、userInputは音声として記録）
      onChatMessage!(userInput || "音声入力", res);

      // 音声再生部分をコメントアウト
      const sound = "data:audio/wav;base64," + res.voice;
      const audio = new Audio();
      audio.src = sound;

      const buffer = Buffer.from(res.voice, "base64");

      if (audioCtx.current) {
        audioCtx.current.decodeAudioData(
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          ),
          (audioBuffer) => {
            if (analyser.current && audioCtx.current) {
              const bufferSource = audioCtx.current.createBufferSource();
              bufferSource.buffer = audioBuffer;
              bufferSource.connect(audioCtx.current.destination);
              bufferSource.connect(analyser.current);
              bufferSource.start();
            }
          }
        );
      }

      if (movementManager.current && res.event) {
        movementManager.current.setEvent(res.event);
      }

      const arr = Object.entries(res.emotion);
      arr.sort((a, b) => b[1] - a[1]);

      movementManager.current?.toggleThinking();

      animationManager.current?.setEmotion(arr[0][0]);
      movementManager.current?.toggleTalking();

      setTimeout(() => {
        movementManager.current?.toggleTalking();
        animationManager.current?.resetEmotion();
      }, 10000);
    } catch (e: unknown) {
      movementManager.current?.toggleThinking();
      animationManager.current?.resetEmotion();

      if (e instanceof Error) {
        setText(e.message);
      }
    }
  };

  const controller = useXRInputSourceState("hand", "left");

  useXRInputSourceEvent(
    controller?.inputSource,
    "selectstart",
    () => {
      if (!movementManager.current?.isThinking) {
        setText("録音中...");
        setUserInput("音声入力中...");
        startRecording();
      }
    },
    [controller]
  );

  useXRInputSourceEvent(
    controller?.inputSource,
    "selectend",
    () => {
      if (!movementManager.current?.isThinking) {
        setTimeout(() => {
          setText("考え中...");
          stopRecording();
        }, 500);
      }
    },
    [controller]
  );

  const getPlayerPosition = () => {
    return gl.xr.getCamera().position;
  };

  const onSessionStart = async () => {
    try {
      await init();
      const loader = new VRMLoader();

      const { gltf } = await loader.load(character.modelUrl);
      setGltf(gltf);

      const animation = new AnimationManager(gltf);
      await animation.load({
        idle: { path: "/anim/vrma/idle.vrma", isAdditive: false },
        walk: { path: "/anim/vrma/walk.vrma", isAdditive: false },
        sit: { path: "/anim/vrma/sit_anim.vrma", isAdditive: false },
        thinking: { path: "/anim/vrma/thinking.vrma", isAdditive: true },
        looking: { path: "/anim/vrma/looking.vrma", isAdditive: false },
        stretch: { path: "/anim/vrma/stretch.vrma", isAdditive: false },
      });

      animationManager.current = animation;
    } catch (e) {
      alert("モデルのロードに失敗しました。");
    }

    // AudioContextのセットアップをコメントアウト
    try {
      const ctx = new window.AudioContext();
      const a = ctx.createAnalyser();

      audioCtx.current = ctx;
      analyser.current = a;
      window.Buffer = Buffer;
    } catch (e) {
      alert("Audio Analyserのセットアップに失敗しました。");
    }
  };

  const setupNavMesh = () => {
    try {
      if (
        isCompleteSetup.current ||
        !gltf ||
        !animationManager.current ||
        !xr.session
      )
        return;

      //NavMeshをベイク
      const navigation = new NavMeshManager(new RecastNavMeshFactory());
      navigation.bake(Array.from(meshes.values()));

      //NavMeshを取得
      const navMesh = navigation.getNavMesh();
      if (!navMesh) return;

      const agent = new AgentManager(navMesh);

      const movement = new MovementManager(
        gltf,
        animationManager.current,
        agent,
        getMeshByLabel,
        getPlayerPosition,
        xr.session
      );

      movementManager.current = movement;

      isCompleteSetup.current = true;
    } catch (e) {
      alert("部屋の解析に失敗しました。");
    }
  };

  gl.xr.addEventListener("sessionstart", onSessionStart);

  useEffect(() => {
    setupNavMesh();
  }, [meshes]);

  useFrame(() => {
    if (animationManager.current) {
      animationManager.current.update();
    }

    if (movementManager.current) {
      movementManager.current.update();
    }

    //リップシンク(仮) - コメントアウト
    if (analyser.current && gltf) {
      analyser.current.getFloatTimeDomainData(timeDomainData);

      let volume = 0.0;
      for (let i = 0; i < 2048; i++) {
        volume = Math.max(volume, Math.abs(timeDomainData[i]));
      }

      volume = 1 / (1 + Math.exp(-45 * volume + 5));
      if (volume < 0.1) volume = 0;

      const vrm: VRMType = gltf.userData.vrm;

      vrm.expressionManager?.setValue("aa", volume);
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

          <TextBox text={text} camera={gl.xr.getCamera()} gltf={gltf} />
        </>
      ) : null}
    </>
  );
}
