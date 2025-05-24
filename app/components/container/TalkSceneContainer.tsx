import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import XRMeshesComponent from "../xr/XRMeshes";
import { Button } from "../ui/button";
import Main from "../layout/main";
import VRM from "../xr/VRM";
import XRMenuSystem from "../xr/menu/XRMenuSystem";
import { Character } from "@prisma/client";
import { useEffect, useState, useCallback } from "react";

// Phase 2: 拡張されたキャラクター型定義
interface ExtendedCharacter extends Character {
  isFavorite?: boolean;
  stats?: {
    friendliness: number;
    intelligence: number;
    creativity: number;
    energy: number;
  };
}

const store = createXRStore({
  depthSensing: true,
  hand: { teleportPointer: true, model: false },
});

export default function TalkSceneContainer({
  character: initialCharacter,
}: {
  character: Character;
}) {
  // Phase 2: キャラクター状態管理の追加
  const [character, setCharacter] = useState<ExtendedCharacter>({
    ...initialCharacter,
    isFavorite: false, // デフォルト値
    stats: {
      friendliness: 75,
      intelligence: 80,
      creativity: 85,
      energy: 70
    }
  });
  const [isXRActive, setIsXRActive] = useState(false);

  // マイクの許可確認
  useEffect(() => {
    function checkMicPermission() {
      navigator.mediaDevices
        .getUserMedia({ video: false, audio: true })
        .then((stream) => {
          console.log("Microphone access granted:", stream);
          // ストリームを即座に停止（許可確認のみ）
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(() => {
          alert("Please allow microphone access to use this feature.");
        });
    }

    checkMicPermission();
  }, []);

  // XRセッション状態の監視（簡素化版）
  useEffect(() => {
    // XRセッション状態は実際のXRコンポーネント内で管理されるため、
    // ここでは単純化してボタンクリック時の状態管理のみ行う
    console.log('XR state monitoring initialized');
  }, []);

  // キャラクター更新ハンドラー（Phase 2の新機能）
  const handleCharacterUpdate = useCallback((updatedCharacter: any) => {
    // 基本プロパティのみ更新（型安全性を保つ）
    setCharacter(prev => ({
      ...prev,
      isFavorite: updatedCharacter.isFavorite,
      stats: updatedCharacter.stats,
      // 他の拡張プロパティもここで安全に更新
    }));

    // サーバーサイドでの更新も実装可能
    // TODO: APIエンドポイントを呼び出してキャラクター情報を永続化
    console.log('Character updated:', updatedCharacter);
  }, []);

  // XR開始ハンドラー
  const handleEnterXR = useCallback(async () => {
    try {
      setIsXRActive(true);
      await store.enterAR();
    } catch (error) {
      console.error('Failed to enter AR:', error);
      setIsXRActive(false);
      alert('ARモードの開始に失敗しました。WebXR対応デバイスでお試しください。');
    }
  }, []);

  return (
    <Main>
      <div className="flex flex-col gap-4 p-4">
        <Button
          onClick={handleEnterXR}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {isXRActive ? "XR セッション実行中" : "Mixed Reality を開始"}
        </Button>

        {/* Phase 2: キャラクター情報の表示 */}
        <div className="bg-gray-800 text-white p-4 rounded-lg">
          <h3 className="text-lg font-bold mb-2">{character.name}</h3>
          <p className="text-sm text-gray-300 mb-2">
            {character.personality || "性格情報なし"}
          </p>
          {character.isFavorite && (
            <span className="inline-block bg-yellow-500 text-black px-2 py-1 rounded text-xs">
              ⭐ お気に入り
            </span>
          )}
        </div>
      </div>

      <Canvas camera={{ position: [0, 1.6, 3] }}>
        <XR store={store}>
          {/* 環境光と方向光 */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          {/* XRメッシュ（パススルー） */}
          <XRMeshesComponent transparent={true} opacity={0} />

          {/* VRMキャラクター */}
          <VRM character={character} />

          {/* Phase 2: 拡張されたXRメニューシステム */}
          <XRMenuSystem
            character={character}
            onCharacterUpdate={handleCharacterUpdate}
          />
        </XR>
      </Canvas>
    </Main>
  );
}
