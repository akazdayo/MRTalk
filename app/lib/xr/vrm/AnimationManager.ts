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

  constructor(gltf: GLTF) {
    this.animations = new Map();
    this.gltf = gltf;
    this.mixer = new AnimationMixer(gltf.scene);
    this.clock = new Clock();
  }

  async load(
    animations: Record<string, { path: string; isAdditive: boolean }>
  ) {
    for (const name in animations) {
      const data = animations[name];

      const anim = await loadVRM(data.path);
      const vrmAnim = anim.userData.vrmAnimations?.[0];

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
      case "neutral":
        vrm.expressionManager?.setValue("neutral", 1);

        break;
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
  }
}
