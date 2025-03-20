import { AnimationClip, AnimationMixer, Clock } from "three";
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

  async load(animations: Record<string, string>) {
    for (const name in animations) {
      const path = animations[name];

      const anim = await loadVRM(path);
      const vrmAnim = anim.userData.vrmAnimations?.[0];

      if (vrmAnim) {
        const clip = createVRMAnimationClip(vrmAnim, this.gltf.userData.vrm);
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

  stopAllAnimation() {
    this.mixer.stopAllAction();
  }

  update() {
    const deltaTime = this.clock.getDelta();

    const vrm: VRM = this.gltf.userData.vrm;

    vrm.update(deltaTime);

    this.mixer.update(deltaTime);
  }
}
