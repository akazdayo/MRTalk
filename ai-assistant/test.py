import os
import sys

from dotenv import load_dotenv

from prisma import Prisma

# --env-file オプションの処理
env_file_path = None
if "--env-file" in sys.argv:
    env_file_index = sys.argv.index("--env-file") + 1
    if env_file_index < len(sys.argv):
        env_file_path = sys.argv[env_file_index]
        print(f"指定された.envファイル: {env_file_path}")
        load_dotenv(env_file_path)
    else:
        print("--env-file オプションにファイルパスが指定されていません")
else:
    # デフォルトで.envファイルを読み込み
    load_dotenv()

db_url = os.getenv("DATABASE_URL") or ""
print(f"DATABASE_URL: {db_url}")


async def get_todays_study_content():
    prisma = Prisma()
    await prisma.connect()

    study_content = await prisma.todays_study.find_first(
        where={"id": "0"},
    )

    await prisma.disconnect()

    return study_content.content


if __name__ == "__main__":
    import asyncio

    async def main():
        content = await get_todays_study_content()
        print(content)

    asyncio.run(main())
