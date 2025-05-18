# MRTalk-assistant

LangMem による長期記憶を持った MRTalk 用 AI アシスタント。

## Usage

依存関係の解決

```bash
rye sync
```

初回のみ DB を setup(memories スキーマにテーブルを作成)\
DBにはPostgreSQLにpgvectorが必要です。

```bash
$ rye run prisma generate
$ rye run prisma db push
$ rye run setup
```

開発サーバーの起動

```bash
$ rye run dev
```
