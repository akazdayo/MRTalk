import {
  AnimationClip,
  AnimationMixer,
  AnimationUtils,
  Clock,
  Vector3,
} from "three";
import { loadVRM } from "./loadVRM";
import { createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM } from "@pixiv/three-vrm";

export class AnimationManager {
  private animations: Map<string, AnimationClip>;
  private gltf: GLTF;
  private mixer: AnimationMixer;
  private clock: Clock;

  private nextBlinkTime: number;
  private blinkDuration: number;
  private blinkElapsed: number;
  private blinking: boolean;

  constructor(gltf: GLTF) {
    this.animations = new Map();
    this.gltf = gltf;
    this.mixer = new AnimationMixer(gltf.scene);
    this.clock = new Clock();

    this.blinkDuration = 0.1;
    this.nextBlinkTime = this.randomInterval();
    this.blinkElapsed = 0;
    this.blinking = false;
  }

  async load(
    animations: Record<string, { path: string; isAdditive: boolean }>,
  ) {
    for (const name in animations) {
      const data = animations[name];

      const anim = await loadVRM(data.path);
      const vrmAnim = anim.gltf.userData.vrmAnimations?.[0];

      if (vrmAnim) {
        const clip = createVRMAnimationClip(vrmAnim, this.gltf.userData.vrm);

        if (data.isAdditive) {
          AnimationUtils.makeClipAdditive(clip);
        }

        this.animations.set(name, clip);
      }
    }
  }

  stopAnimation(name: string) {
    const anim = this.animations.get(name);

    if (anim) {
      this.mixer.clipAction(anim).stop();
    }
  }

  playAnimation(name: string) {
    const anim = this.animations.get(name);

    if (anim) {
      this.mixer.clipAction(anim).play();
    }
  }

  setSpeed(speed: number) {
    this.mixer.setTime(speed);
  }

  stopAllAnimation() {
    this.mixer.stopAllAction();
  }

  resetEmotion() {
    const vrm: VRM = this.gltf.userData.vrm;

    vrm.expressionManager?.setValue("neutral", 1);
    vrm.expressionManager?.setValue("happy", 0);
    vrm.expressionManager?.setValue("sad", 0);
    vrm.expressionManager?.setValue("angry", 0);
  }

  setEmotion(emotion: string) {
    const vrm: VRM = this.gltf.userData.vrm;

    switch (emotion) {
      case "happy":
        vrm.expressionManager?.setValue("happy", 1);
        break;
      case "sad":
        vrm.expressionManager?.setValue("sad", 1);
        break;
      case "angry":
        vrm.expressionManager?.setValue("angry", 1);

        break;
    }
  }

  update() {
    const deltaTime = this.clock.getDelta();
    const vrm: VRM = this.gltf.userData.vrm;

    vrm.update(deltaTime);
    this.mixer.update(deltaTime);

    this.updateBlink(deltaTime);
  }

  randomInterval(): number {
    return 1 + Math.random() * 4;
  }

  updateBlink(delta: number) {
    const vrm: VRM = this.gltf.userData.vrm;

    if (!vrm.expressionManager) return;

    if (!this.blinking) {
      this.nextBlinkTime -= delta;
      if (this.nextBlinkTime <= 0) {
        this.blinking = true;
        this.blinkElapsed = 0;
      }
    }

    if (this.blinking) {
      this.blinkElapsed += delta;
      const half = this.blinkDuration / 2;
      let weight: number;

      if (this.blinkElapsed < half) {
        weight = this.blinkElapsed / half;
      } else if (this.blinkElapsed < this.blinkDuration) {
        weight = 1 - (this.blinkElapsed - half) / half;
      } else {
        weight = 0;
        this.blinking = false;
        this.nextBlinkTime = this.randomInterval();
      }

      vrm.expressionManager.setValue("blink", weight);
    }
  }

  /**
   * Phase 4: メニュー連動アニメーション機能
   */

  // メニュー注目アニメーション
  playMenuFocusAnimation(): void {
    this.playAnimation("looking");
  }

