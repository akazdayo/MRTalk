import { VRM } from "@pixiv/three-vrm";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadVRM } from "./loadVRM";

export class VRMLoader {
  private gltf: GLTF | null = null;
  private vrm: VRM | null = null;

  async load(path: string) {
    this.gltf = await loadVRM(path);
    this.vrm = this.gltf.userData.vrm;

    return { gltf: this.gltf, vrm: this.vrm };
  }

  getGLTF() {
    return this.gltf;
  }

  getVRM() {
    return this.vrm;
  }
}
