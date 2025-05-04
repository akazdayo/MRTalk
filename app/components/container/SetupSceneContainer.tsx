import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import XRMeshesComponent from "../xr/XRMeshes";
import { Button } from "../ui/button";
import Main from "../layout/main";

const store = createXRStore();

export default function SetupSceneContainer() {
  return (
    <Main>
      <Button onClick={() => store.enterAR()}>チュートリアルを開始する</Button>

      <Canvas>
        <XR store={store}>
          <ambientLight />
          <XRMeshesComponent transparent={false} opacity={0.5} />
        </XR>
      </Canvas>
    </Main>
  );
}
