import { useFrame } from "@react-three/fiber";
import { Container, FontFamilyProvider, Root, Text } from "@react-three/uikit";
import { Card, Button } from "@react-three/uikit-apfel";
import { useRef } from "react";
import { Group, Object3DEventMap, Vector3, WebXRArrayCamera } from "three";

export default function SettingsPanel({
  mode,
  onClick,
  camera,
}: {
  mode: "sitting" | "walking";
  onClick: () => void;
  camera: WebXRArrayCamera;
}) {
  const groupRef = useRef<Group<Object3DEventMap> | null>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(
        new Vector3(camera.position.x, 0, camera.position.z)
      );
    }
  });

  return (
    <group ref={groupRef} position={[1, 0, 1]}>
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
              <Button size="xs" onClick={onClick}>
                <FontFamilyProvider
                  noto-sans={{
                    normal:
                      "/fonts/noto-sans-cjk-jp/noto-sans-cjk-jp-msdf.json",
                  }}
                >
                  <Text fontFamily="noto-sans">
                    {mode === "walking" ? "座らせる" : "歩く"}
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
