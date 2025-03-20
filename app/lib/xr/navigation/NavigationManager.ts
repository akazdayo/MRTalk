import { Mesh, Vector3 } from "three";
import {
  Crowd,
  CrowdAgent,
  NavMesh,
  NavMeshQuery,
} from "@recast-navigation/core";
import { threeToSoloNavMesh } from "@recast-navigation/three";

export interface INavMeshFactory {
  createNavMesh(meshes: Mesh[]): NavMesh | null;
}

export class RecastNavMeshFactory implements INavMeshFactory {
  createNavMesh(meshes: Mesh[]): NavMesh | null {
    const { navMesh } = threeToSoloNavMesh(meshes);
    return navMesh || null;
  }
}

export class NavMeshManager {
  private navMesh: NavMesh | null = null;
  private navMeshQuery: NavMeshQuery | null = null;
  private factory: INavMeshFactory;

  constructor(factory: INavMeshFactory = new RecastNavMeshFactory()) {
    this.factory = factory;
  }

  getNavMesh() {
    return this.navMesh;
  }

  getNavMeshQuery() {
    return this.navMeshQuery;
  }

  bake(meshes: Mesh[]) {
    if (meshes.length <= 0) return;

    this.navMesh = this.factory.createNavMesh(meshes);
    if (!this.navMesh) {
      alert(
        "ナビメッシュの生成に失敗しました。Quest3でスペースのスキャンを行っているか確認してください。"
      );
      return;
    }

    this.navMeshQuery = new NavMeshQuery(this.navMesh);
  }
}

export class AgentManager {
  private crowd: Crowd | null = null;
  private agent: CrowdAgent | null = null;

  constructor(private navMesh: NavMesh) {
    this.crowd = new Crowd(navMesh, {
      maxAgents: 1,
      maxAgentRadius: 0.6,
    });

    this.agent = this.crowd.addAgent(new Vector3(0, 0, 0), {
      radius: 0.15,
      height: 1.5,
      maxAcceleration: 8.0,
      maxSpeed: 2,
      pathOptimizationRange: 1.0,
    });
  }

  getCrowd() {
    return this.crowd;
  }

  getAgent() {
    return this.agent;
  }

  moveRandomPoint(center: Vector3) {
    if (!this.agent) return;
    const navMeshQuery = new NavMeshQuery(this.navMesh);
    const { randomPoint } = navMeshQuery.findRandomPointAroundCircle(
      center,
      0.2
    );
    this.agent.requestMoveTarget(randomPoint);
  }

  getDistanceToTarget() {
    if (!this.agent) return null;

    const agentVec = this.agent.position();
    const targetVec = this.agent.target();

    return new Vector3(agentVec.x, agentVec.y, agentVec.z).distanceTo(
      targetVec
    );
  }
}
