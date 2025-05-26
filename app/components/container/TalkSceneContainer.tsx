import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { Container, Text } from "@react-three/uikit";
import XRMeshesComponent from "../xr/XRMeshes";
import { Button } from "../ui/button";
import Main from "../layout/main";
import VRM from "../xr/VRM";
import { Character } from "@prisma/client";
import { useEffect } from "react";
import WindowBox from "../xr/WindowBox";

const store = createXRStore({
  depthSensing: true,
  hand: { teleportPointer: true, model: false },
});

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
          <WindowBox
            title="Overlay Window"
            width={30}
            height={3}
            overlay={true}
            distance={0.2}
            followCamera={true}
            verticalOffset={-0.3}
            onClose={() => console.log('オーバーレイウィンドウが閉じられました')}
          >
            <Container flexDirection="column" gap={0} padding={0}>
              <Text fontSize={16 / 8} fontWeight="bold">test</Text>
            </Container>
          </WindowBox>
        </XR>
      </Canvas>
    </Main>
  );
}
