import base64
import io
from pathlib import Path

from scipy.io import wavfile

from style_bert_vits2.tts_model import TTSModel
from style_bert_vits2.nlp import bert_models
from style_bert_vits2.constants import Languages


class TTS:
    def __init__(self):
        bert_models.load_model(
            Languages.JP, "ku-nlp/deberta-v2-large-japanese-char-wwm")
        bert_models.load_tokenizer(
            Languages.JP, "ku-nlp/deberta-v2-large-japanese-char-wwm")

        model_file = "Anneli/Anneli_e116_s32000.safetensors"
        config_file = "Anneli/config.json"
        style_file = "Anneli/style_vectors.npy"

        assets_root = Path("model_assets")

        self.model = TTSModel(
            model_path=assets_root / model_file,
            config_path=assets_root / config_file,
            style_vec_path=assets_root / style_file,
            device="cuda",
        )

    def generate(self, prompt: str):
        sr, audio = self.model.infer(text=prompt)

        buffer = io.BytesIO()

        wavfile.write(buffer, sr, audio)

        buffer.seek(0)

        base64_audio = base64.b64encode(buffer.read()).decode('utf-8')

        return base64_audio
