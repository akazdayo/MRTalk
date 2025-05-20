from typing import Literal
from pydantic import BaseModel, Field


class Emotion(BaseModel):
    neutral: float = Field(description="ニュートラルの感情値(0〜1の間)")
    happy: float = Field(description="幸せの感情値(0〜1の間)")
    sad: float = Field(description="悲しみの感情値(0〜1の間)")
    angry: float = Field(description="怒りの感情値(0〜1の間)")


class EmotionMessage(BaseModel):
    role: str = Field(description="メッセージの役割(assistant)")
    content: str = Field(description="メッセージ内容")
    emotion: Emotion = Field(description="感情オブジェクト")
    event: Literal["sit", "go_to_user_position"] | None = Field(
        None, description="キャラクターの行動を示すテキスト"
    )
    game_ai_choice: Literal["rock", "paper", "scissors"] | None = Field(
        None, description="AIのじゃんけんの選択"
    )
    game_result: Literal["win", "lose", "draw"] | None = Field(
        None, description="じゃんけんの結果（ユーザー視点）"
    )


class Response(BaseModel):
    role: str = Field(description="メッセージの役割(assistant)")
    content: str = Field(description="メッセージ内容")
    emotion: Emotion = Field(description="感情オブジェクト")
    event: Literal["sit", "go_to_user_position"] | None = Field(
        None, description="キャラクターの行動を示すテキスト"
    )
    voice: str = Field(description="Base64エンコードされた音声データ")
    game_ai_choice: Literal["rock", "paper", "scissors"] | None = Field(
        None, description="AIのじゃんけんの選択"
    )
    game_result: Literal["win", "lose", "draw"] | None = Field(
        None, description="じゃんけんの結果（ユーザー視点）"
    )
