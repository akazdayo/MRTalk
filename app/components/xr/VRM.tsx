import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useMeshStore } from "./XRMeshes";
import { AnimationClip, AnimationMixer, Clock, Vector3 } from "three";
import { loadVRM } from "~/lib/xr/vrm/loadVRM";
import { useFrame, useThree } from "@react-three/fiber";
import { setupNavMeshAndCrowd } from "~/lib/xr/navigation/setupNavMeshAndCrowd";
import { Crowd, CrowdAgent, NavMeshQuery } from "recast-navigation";
import { init } from "@recast-navigation/core";
import { createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { useEffect, useRef, useState } from "react";
import { VRM as VRMType } from "@pixiv/three-vrm";
import { useXRInputSourceEvent, useXRInputSourceState } from "@react-three/xr";
import { useReactMediaRecorder } from "react-media-recorder";
import { Character } from "@prisma/client";
import TextBox from "./TextBox";
import SettingsPanel from "./SettingsPanel";

type AnimationType = "walk" | "idle" | "sit" | "thinking";
type CharacterMode = "sitting" | "walking" | "thinking";

interface NavMeshSetup {
  crowd: Crowd | null;
  agent: CrowdAgent | null;
  navMeshQuery: NavMeshQuery | null;
}

interface AnimationCollection {
  [key: string]: AnimationClip;
}

export default function VRM({ character }: { character: Character }) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [mode, setMode] = useState<CharacterMode>("sitting");
  const [text, setText] = useState<string>("話しかけてみましょう！");

  const stateRef = useRef({
    isGeneratingResponse: false,
    isSetupComplete: false,
    isNavMeshBaked: false,
  });

  const animRef = useRef({
    mixer: null as AnimationMixer | null,
    animations: new Map<string, AnimationClip>(),
    clock: new Clock(),
  });

  const navRef = useRef<NavMeshSetup>({
    crowd: null,
    agent: null,
    navMeshQuery: null,
  });

  // Three.jsとメッシュの取得
  const { gl } = useThree();
  const meshes = useMeshStore((state) => state.meshes);
  const getMeshByLabel = useMeshStore((state) => state.getMeshByLabel);

  // メディアレコーダーの設定
  const { startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop(blobUrl, blob) {
      handleTalk(blob);
    },
  });

  // コントローラーのイベント取得
  const controller = useXRInputSourceState("hand", "left");

  // 長押し開始時の処理
  useXRInputSourceEvent(
    controller?.inputSource,
    "selectstart",
    () => {
      setText("録音中...");
      startRecording();
    },
    [controller]
  );

  // 長押し終了時の処理
  useXRInputSourceEvent(
    controller?.inputSource,
    "selectend",
    () => {
      setText("考え中...");
      stopRecording();
    },
    [controller]
  );

  // 音声認識と会話処理
  async function handleTalk(blob: Blob) {
    if (stateRef.current.isGeneratingResponse) return;

    stateRef.current.isGeneratingResponse = true;
    setMode("thinking");

    if (animRef.current.mixer) {
      playAnimation("thinking");
    }

    try {
      const form = new FormData();
      form.set("file", blob);

      const res = await fetch(`/api/chat/${character.id}`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (!res.ok) {
        setText("エラーが発生しました。");
      } else {
        setText(json.response);
      }
    } catch (error) {
      setText("エラーが発生しました。");
    } finally {
      stateRef.current.isGeneratingResponse = false;
    }
  }

  // アニメーション停止関数
  function stopAnimation(name: AnimationType) {
    const anim = animRef.current.animations.get(name);
    if (anim && animRef.current.mixer) {
      animRef.current.mixer.clipAction(anim).stop();
    }
  }

  // アニメーション再生関数
  function playAnimation(name: AnimationType) {
    const anim = animRef.current.animations.get(name);
    if (anim && animRef.current.mixer) {
      animRef.current.mixer.clipAction(anim).play();
    }
  }

  // エージェントの移動先を設定
  function moveAgent() {
    if (mode !== "walking") return;

    const { navMeshQuery, agent } = navRef.current;
    if (navMeshQuery && agent) {
      const { randomPoint } = navMeshQuery.findRandomPointAroundCircle(
        gl.xr.getCamera().position,
        0.2
      );
      agent.requestMoveTarget(randomPoint);
    }
  }

  // モデルの動きを更新
  function updateModelMovement() {
    if (!gltf) return;
    if (mode === "sitting") return;

    // 会話中はプレイヤーの方を向く
    if (mode === "thinking") {
      gltf.scene.lookAt(
        gl.xr.getCamera().position.x,
        0,
        gl.xr.getCamera().position.z
      );
      return;
    }

    const { agent } = navRef.current;
    if (!agent) return;

    const agentPosition = new Vector3(
      agent.position().x,
      agent.position().y,
      agent.position().z
    );
    const agentDestination = new Vector3(
      agent.target().x,
      agent.target().y,
      agent.target().z
    );

    const distanceToTarget = agentPosition.distanceTo(agentDestination);
    const thresholdDistance = 0.05;

    if (distanceToTarget > thresholdDistance) {
      // 歩きアニメーション再生
      if (animRef.current.mixer) {
        stopAnimation("idle");
        playAnimation("walk");
      }

      // 目的地を向く
      gltf.scene.lookAt(agent.target().x, 0, agent.target().z);
    } else {
      // 待機アニメーション再生
      if (animRef.current.mixer) {
        stopAnimation("walk");
        playAnimation("idle");
      }
    }
  }

  // プレイヤーを見る
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

    // プレイヤーを目線で追う
    vrm.lookAt?.lookAt(camera.position);
  }

  // 座っている状態の位置と向きを設定
  function updateSittingPosition() {
    if (!gltf || mode !== "sitting") return;

    // テレビと椅子の位置を取得
    const couch = getMeshByLabel("couch");
    const screen = getMeshByLabel("screen");

    if (couch) {
      // 相対座標からワールド座標を取得
      const { x, z } = new Vector3().setFromMatrixPosition(couch.matrixWorld);
      gltf.scene.position.set(x, 0, z);
    }

    if (screen) {
      const { x, z } = new Vector3().setFromMatrixPosition(screen.matrixWorld);
      // テレビの方向に向ける
      gltf.scene.lookAt(x, 0, z);
    }
  }

  // モデルとアニメーションのロード
  async function loadModelsAndAnimations() {
    const loadedGltf = await loadVRM("/models/shibu.vrm");
    setGltf(loadedGltf);

    const mixer = new AnimationMixer(loadedGltf.scene);
    animRef.current.mixer = mixer;

    const animationPaths = {
      sit: "/anim/vrma/sit_anim.vrma",
      walk: "/anim/vrma/walk.vrma",
      idle: "/anim/vrma/idle.vrma",
      thinking: "/anim/vrma/thinking.vrma",
    };

    const loadedAnimations: AnimationCollection = {};

    // アニメーションを並列にロード
    await Promise.all(
      Object.entries(animationPaths).map(async ([name, path]) => {
        const anim = await loadVRM(path);
        const vrmAnim = anim.userData.vrmAnimations?.[0];
        if (vrmAnim) {
          const clip = createVRMAnimationClip(vrmAnim, loadedGltf.userData.vrm);
          animRef.current.animations.set(name, clip);
          loadedAnimations[name] = clip;
        }
      })
    );

    stateRef.current.isSetupComplete = true;

    return loadedAnimations;
  }

  // XRセッション開始時の処理
  const handleSessionStart = async () => {
    if (stateRef.current.isSetupComplete) return;

    init();
    await loadModelsAndAnimations();
  };

  const handlePlanesDetected = () => {
    if (
      meshes.size <= 0 ||
      !stateRef.current.isSetupComplete ||
      stateRef.current.isNavMeshBaked
    )
      return;

    const meshList = Array.from(meshes.values());
    const couch = getMeshByLabel("couch");

    if (animRef.current.mixer) {
      if (couch) {
        playAnimation("sit");
        setMode("sitting");
      } else {
        playAnimation("idle");
        setMode("walking"); // 椅子がないときはwalkingモード
      }
    }

    const result = setupNavMeshAndCrowd(meshList); // NavMeshを生成

    if (result) {
      navRef.current = {
        crowd: result.crowd || null,
        agent: result.agent || null,
        navMeshQuery: result.navMeshQuery || null,
      };
      stateRef.current.isNavMeshBaked = true;
    }
  };

  gl.xr.addEventListener("sessionstart", handleSessionStart);
  gl.xr.addEventListener("planesdetected", handlePlanesDetected);

  // モード変更時の処理
  useEffect(() => {
    moveAgent();
    const movementInterval = setInterval(moveAgent, 15000);
    return () => clearInterval(movementInterval);
  }, [mode]);

  // 毎フレーム実行
  useFrame(() => {
    const deltaTime = animRef.current.clock.getDelta();

    // アニメーションの更新
    if (animRef.current.mixer) {
      animRef.current.mixer.update(deltaTime);
    }

    // VRMの更新
    if (gltf) {
      gltf.userData.vrm.update(deltaTime);
      lookAtPlayer();
    }

    // モードに応じた更新
    if (mode === "walking") {
      updateWalkingMode();
    } else if (mode === "sitting") {
      updateSittingPosition();
    }
  });

  // 歩行モード時の更新
  function updateWalkingMode() {
    const { crowd, agent } = navRef.current;
    if (crowd && agent && gltf) {
      updateModelMovement();
      crowd.update(1 / 60);
      const { x, z } = agent.position();
      gltf.scene.position.set(x, 0, z);
    }
  }

  // モード切り替え処理
  function toggleMode() {
    if (!animRef.current.mixer) return;

    animRef.current.mixer.stopAllAction();

    if (mode === "walking") {
      playAnimation("sit");
      setMode("sitting");
    } else if (mode === "sitting") {
      playAnimation("walk");
      setMode("walking");
    }
  }

  return (
    <>
      {gltf ? (
        <>
          <primitive object={gltf.scene} />

          <SettingsPanel
            mode={mode}
            onClick={toggleMode}
            camera={gl.xr.getCamera()}
          />

          <TextBox text={text} camera={gl.xr.getCamera()} gltf={gltf} />
        </>
      ) : null}
    </>
  );
}
