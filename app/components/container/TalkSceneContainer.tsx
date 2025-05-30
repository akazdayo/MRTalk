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

// タイムスタンプをフォーマットする関数
function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();

  if (diff < 60000) { // 1分未満
    return "今";
  } else if (diff < 3600000) { // 1時間未満
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分前`;
  } else if (diff < 86400000) { // 24時間未満
    const hours = Math.floor(diff / 3600000);
    return `${hours}時間前`;
  } else {
    return timestamp.toLocaleDateString();
  }
}

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

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: "user",
      content: "Hello!",
      timestamp: new Date(Date.now() - 300000) // 5分前
    },
    {
      role: "assistant",
      content: "Hello! How can I assist you today?",
      timestamp: new Date(Date.now() - 280000) // 4分40秒前
    },
    {
      role: "user",
      content: "How was your day?",
      timestamp: new Date(Date.now() - 200000) // 3分20秒前
    },
    {
      role: "assistant",
      content: "My day has been great, thank you! I just finished a long walk in the park.",
      timestamp: new Date(Date.now() - 180000) // 3分前
    },
    {
      role: "user",
      content: "That sounds nice! I love walking in the park.",
      timestamp: new Date(Date.now() - 60000) // 1分前
    },
    {
      role: "assistant",
      content: "Yes, it's very refreshing! Do you have a favorite park?",
      timestamp: new Date(Date.now() - 30000) // 30秒前
    }
  ]);

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
