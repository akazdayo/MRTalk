import { Mesh, Vector3 } from "three";
import {
  Crowd,
  CrowdAgent,
  NavMesh,
  NavMeshQuery,
} from "@recast-navigation/core";
import { threeToSoloNavMesh, CrowdHelper } from "@recast-navigation/three";

export interface INavMeshFactory {
  createNavMesh(meshes: Mesh[]): NavMesh | null;
}

export class RecastNavMeshFactory implements INavMeshFactory {
  createNavMesh(meshes: Mesh[]): NavMesh | null {
    const { navMesh } = threeToSoloNavMesh(meshes, {
      walkableClimb: 0.05,
    }); //家具貫通防止
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
        "NavMeshの生成に失敗しました。Quest3でスペースのスキャンを行っているか確認してください。"
      );
      return;
    }

    this.navMeshQuery = new NavMeshQuery(this.navMesh);
  }
}

export class AgentManager {
  private crowd: Crowd;
  private agent: CrowdAgent;
  private crowdHelper: CrowdHelper;

  constructor(private navMesh: NavMesh) {
    this.crowd = new Crowd(navMesh, {
      maxAgents: 1,
      maxAgentRadius: 0.6,
    });

    this.agent = this.crowd.addAgent(new Vector3(0, 0, 0), {
      radius: 0.5,
      maxAcceleration: 4.0,
      maxSpeed: 2,
      pathOptimizationRange: 1.0,
      collisionQueryRange: 1.0,
    });

    this.crowdHelper = new CrowdHelper(this.crowd);
  }

  getCrowd() {
    return this.crowd;
  }

  getCrowdHelper() {
    return this.crowdHelper;
  }

  getAgent() {
    return this.agent;
  }

  getTargetPosition() {
    return new Vector3(
      this.agent.target().x,
      this.agent.target().y,
      this.agent.target().z
    );
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

  update() {
    this.crowdHelper.update();
  }
}
