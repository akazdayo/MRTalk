import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AgentManager, NavMeshManager } from "../navigation/NavigationManager";
import { VRM } from "@pixiv/three-vrm";
import { Mesh, Vector3 } from "three";
import { AnimationManager } from "./AnimationManager";

export type StateType = "walking" | "sitting" | "talking";

export class MovementManager {
  private state: StateType;
  private navigation: NavMeshManager | null = null;
  private agent: AgentManager | null = null;
  private gltf: GLTF;
  private animation: AnimationManager;
  private getMeshByLabel: (label: string) => Mesh | undefined;
  private player: Vector3;

  constructor(
    state: StateType,
    gltf: GLTF,
    animation: AnimationManager,
    getMeshByLabel: (label: string) => Mesh | undefined,
    player: Vector3
  ) {
    this.state = state;
    this.gltf = gltf;
    this.animation = animation;
    this.getMeshByLabel = getMeshByLabel;
    this.player = player;
    setInterval(() => {
      this.walk();
    }, 10000);
  }

  lookAtPlayer() {
    if (!this.gltf) return;
    const vrm: VRM = this.gltf.userData.vrm;

    const distance = this.gltf.scene.position.distanceTo(this.player);

    if (distance > 2) {
      vrm.lookAt?.reset();
      return;
    }

    // プレイヤーを目線で追う
    vrm.lookAt?.lookAt(this.player);
  }

  setup(navigation: NavMeshManager, agent: AgentManager) {
    this.navigation = navigation;
    this.agent = agent;

    this.walk();
  }

  walk() {
    if (this.state === "walking" && this.agent && this.player) {
      this.agent.moveRandomPoint(this.player);
    }
  }

  walking() {
    if (this.navigation && this.agent) {
      const crowd = this.agent.getCrowd();
      const agent = this.agent.getAgent();
      const distanceToTarget = this.agent.getDistanceToTarget();

      if (!crowd || !agent || !distanceToTarget) return;

      crowd.update(1 / 60);
      const { x, z } = agent.position();
      this.gltf.scene.position.set(x, 0, z);

      const thresholdDistance = 0.2;

      if (distanceToTarget > thresholdDistance) {
        // 歩きアニメーション再生
        this.animation.playAnimation("walk");
        this.animation.stopAnimation("idle");

        // 目的地を向く
        this.gltf.scene.lookAt(agent.target().x, 0, agent.target().z);
      } else {
        this.animation.playAnimation("idle");
        this.animation.stopAnimation("walk");
      }
    }
  }

  sitting() {
    const couch = this.getMeshByLabel("couch");
    const screen = this.getMeshByLabel("screen");

    if (couch) {
      // 相対座標からワールド座標を取得
      const { x, z } = new Vector3().setFromMatrixPosition(couch.matrixWorld);
      this.gltf.scene.position.set(x, 0, z);
    }

    if (screen) {
      const { x, z } = new Vector3().setFromMatrixPosition(screen.matrixWorld);
      // テレビの方向に向ける
      this.gltf.scene.lookAt(x, 0, z);
    }
  }

  talking() {
    if (!this.gltf) return;
    const vrm: VRM = this.gltf.userData.vrm;
    const headBone = vrm.humanoid.getNormalizedBoneNode("head");
    if (!headBone) return;

    vrm.lookAt?.lookAt(this.player);

    const originalRotation = headBone.quaternion.clone();

    headBone.lookAt(this.player);

    const targetRotation = headBone.quaternion.clone();

    headBone.quaternion.copy(originalRotation);

    headBone.quaternion.slerpQuaternions(originalRotation, targetRotation, 0.5);
  }

  update() {
    this.lookAtPlayer();

    switch (this.state) {
      case "walking":
        this.walking();
        break;
      case "sitting":
        this.sitting();
        break;
      case "talking":
        this.talking();
        break;
    }
  }

  switchState(state: StateType) {
    this.state = state;

    switch (state) {
      case "walking":
        this.animation.stopAllAnimation();

        this.animation.playAnimation("walk");
        this.walk();
        break;
      case "sitting":
        this.animation.stopAllAnimation();

        this.animation.playAnimation("sit");
        break;
      case "talking":
        break;
    }
  }

  getState() {
    return this.state;
  }
}