  stopMenuFocusAnimation(): void {
    this.stopAnimation("looking");
  }

  // ジェスチャー成功時の反応アニメーション
  playGestureSuccessAnimation(): void {
    this.playAnimation("thinking");

    // 一定時間後に自動停止
    setTimeout(() => {
      this.stopAnimation("thinking");
    }, 1500);
  }

  // キャラクター紹介アニメーション
  playIntroductionAnimation(): void {
    this.stopAllAnimation();
    this.playAnimation("stretch");

    // 3秒後にアイドル状態に戻る
    setTimeout(() => {
      this.stopAnimation("stretch");
      this.playAnimation("idle");
    }, 3000);
  }

  // 視線制御機能
  setLookAtTarget(target: Vector3): void {
    const vrm: VRM = this.gltf.userData.vrm;
    if (vrm.lookAt) {
      const characterPosition = this.gltf.scene.position;
      const lookDirection = target.clone().sub(characterPosition).normalize();
      vrm.lookAt.lookAt(lookDirection);
    }
  }

  resetLookAt(): void {
    const vrm: VRM = this.gltf.userData.vrm;
    if (vrm.lookAt) {
      vrm.lookAt.lookAt(new Vector3(0, 0, 1));
    }
  }

  // 表情の段階的変更
  setEmotionWithIntensity(
    emotion: "happy" | "sad" | "angry",
    intensity: number = 1.0,
  ): void {
    const vrm: VRM = this.gltf.userData.vrm;

    if (!vrm.expressionManager) return;

    // 現在の表情をリセット
    this.resetEmotion();

    // 新しい表情を強度付きで設定
    vrm.expressionManager.setValue(
      emotion,
      Math.max(0, Math.min(1, intensity)),
    );
  }

  // アニメーション状態の取得
  getAnimationState(): {
    activeAnimations: string[];
    currentEmotion: string;
    isBlinking: boolean;
  } {
    const activeAnimations: string[] = [];

    // アクティブなアニメーションを確認
    this.animations.forEach((clip, name) => {
      const action = this.mixer.clipAction(clip);
      if (action.isRunning()) {
        activeAnimations.push(name);
      }
    });

    return {
      activeAnimations,
      currentEmotion: this.getCurrentEmotion(),
      isBlinking: this.blinking,
    };
  }

  private getCurrentEmotion(): string {
    const vrm: VRM = this.gltf.userData.vrm;

    if (!vrm.expressionManager) return "neutral";

    // 現在アクティブな表情を確認
    const expressions = ["happy", "sad", "angry"];
    for (const emotion of expressions) {
      const value = vrm.expressionManager.getValue(emotion);
      if (value && value > 0.1) {
        return emotion;
      }
    }

    return "neutral";
  }

  // メモリ使用量最適化
  optimizeForPerformance(level: "low" | "medium" | "high"): void {
    switch (level) {
      case "low":
        // 低性能モード: ブリンクの更新頻度を下げる
        this.blinkDuration = 0.2;
        break;
      case "medium":
        // 中性能モード: 標準設定
        this.blinkDuration = 0.15;
        break;
      case "high":
        // 高性能モード: 高品質設定
        this.blinkDuration = 0.1;
        break;
    }
  }

  // Phase 4: 複数アニメーションの同期再生
  playAnimationSequence(
    animations: { name: string; duration: number }[],
  ): Promise<void> {
    return new Promise((resolve) => {
      let currentIndex = 0;

      const playNext = () => {
        if (currentIndex >= animations.length) {
          resolve();
          return;
        }

        const current = animations[currentIndex];
        this.playAnimation(current.name);

        setTimeout(() => {
          this.stopAnimation(current.name);
          currentIndex++;
          playNext();
        }, current.duration * 1000);
      };

      playNext();
    });
  }

  // デバッグ情報の取得
  getDebugInfo(): any {
    const state = this.getAnimationState();
    return {
      ...state,
      loadedAnimations: Array.from(this.animations.keys()),
      nextBlinkTime: this.nextBlinkTime,
      mixerTime: this.mixer.time,
    };
  }
}
