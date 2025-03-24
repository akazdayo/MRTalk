import { useFrame } from "@react-three/fiber";
import { Container, FontFamilyProvider, Root, Text } from "@react-three/uikit";
import { Card, Button } from "@react-three/uikit-apfel";
import { useRef } from "react";
import { Group, Object3DEventMap, Vector3, WebXRArrayCamera } from "three";
import { StateType } from "~/lib/xr/vrm/MovementManager";

export default function SettingsPanel({
  onClick,
  camera,
}: {
  onClick: (state: StateType) => void;
  camera: WebXRArrayCamera;
}) {
  //UIをプレイヤーに向ける
  const groupRef = useRef<Group<Object3DEventMap> | null>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(
        new Vector3(camera.position.x, 0, camera.position.z)
      );
    }
  });

  return (
    <group ref={groupRef} position={[0.5, 0, 0.5]}>
      <Root>
        <Container
          flexDirection="column"
          md={{ flexDirection: "row" }}
          alignItems="center"
          gap={32}
          positionBottom={100}
        >
          <Card borderRadius={32} padding={16}>
            <Container
              flexDirection="column"
              justifyContent="space-between"
              alignItems="center"
              gapRow={16}
            >
              <Button size="xs" onClick={() => onClick("walking")}>
                <FontFamilyProvider
                  keifont={{
                    normal: "/fonts/keifont/keifont.json",
                  }}
                >
                  <Text wordBreak="break-all" fontFamily="keifont">
                    歩き
                  </Text>
                </FontFamilyProvider>
              </Button>

              <Button size="xs" onClick={() => onClick("sitting")}>
                <FontFamilyProvider
                  keifont={{
                    normal: "/fonts/keifont/keifont.json",
                  }}
                >
                  <Text wordBreak="break-all" fontFamily="keifont">
                    座り
                  </Text>
                </FontFamilyProvider>
              </Button>
            </Container>
          </Card>
        </Container>
      </Root>
    </group>
  );
}
