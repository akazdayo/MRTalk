# MRTalk-assistant

LangMem による長期記憶を持った MRTalk 用 AI アシスタント。

## Usage

依存関係の解決

```bash
rye sync
```

.env にクレデンシャルを記入

```bash
$ cp .env.example .env
```

初回のみ DB を setup(memories スキーマにテーブルを作成)\
DBにはPostgreSQLにpgvectorが必要です。

```bash
$ rye run prisma generate
$ rye run python src/setup.py
```

開発サーバーの起動

```bash
$ rye run dev
```
