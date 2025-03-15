import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import XRMeshesComponent from "../xr/XRMeshes";
import { Button } from "../ui/button";
import Main from "../layout/main";
import VRM from "../xr/VRM";

const store = createXRStore();

export default function TalkSceneContainer() {
  return (
    <Main>
      <Button onClick={() => store.enterAR()}>Enter AR</Button>

      <Canvas>
        <XR store={store}>
          <ambientLight />
          <XRMeshesComponent />
          <VRM />
        </XR>
      </Canvas>
    </Main>
  );
}
