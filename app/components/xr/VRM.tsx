import { useState, useEffect } from "react";
import { Html } from "@react-three/drei";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

export default function VRM() {
  const [gltf, setGltf] = useState<GLTF>();
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!gltf) {
      const loader = new GLTFLoader();
      loader.register((parser) => {
        return new VRMLoaderPlugin(parser);
      });

      loader.load(
        "/models/AliciaSolid.vrm",
        (tmpGltf) => {
          setGltf(tmpGltf);
          console.log("loaded");
        },
        (xhr) => {
          setProgress((xhr.loaded / xhr.total) * 100);
          console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        (error) => {
          console.log("An error happened");
          console.log(error);
        }
      );
    }
  }, [gltf]);

  return (
    <>
      {gltf ? (
        <primitive object={gltf.scene} />
      ) : (
        <Html center>{progress} % loaded</Html>
      )}
    </>
  );
}
