import { useXRMeshes, XRMeshModel, XRSpace } from "@react-three/xr";

export default function XRMeshes() {
  const meshes = useXRMeshes();

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
    }
  };

  return (
    <>
      {meshes.map((mesh) => (
        <XRSpace space={mesh.meshSpace} key={mesh.semanticLabel}>
          <XRMeshModel mesh={mesh}>
            <meshBasicMaterial color={getColorByLabel(mesh.semanticLabel!)} />
          </XRMeshModel>
        </XRSpace>
      ))}
    </>
  );
}
