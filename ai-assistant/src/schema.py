from pydantic import BaseModel, Field


class Emotion(BaseModel):
    neutral: float = Field(description="ニュートラルの感情値（0〜1の間）")
    happy: float = Field(description="幸せの感情値（0〜1の間）")
    sad: float = Field(description="悲しみの感情値（0〜1の間）")
    angry: float = Field(description="怒りの感情値（0〜1の間）")


class EmotionMessage(BaseModel):
    role: str = Field(description="メッセージの役割（assistant）")
    content: str = Field(description="メッセージ内容")
    emotion: Emotion = Field(description="感情オブジェクト")
    voice: str = Field(description="Base64エンコードされた音声データ", default=None)
