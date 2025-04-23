import base64
import io
import requests
from pydub import AudioSegment


class TTS:
    def generate(self, id: str, text: str):
        res = requests.get(f"http://localhost:8000/?id={id}&text={text}")

        audio_file = io.BytesIO(res.content)

        audio = AudioSegment.from_file(audio_file)
        wav_audio = io.BytesIO()

        audio.export(wav_audio, format="wav")
        wav_audio.seek(0)

        base64_audio = base64.b64encode(wav_audio.read()).decode("utf-8")

        return base64_audio
