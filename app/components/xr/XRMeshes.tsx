import { useXRMeshes, XRMeshModel, XRSpace } from "@react-three/xr";
import { create } from "zustand";
import { Mesh } from "three";

interface MeshStore {
  meshes: Map<string, Mesh>;
  setMeshes: (key: string, mesh: Mesh) => void;
  getMeshByLabel: (label: string) => Mesh | undefined;
}

//メッシュをラベル分け
export const useMeshStore = create<MeshStore>((set) => ({
  meshes: new Map<string, Mesh>(),
  setMeshes: (key: string, mesh: Mesh): void =>
    set((state) => {
      const newMap = new Map(state.meshes);
      newMap.set(key, mesh);
      return { meshes: newMap };
    }),
  //メッシュ名からメッシュを取得
  getMeshByLabel: (label): Mesh | undefined =>
    useMeshStore.getState().meshes.get(label),
}));

export default function XRMeshes({
  transparent,
  opacity,
}: {
  transparent: boolean;
  opacity: number;
}) {
  const meshes = useXRMeshes();
  const setMeshes = useMeshStore((state) => state.setMeshes);

  //メッシュのタイプごとに色分け
  const getColorByLabel = (label: string) => {
    switch (label) {
      case "shelf":
        return "red";
      case "couch":
        return "blue";
      case "table":
        return "orange";
      case "global mesh":
        return "gray";
      case "screen":
        return "cyan";
      default:
        return "white";
    }
  };

  return (
    <>
      {meshes.map((mesh) => (
        <XRSpace space={mesh.meshSpace} key={mesh.semanticLabel}>
          <XRMeshModel
            mesh={mesh}
            onUpdate={(self: Mesh) => {
              setMeshes(mesh.semanticLabel!, self);
            }}
          >
            <meshPhongMaterial
              color={getColorByLabel(mesh.semanticLabel!)}
              opacity={opacity}
              transparent={transparent}
            />
          </XRMeshModel>
        </XRSpace>
      ))}
    </>
  );
}
