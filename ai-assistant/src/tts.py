import base64
import io
import requests
from pydub import AudioSegment
from fastapi import HTTPException


class TTS:
    def generate(self, id: str, text: str, token: str):
        res = requests.get(
            f"http://localhost:9000/tts?id={id}&text={text}",
            headers={"Authorization": f"Bearer {token}"},
        )

        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to generate voice")

        audio_file = io.BytesIO(res.content)

        audio = AudioSegment.from_file(audio_file)
        wav_audio = io.BytesIO()

        audio.export(wav_audio, format="wav")
        wav_audio.seek(0)

        base64_audio = base64.b64encode(wav_audio.read()).decode("utf-8")

        return base64_audio
