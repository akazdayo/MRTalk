import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AgentManager } from "../navigation/NavigationManager";
import { VRM } from "@pixiv/three-vrm";
import { Mesh, Vector3 } from "three";
import { AnimationManager } from "./AnimationManager";

export type StateType = "walking" | "sitting" | "talking";

export class MovementManager {
  private state: StateType;
  private gltf: GLTF;

  private animation: AnimationManager;
  private agent: AgentManager;

  private getMeshByLabel: (label: string) => Mesh | undefined;
  private player: Vector3;

  constructor(
    state: StateType,
    gltf: GLTF,
    animation: AnimationManager,
    agent: AgentManager,
    getMeshByLabel: (label: string) => Mesh | undefined,
    player: Vector3
  ) {
    this.state = state;
    this.gltf = gltf;

    this.animation = animation;
    this.agent = agent;

    this.getMeshByLabel = getMeshByLabel;
    this.player = player;

    this.walk();

    setInterval(() => {
      this.walk();
    }, 10000);
  }

  lookAt(targetVec: Vector3) {
    const vrm: VRM = this.gltf.userData.vrm;

    const distance = this.gltf.scene.position.distanceTo(targetVec);

    if (distance > 2) {
      vrm.lookAt?.reset();
      return;
    }

    // プレイヤーを目線で追う
    vrm.lookAt?.lookAt(targetVec);
  }

  walk() {
    if (this.state === "walking" && this.agent && this.player) {
      this.agent.moveRandomPoint(this.player);
    }
  }

  walking(targetVec: Vector3) {
    const crowd = this.agent.getCrowd();
    const agent = this.agent.getAgent();

    const distanceToTarget = new Vector3(
      agent.position().x,
      agent.position().y,
      agent.position().z
    ).distanceTo(targetVec);

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

  sitting(couchVec: Vector3, lookAt: Vector3) {
    this.gltf.scene.position.set(couchVec.x, 0, couchVec.z);

    this.gltf.scene.lookAt(lookAt.x, 0, lookAt.z);
  }

  talking(lookAt: Vector3) {
    const vrm: VRM = this.gltf.userData.vrm;
    const headBone = vrm.humanoid.getNormalizedBoneNode("head");
    if (!headBone) return;

    vrm.lookAt?.lookAt(lookAt);

    const originalRotation = headBone.quaternion.clone();

    headBone.lookAt(lookAt);

    const targetRotation = headBone.quaternion.clone();

    headBone.quaternion.copy(originalRotation);

    headBone.quaternion.slerpQuaternions(originalRotation, targetRotation, 0.5);
  }

  update() {
    this.lookAt(this.player);

    switch (this.state) {
      case "walking": {
        const targetPosition = this.agent.getTargetPosition();

        if (targetPosition) this.walking(targetPosition);
        break;
      }
      case "sitting": {
        const couch = this.getMeshByLabel("couch");
        const screen = this.getMeshByLabel("screen");

        const couchVec = couch
          ? new Vector3().setFromMatrixPosition(couch.matrixWorld)
          : this.gltf.scene.position;

        const lookAt = screen
          ? new Vector3().setFromMatrixPosition(screen.matrixWorld)
          : this.player;

        this.sitting(couchVec, lookAt);
        break;
      }
      case "talking": {
        this.talking(this.player);
        break;
      }
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
