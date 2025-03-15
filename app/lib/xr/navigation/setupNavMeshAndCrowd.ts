import * as THREE from "three";
import { Mesh } from "three";
import { Crowd, NavMeshQuery } from "@recast-navigation/core";
import { threeToSoloNavMesh, DebugDrawer } from "@recast-navigation/three";

export function setupNavMeshAndCrowd(meshes: Mesh[]) {
  const { navMesh } = threeToSoloNavMesh(meshes);

  if (!navMesh) {
    alert(
      "キャラクターの移動可能範囲を取得できませんでした。Quest3側の設定で、スペースのスキャンを済ませているか、確認してください。"
    );
    return;
  }

  const maxAgents = 1;
  const maxAgentRadius = 0.6;

  const crowd = new Crowd(navMesh, {
    maxAgents,
    maxAgentRadius,
  });
  const navMeshQuery = new NavMeshQuery(navMesh);

  const debugDrawer = new DebugDrawer();
  debugDrawer.drawNavMesh(navMesh);

  const agent = crowd.addAgent(new THREE.Vector3(0, 0, 0), {
    radius: 0.15,
    height: 1.5,
    maxAcceleration: 4.0,
    maxSpeed: 0.5,
    pathOptimizationRange: 1.0,
  });

  return { crowd, agent, navMeshQuery };
}
