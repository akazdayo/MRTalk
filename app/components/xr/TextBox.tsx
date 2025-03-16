import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Object3DEventMap, Vector3, WebXRArrayCamera } from "three";
import { Container, FontFamilyProvider, Root, Text } from "@react-three/uikit";
import { Card } from "@react-three/uikit-apfel";

export default function TextBox({
  text,
  camera,
}: {
  text: string;
  camera: WebXRArrayCamera;
}) {
  const groupRef = useRef<Group<Object3DEventMap> | null>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position);

      const direction = new Vector3();
      camera.getWorldDirection(direction);

      groupRef.current.position.set(
        camera.position.x + direction.x * 0.5,
        0.5,
        camera.position.z + direction.z * 0.5
      );
    }
  });

  return (
    <group ref={groupRef}>
      <Root>
        <Container gap={32}>
          <Card padding={16} width={100} height={50}>
            <Container gapRow={16}>
              <FontFamilyProvider
                noto-sans={{
                  normal: "/fonts/noto-sans-cjk-jp/noto-sans-cjk-jp-msdf.json",
                }}
              >
                <Text wordBreak="break-all" fontFamily="noto-sans" fontSize={5}>
                  {text}
                </Text>
              </FontFamilyProvider>
            </Container>
          </Card>
        </Container>
      </Root>
    </group>
  );
}
