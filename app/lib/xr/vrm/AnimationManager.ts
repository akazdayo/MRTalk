import { AnimationClip, AnimationMixer, AnimationUtils, Clock } from "three";
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
    animations: Record<string, { path: string; isAdditive: boolean }>
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
}
