import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Object3DEventMap, WebXRArrayCamera } from "three";
import { Container, FontFamilyProvider, Root, Text } from "@react-three/uikit";
import { Card } from "@react-three/uikit-apfel";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function TextBox({
  text,
  camera,
  gltf,
}: {
  text: string;
  camera: WebXRArrayCamera;
  gltf: GLTF;
}) {
  //UIをプレイヤーに向ける
  const groupRef = useRef<Group<Object3DEventMap> | null>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[gltf.scene.position.x, 1.8, gltf.scene.position.z]}
    >
      <Root>
        <Container gap={32}>
          <Card padding={16} width={100} height={50}>
            <Container gapRow={16}>
              <FontFamilyProvider
                keifont={{
                  normal: "/fonts/keifont/keifont.json",
                }}
              >
                <Text wordBreak="break-all" fontFamily="keifont" fontSize={3}>
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
