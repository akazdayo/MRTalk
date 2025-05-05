import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AgentManager } from "../navigation/NavigationManager";
import { VRM } from "@pixiv/three-vrm";
import { Mesh, Vector3 } from "three";
import { AnimationManager } from "./AnimationManager";

export type StateType = "idle" | "walking" | "sitting";
export type EventType = "sit" | "go_to_user_position";

export class MovementManager {
  private state: StateType;
  private gltf: GLTF;

  private animation: AnimationManager;
  private agent: AgentManager;

  private getMeshByLabel: (label: string) => Mesh | undefined;
  private getPlayerPosition: () => Vector3;

  private xr: XRSession;

  private isTalking: boolean;

  constructor(
    gltf: GLTF,
    animation: AnimationManager,
    agent: AgentManager,
    getMeshByLabel: (label: string) => Mesh | undefined,
    getPlayerPosition: () => Vector3,
    xr: XRSession
  ) {
    this.gltf = gltf;

    this.animation = animation;
    this.agent = agent;

    this.getMeshByLabel = getMeshByLabel;
    this.getPlayerPosition = getPlayerPosition;

    this.animation.playAnimation("idle");
    this.state = "idle";

    this.xr = xr;
    this.isTalking = false;

    setInterval(() => {
      if (!this.isTalking) {
        const couch = this.getMeshByLabel("couch");
        if (!couch) {
          return;
        }

        const couchVec = new Vector3().setFromMatrixPosition(couch.matrixWorld);

        if (
          this.distanceXZ(getPlayerPosition(), couchVec) < 0.5 &&
          this.state !== "sitting"
        ) {
          this.handleSitEvent();
        }
      }
    }, 5000);
  }

  distanceXZ(a: Vector3, b: Vector3) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  lookAt(targetVec: Vector3) {
    const vrm: VRM = this.gltf.userData.vrm;

    const distance = this.distanceXZ(this.gltf.scene.position, targetVec);
    if (distance > 0.5) {
      vrm.lookAt?.reset();
      return;
    }

    // プレイヤーを目線で追う
    vrm.lookAt?.lookAt(targetVec);
  }

  idle() {
    this.animation.stopAllAnimation();
    this.animation.playAnimation("idle");
  }

  walk(pointVec: Vector3) {
    this.agent.moveTo(pointVec);
  }

  sit(couchVec: Vector3, lookAt: Vector3) {
    this.animation.stopAllAnimation();
    this.animation.playAnimation("sit");
    this.gltf.scene.position.set(couchVec.x, -0.2, couchVec.z);
    this.gltf.scene.lookAt(lookAt.x, this.gltf.scene.position.y, lookAt.z);
  }

  updateWalking() {
    const crowd = this.agent.getCrowd();
    const agent = this.agent.getAgent();

    crowd.update(1 / 60);
    const { x, z } = agent.position();

    this.gltf.scene.position.set(x, 0, z);

    this.animation.playAnimation("walk");

    this.gltf.scene.lookAt(agent.target().x, 0, agent.target().z);
  }

  randomMove() {
    this.animation.stopAllAnimation();

    this.agent.moveTo(this.agent.getRandomPoint(this.getPlayerPosition()));

    const checkDistance = () => {
      const agent = this.agent.getAgent();
      const pos = this.agent.getTargetPosition();

      const distance = this.distanceXZ(
        new Vector3(agent.position().x, agent.position().y, agent.position().z),
        pos
      );

      if (distance < 0.1) {
        //プレイヤーに近づき終わったとき
        this.state = "idle";
        this.idle();
      } else {
        this.state = "walking";
        this.xr.requestAnimationFrame(checkDistance);
      }
    };

    checkDistance();
  }

  headBoneLookAt(lookAt: Vector3) {
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

  setEvent(event: EventType) {
    switch (event) {
      case "sit":
        this.handleSitEvent();
        break;
      case "go_to_user_position":
        this.handleGoToUserPositionEvent();
        break;
    }
  }

  handleSitEvent() {
    this.animation.stopAllAnimation();

    const couch = this.getMeshByLabel("couch");
    const screen = this.getMeshByLabel("screen");

    if (!couch) {
      return;
    }

    const couchVec = new Vector3().setFromMatrixPosition(couch.matrixWorld);

    this.agent.moveTo(couchVec);

    const checkDistance = () => {
      const agent = this.agent.getAgent();

      const distance = this.distanceXZ(
        new Vector3(agent.position().x, agent.position().y, agent.position().z),
        couchVec
      );

      if (distance < 0.8) {
        //椅子に近づき終わったとき
        const lookAt = screen
          ? new Vector3().setFromMatrixPosition(screen.matrixWorld)
          : this.getPlayerPosition();

        this.state = "sitting";
        this.sit(couchVec, lookAt);
      } else {
        this.state = "walking";
        this.xr.requestAnimationFrame(checkDistance);
      }
    };

    checkDistance();
  }

  handleGoToUserPositionEvent() {
    this.animation.stopAllAnimation();

    this.agent.moveTo(this.getPlayerPosition());

    const checkDistance = () => {
      const agent = this.agent.getAgent();
      const pos = this.agent.getTargetPosition();

      const distance = this.distanceXZ(
        new Vector3(agent.position().x, agent.position().y, agent.position().z),
        pos
      );

      if (distance < 0.8) {
        //プレイヤーに近づき終わったとき
        this.state = "idle";
        this.idle();
      } else {
        this.state = "walking";
        this.xr.requestAnimationFrame(checkDistance);
      }
    };

    checkDistance();
  }

  toggleTalking() {
    this.isTalking = !this.isTalking;
  }

  update() {
    if (this.state === "walking") {
      //歩き
      this.updateWalking();
    }

    if (this.isTalking) {
      //プレイヤーの方に頭を向ける
      this.headBoneLookAt(this.getPlayerPosition());
    }

    this.lookAt(this.getPlayerPosition());
  }
}
