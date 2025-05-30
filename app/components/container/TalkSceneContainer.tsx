import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { Container, Text } from "@react-three/uikit";
import XRMeshesComponent from "../xr/XRMeshes";
import { Button } from "../ui/button";
import Main from "../layout/main";
import VRM from "../xr/VRM";
import { Character } from "@prisma/client";
import { useEffect, useState } from "react";
import WindowBox from "../xr/WindowBox";
import { Res } from "~/lib/llm/Chat";
import XRInputHandler from "../xr/XRInputHandler";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

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

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const addChatMessage = (userMessage: string, assistantResponse: Res) => {
    setChatHistory(prev => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date()
      },
      {
        role: "assistant",
        content: assistantResponse.content,
        timestamp: new Date()
      }
    ]);
  };

  const [showChatLog, setShowChatLog] = useState(false);

  const handleToggleChatLog = () => {
    setShowChatLog((prev) => !prev);
  };

  return (
    <Main>
      <Button onClick={() => store.enterAR()}>Enter MR</Button>

      <Canvas>
        <XR store={store}>
          <XRInputHandler onToggleChatLog={handleToggleChatLog} />
          <ambientLight />
          <XRMeshesComponent transparent={true} opacity={0} />
          <VRM character={character} onChatMessage={addChatMessage} />
          {showChatLog && (
            <WindowBox
              title="Chat History"
              width={50}
              height={50}
              overlay={true}
              distance={0.4}
              followCamera={true}
              verticalOffset={-0.25}
            >
              <Container flexDirection="column" gap={0}>
                {chatHistory.map((message, index) => (
                  <Container key={index} flexDirection="column" gap={0.2} padding={1}>
                    <Text fontSize={1.5}>
                      {String(`${message.role}: ${message.content}`)}
                    </Text>
                  </Container>
                ))}
              </Container>
            </WindowBox>)}
        </XR>
      </Canvas>
    </Main>
  );
}
