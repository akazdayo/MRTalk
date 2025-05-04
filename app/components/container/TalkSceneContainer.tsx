import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import XRMeshesComponent from "../xr/XRMeshes";
import { Button } from "../ui/button";
import Main from "../layout/main";
import VRM from "../xr/VRM";
import { Character } from "@prisma/client";
import { useEffect } from "react";

const store = createXRStore();

export default function TalkSceneContainer({
  character,
}: {
  character: Character;
}) {
  useEffect(() => {
    function checkMicPermission() {
      navigator.mediaDevices
        .getUserMedia({ video: false, audio: true })
        .then((stream) => {
          console.log(stream);
        })
        .catch(() => {
          alert("Please allow microphone access to use this feature.");
        });
    }

    checkMicPermission();
  }, []);

  return (
    <Main>
      <Button onClick={() => store.enterAR()}>Enter MR</Button>

      <Canvas>
        <XR store={store}>
          <ambientLight />
          <XRMeshesComponent transparent={true} opacity={0} />
          <VRM character={character} />
        </XR>
      </Canvas>
    </Main>
  );
}
