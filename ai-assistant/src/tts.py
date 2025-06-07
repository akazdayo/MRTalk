import base64
import io
import os

import requests
from fastapi import HTTPException
from pydub import AudioSegment

URL = os.getenv("TTS_URL", "http://localhost:9000")


class TTS:
    @staticmethod
    def generate(id: str, text: str):
        res = requests.get(
            f"https://deprecatedapis.tts.quest/v2/voicevox/audio/?text={text}&key=U7G77-N_Y4e75-Q",
        )

        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to generate voice")

        audio_file = io.BytesIO(res.content)

        audio = AudioSegment.from_file(audio_file)

        # ファイルとして保存
        audio.export("./example.wav", format="wav")

        # Base64エンコード用の処理
        wav_audio = io.BytesIO()
        audio.export(wav_audio, format="wav")
        wav_audio.seek(0)

        base64_audio = base64.b64encode(wav_audio.read()).decode("utf-8")

        # Base64をデコードして別のファイルに保存
        decoded_audio = base64.b64decode(base64_audio)
        with open("./example_b64.wav", "wb") as f:
            f.write(decoded_audio)

        return base64_audio
