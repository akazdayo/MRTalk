# MRTalk-assistant

LangMem による長期記憶を持った MRTalk 用 AI アシスタント。

## Usage

依存関係の解決

```bash
rye sync
```

.env にクレデンシャルを記入

```bash
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
DATABASE_URL=""
```

初回のみ DB を setup(memories スキーマにテーブルを作成)

```bash
rye run python src/setup.py
```

開発サーバーの起動

```bash
rye run dev
```
