import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AgentManager } from "../navigation/NavigationManager";
import { VRM } from "@pixiv/three-vrm";
import { Mesh, Vector3 } from "three";
import { AnimationManager } from "./AnimationManager";
import { getRandomInt } from "~/utils/getRandomInt";

export type StateType = "idle" | "walking" | "sitting" | "looking";

export type EventType = "sit" | "go_to_user_position";

export class MovementManager {
  private state: StateType;
  private gltf: GLTF;

  private animation: AnimationManager;
  private agent: AgentManager;

  private getMeshByLabel: (label: string) => Mesh | undefined;
  private getPlayerPosition: () => Vector3;

  private xr: XRSession;

  public isThinking: boolean = false;
  private isTalking: boolean = false;

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

    this.state = "idle";
    this.playIdle();

    this.xr = xr;

    this.randomMove();
    setInterval(this.randomMove.bind(this), 10000);
  }

  private distanceXZ(a: Vector3, b: Vector3) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private lookAtPlayer() {
    const vrm: VRM = this.gltf.userData.vrm;
    const target = this.getPlayerPosition();
    const dist = this.distanceXZ(this.gltf.scene.position, target);
    if (dist >= 0.5) {
      vrm.lookAt?.reset();
    } else {
      vrm.lookAt?.lookAt(target);
    }
  }

  private playIdle() {
    this.animation.stopAllAnimation();
    const choice = getRandomInt(1, 2);
    choice === 1
      ? this.animation.playAnimation("idle")
      : this.animation.playAnimation("stretch");
  }

  private playSit(couchPos: Vector3, lookAt: Vector3) {
    this.animation.stopAllAnimation();
    this.animation.playAnimation("sit");
    this.gltf.scene.position.set(couchPos.x, 0, couchPos.z);
    this.gltf.scene.lookAt(lookAt.x, this.gltf.scene.position.y, lookAt.z);
  }

  private playLooking(target: Vector3) {
    this.animation.stopAllAnimation();
    this.animation.playAnimation("looking");
    this.gltf.scene.lookAt(target.x, this.gltf.scene.position.y, target.z);

    setTimeout(() => {
      //stateがすでに変わっていたらスキップ
      if (this.state !== "looking" || this.isTalking || this.isThinking) return;

      this.state = "idle";
      this.playIdle();
    }, 8000);
  }

  private updateWalking() {
    const crowd = this.agent.getCrowd();
    const agent = this.agent.getAgent();
    crowd.update(1 / 60);
    const { x, z } = agent.position();
    this.gltf.scene.position.set(x, 0, z);
    this.animation.playAnimation("walk");
    this.gltf.scene.lookAt(agent.target().x, 0, agent.target().z);
  }

  private randomMove() {
    if (this.state !== "idle" || this.isTalking || this.isThinking) return;
    const couch = this.getMeshByLabel("couch");
    if (!couch) return;
    const couchPos = new Vector3().setFromMatrixPosition(couch.matrixWorld);
    if (this.distanceXZ(this.getPlayerPosition(), couchPos) < 0.5) {
      this.handleSitEvent();
    } else {
      if (getRandomInt(1, 2) === 1) {
        this.lookAround();
      } else {
        this.state = "idle";
        this.playIdle();
      }
    }
  }

  private headBoneLookAt(target: Vector3) {
    const vrm: VRM = this.gltf.userData.vrm;
    const head = vrm.humanoid.getNormalizedBoneNode("head");
    if (!head) return;
    vrm.lookAt?.lookAt(target);
    const orig = head.quaternion.clone();
    head.lookAt(target);
    const targ = head.quaternion.clone();
    head.quaternion.copy(orig);
    head.quaternion.slerpQuaternions(orig, targ, 0.5);
  }

  setEvent(event: EventType) {
    if (event === "sit") this.handleSitEvent();
    if (event === "go_to_user_position") this.handleGoToUserPositionEvent();
  }

  private lookAround() {
    this.state = "walking";
    const labels = ["table", "couch", "shelf", "screen"];
    const mesh = this.getMeshByLabel(
      labels[getRandomInt(0, labels.length - 1)]
    );
    if (!mesh) return;
    const targetPos = new Vector3().setFromMatrixPosition(mesh.matrixWorld);
    this.agent.moveTo(targetPos);
    const check = () => {
      const agent = this.agent.getAgent();
      const dist = this.distanceXZ(
        new Vector3(agent.position().x, 0, agent.position().z),
        targetPos
      );
      if (dist <= 1.5) {
        this.state = "looking";
        this.playLooking(targetPos);
      } else {
        this.xr.requestAnimationFrame(check);
      }
    };
    check();
  }

  private handleSitEvent() {
    this.state = "walking";
    const couch = this.getMeshByLabel("couch");
    const screen = this.getMeshByLabel("screen");
    if (!couch) return;
    const couchPos = new Vector3().setFromMatrixPosition(couch.matrixWorld);
    this.agent.moveTo(couchPos);
    const check = () => {
      const agent = this.agent.getAgent();
      const dist = this.distanceXZ(
        new Vector3(agent.position().x, 0, agent.position().z),
        couchPos
      );
      if (dist <= 0.8) {
        this.state = "sitting";
        const lookAt = screen
          ? new Vector3().setFromMatrixPosition(screen.matrixWorld)
          : this.getPlayerPosition();
        this.playSit(couchPos, lookAt);
      } else {
        this.xr.requestAnimationFrame(check);
      }
    };
    check();
  }

  private handleGoToUserPositionEvent() {
    this.state = "walking";
    const target = this.getPlayerPosition();
    this.agent.moveTo(target);
    const check = () => {
      const agent = this.agent.getAgent();
      const dist = this.distanceXZ(
        new Vector3(agent.position().x, 0, agent.position().z),
        target
      );
      if (dist <= 0.8) {
        this.state = "idle";
        this.animation.stopAllAnimation();
        this.animation.playAnimation("idle");
      } else {
        this.xr.requestAnimationFrame(check);
      }
    };
    check();
  }

  toggleThinking() {
    this.isThinking = !this.isThinking;

    if (this.isThinking) {
      //座り時だけそのままアニメーションする
      if (this.state === "sitting") {
        this.animation.playAnimation("thinking");
      } else {
        //アニメーションがおかしくならないようidleをはさむ
        this.animation.stopAllAnimation();
        this.animation.playAnimation("idle");
        this.animation.playAnimation("thinking");
      }
    } else {
      this.animation.stopAnimation("thinking");
    }
  }

  toggleTalking() {
    this.isTalking = !this.isTalking;
  }

  update() {
    if (this.state === "walking") this.updateWalking();
    if (this.isTalking) this.headBoneLookAt(this.getPlayerPosition());
    this.lookAtPlayer();
  }
}
