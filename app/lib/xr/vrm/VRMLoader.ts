import { loadVRM } from "./loadVRM";

export class VRMLoader {
  async load(path: string) {
    const data = await loadVRM(path);

    return {
      gltf: data.gltf,
      vrm: data.gltf.userData.vrm,
      helperRoot: data.helperRoot,
    };
  }
}
