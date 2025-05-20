import base64
import io
import os

import requests
from fastapi import HTTPException
from pydub import AudioSegment

URL = os.getenv("TTS_URL", "http://localhost:9000")


class TTS:
    @staticmethod
    def generate(id: str, text: str, token: str):
        res = requests.get(
            f"{URL}/tts?id={id}&text={text}",
            headers={"Authorization": f"Bearer {token}"},
        )
        print("リクエスト返ってきた", res)

        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to generate voice")

        audio_file = io.BytesIO(res.content)

        audio = AudioSegment.from_file(audio_file)
        wav_audio = io.BytesIO()

        audio.export(wav_audio, format="wav")
        wav_audio.seek(0)

        base64_audio = base64.b64encode(wav_audio.read()).decode("utf-8")

        return base64_audio
