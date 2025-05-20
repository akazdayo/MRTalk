import asyncio
import asyncio
import datetime
import io
import os
import random # Added for rock-paper-scissors
from typing import Any, Dict, List, Tuple, Literal # Added List, Literal for game choices

import openai
import speech_recognition as sr
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from langchain.schema import AIMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.func import entrypoint
from langgraph.store.postgres import AsyncPostgresStore
from langmem import create_memory_store_manager
from psycopg import AsyncConnection
from pydub import AudioSegment

from prisma import Prisma
from prisma.models import Character, Session
from src.schema import EmotionMessage, Response
from src.tts import TTS

r = sr.Recognizer()
app = FastAPI()
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")
structured_llm = llm.with_structured_output(EmotionMessage)
db_url = os.getenv("DATABASE_URL") or ""
openai.api_base = os.getenv("OPENAI_BASE_URL", "https://models.github.ai/inference")


# ユーザーID、キャラクターIDのネームスペースに記憶を保存
memory_manager = create_memory_store_manager(
    llm,
    namespace=("memories", "{user_id}", "{character_id}"),
)


# 音声ファイルを文字起こし
async def get_audio_text(request: Request) -> str:
    form = await request.form()
    file = form["file"]

    assert not isinstance(file, str)
    file_content = await file.read()

    audio_file = io.BytesIO(file_content)

    audio = AudioSegment.from_file(audio_file)
    wav_audio = io.BytesIO()
    audio.export(wav_audio, format="wav")
    wav_audio.seek(0)

    with sr.AudioFile(wav_audio) as source:
        audio_data = r.record(source)

    try:
        text = r.recognize_google(audio_data, language="ja-JP")  # type:ignore

        return text
    except sr.UnknownValueError:
        raise HTTPException(status_code=400, detail="音声を理解できませんでした")
    except sr.RequestError:
        raise HTTPException(status_code=400, detail="エラーが発生しました。")


# セッションを取得
async def get_session(authorization: str = Header(None)) -> Session:
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")

    prisma = Prisma()
    await prisma.connect()

    session = await prisma.session.find_unique(
        where={"token": token}, include={"user": True}
    )

    await prisma.disconnect()

    if not session or session.expiresAt < datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return session


async def get_character(id: str) -> Character | None:
    prisma = Prisma()
    await prisma.connect()
    character = await prisma.character.find_unique(
        where={"id": id}, include={"voice": True}
    )

    if not character:
        raise HTTPException(status_code=400, detail="Character not found")

    await prisma.disconnect()
    return character


# 記憶を保存
async def save_memory(
    user_input: str, user_id: str, character_id: str, response_content: str
):
    async with AsyncPostgresStore.from_conn_string(
        db_url,
        index={
            "dims": 1536,
            "embed": "openai:text-embedding-3-small",
            "fields": ["text"],
        },
    ) as store:
        assert isinstance(store.conn, AsyncConnection)
        await store.conn.execute("SET search_path TO memories, public")
        await store.setup()

        @entrypoint(store=store)
        async def save(params: Dict[str, Any]):
            messages = [
                HumanMessage(content=params["user_input"]),
                AIMessage(content=params["response_content"]),
            ]

            await memory_manager.ainvoke(
                {"messages": messages},
                config={
                    "configurable": {
                        "user_id": params["user_id"],
                        "character_id": params["character_id"],
                    }
                },
            )

        await save.ainvoke(
            {
                "user_input": user_input,
                "user_id": user_id,
                "character_id": character_id,
                "response_content": response_content,
            }
        )


async def chat(text: str, session: Session, character_id: str):
    async with AsyncPostgresStore.from_conn_string(
        db_url,
        index={
            "dims": 1536,
            "embed": "openai:text-embedding-3-small",
            "fields": ["text"],
        },
    ) as store:
        assert isinstance(store.conn, AsyncConnection)
        await store.conn.execute("SET search_path TO memories, public")
        await store.setup()

        @entrypoint(store=store)
        async def generate(params: Dict[str, Any]) -> Response | None:
            messages = params["messages"]
            user_id = params["user_id"]
            character_id = params["character_id"]
            character = await get_character(character_id)
            if not (character):
                raise HTTPException(status_code=400, detail="Character Not Found")

            if not character.isPublic and character.postedBy != user_id:
                raise HTTPException(status_code=400, detail="Character Not Found")

            memories = await store.asearch(("memories", user_id, character_id))
            memory_text = "\n".join(m.value["content"]["content"] for m in memories)

            system_prompt = f"""
          あなたは、キャラクターになりきってユーザーと共に暮らしながら会話をするAIエージェントです。メッセージは100字以内の日常会話らしい短くシンプルなものにしましょう。

          <important>
          あなたはユーザーと共同生活をしています。ユーザの役にたつAIアシスタントとしてではなく、ユーザと共に生活するパートナーとして振る舞いましょう。
          </important>

          あなたがなりきるキャラクターの名前は、「{character.name}」です。

          あなたがなりきるキャラクターの人格や基本設定は、以下の通りです。

          <personality>
          {character.personality}
          </personality>

          <story>
          {character.story}
          </story>

          ユーザーとの思い出や記憶は、以下の通りです。
          <memories>
          {memory_text}
          </memories>

          応答は必ず以下のJSON形式で返してください。eventには、キャラクターが行動する場面(座りたい時など)だけに入れて、そうでない場合はNoneを入れてください。
          {{
            "role":"assistant",
            "content": "キャラクターの返答メッセージ",
            "emotion": {{
              "neutral": 0.1から1.0の数値,
              "happy": 0.1から1.0の数値,
              "sad": 0.1から1.0の数値,
              "angry": 0.1から1.0の数値
            }}
            "event": {{
              "type":"sit" | "go_to_user_position" | None
            }},
            "game_ai_choice": "rock" | "paper" | "scissors" | None,
            "game_result": "win" | "lose" | "draw" | None
          }}

          ユーザーが「じゃんけんしよう」や「じゃんけんぽん」などと言ってじゃんけんを提案してきた場合、あなたはじゃんけんに応じます。
          あなたの手はランダムに決めてください。
          ユーザーの手が不明な場合は、まず「じゃんけんぽん！」や「出す手を選んでね！」のように応答し、ユーザーの次の手を待ってください。この時、game_ai_choice と game_result は null にしてください。
          ユーザーが手を出したら（例：「グー」、「パー」、「チョキ」）、あなたも手（rock, paper, scissors のいずれか）を出し、結果（win, lose, draw のいずれか）を判定してください。
          結果はユーザーから見た結果です。例えば、ユーザーがグー、AIがパーを出した場合、ユーザーの負けなので game_result は "lose" となります。
          じゃんけんの結果とあなたの手を game_ai_choice と game_result に設定し、contentフィールドには結果に基づいた楽しい会話メッセージを入れてください。
          """

            user_message_content = messages[-1]["content"]
            game_ai_choice, game_result, game_related_content = await play_rock_paper_scissors(user_message_content, memory_text)

            if game_related_content:
                # If game logic handled the response, use it directly
                # We might need to generate emotion based on the game outcome.
                # For now, let's use a placeholder or a simple logic for emotion.
                # This part needs to be refined to generate appropriate emotion.
                # For instance, if AI wins, it could be happy. If it loses, perhaps neutral or slightly sad.
                emotion = EmotionMessage.model_validate(
                    {"neutral": 0.5, "happy": 0.3, "sad": 0.1, "angry": 0.1}
                ).emotion # Example emotion
                if game_result == "win": # AI perspective, so user lost
                    emotion = EmotionMessage.model_validate(
                        {"neutral": 0.2, "happy": 0.7, "sad": 0.0, "angry": 0.1}
                    ).emotion
                elif game_result == "lose": # AI perspective, so user won
                    emotion = EmotionMessage.model_validate(
                        {"neutral": 0.6, "happy": 0.2, "sad": 0.1, "angry": 0.1}
                    ).emotion


                response_data = {
                    "role": "assistant",
                    "content": game_related_content,
                    "emotion": emotion,
                    "event": None, # Or determine based on context
                    "game_ai_choice": game_ai_choice,
                    "game_result": game_result,
                }
                # Validate with EmotionMessage to ensure all fields are present if we directly construct it
                # However, the LLM is expected to return EmotionMessage structure.
                # If we bypass LLM for game, we construct it manually.
                final_response_obj = EmotionMessage(**response_data)

            else:
                # If not game-related, proceed with LLM
                llm_response = structured_llm.invoke(
                    [{"role": "system", "content": system_prompt}, *messages]
                )
                assert isinstance(llm_response, EmotionMessage)
                final_response_obj = llm_response
                # Ensure game fields are None if LLM doesn't populate them
                if not hasattr(final_response_obj, 'game_ai_choice'):
                    final_response_obj.game_ai_choice = None
                if not hasattr(final_response_obj, 'game_result'):
                    final_response_obj.game_result = None


            if not character.voice:
                raise HTTPException(
                    status_code=400, detail="Voice not configured for this character"
                )
            base64_voice = TTS.generate(
                character.voice.id, final_response_obj.content, session.token
            )

            res = Response(
                role=final_response_obj.role,
                content=final_response_obj.content,
                emotion=final_response_obj.emotion,
                event=final_response_obj.event,
                voice=base64_voice,
                # Manually add game fields to Response object if they are not part of EmotionMessage in all cases
                # However, they are now part of EmotionMessage, so this should work:
                # game_ai_choice=final_response_obj.game_ai_choice,
                # game_result=final_response_obj.game_result,
            )
            # The Response model needs to be updated to include game_ai_choice and game_result
            # For now, I'll assume EmotionMessage is directly used or mapped correctly.
            # Let's ensure all fields from final_response_obj are passed to Response
            response_dict = final_response_obj.model_dump()
            response_dict["voice"] = base64_voice
            
            # The Response model in schema.py has been updated to include game fields.
            # The final_response_obj (EmotionMessage) is returned by this function,
            # and FastAPI will use its model_dump() for the JSON response.
            # The voice is added here for completeness if we were to construct a full Response object,
            # but it's not strictly necessary since final_response_obj (EmotionMessage) is returned.
            # TTS.generate already produced the voice. The route handlers use final_response_obj.model_dump().
            # The 'voice' field is part of the Response model, but not EmotionMessage.
            # This suggests that the object returned by chat() should ideally be a Response object if TTS is done within chat().

            # Let's ensure the object returned by chat() will have the voice.
            # The routes do: response_obj = await chat(...); return JSONResponse(content=response_obj.model_dump())
            # So, chat() must return an object that, when model_dump()'ed, includes 'voice'.
            # EmotionMessage does not have 'voice'. Response does.
            # This means 'generate' should return a 'Response' object, not an 'EmotionMessage' object.

            # Correcting the return type of 'generate' and object construction:
            response_for_tts_and_memory = final_response_obj # This is EmotionMessage

            if not character.voice:
                raise HTTPException(
                    status_code=400, detail="Voice not configured for this character"
                )
            base64_voice = TTS.generate(
                character.voice.id, response_for_tts_and_memory.content, session.token
            )

            # Construct the final Response object that includes the voice and game fields
            final_api_response = Response(
                role=response_for_tts_and_memory.role,
                content=response_for_tts_and_memory.content,
                emotion=response_for_tts_and_memory.emotion,
                event=response_for_tts_and_memory.event,
                game_ai_choice=response_for_tts_and_memory.game_ai_choice,
                game_result=response_for_tts_and_memory.game_result,
                voice=base64_voice,
            )
            return final_api_response
        
        if not session.user:
            raise HTTPException(status_code=400, detail="Invalid session")

        # The generate function will now return a Response object.
        response_obj = await generate.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": session.user.id,
                "character_id": character_id,
            }
        )

        assert isinstance(response_obj, Response) # Changed back to Response

        # Parallel save memory
        asyncio.create_task(
            save_memory(
                text,
                session.user.id,
                character_id,
                response_obj.content, # use content from Response object
            )
        )

        return response_obj # Return Response object

# Helper function for rock-paper-scissors game logic
async def play_rock_paper_scissors(user_input: str, memory_text: str) -> Tuple[Literal["rock", "paper", "scissors"] | None, Literal["win", "lose", "draw"] | None, str | None]:
    user_input_lower = user_input.lower()
    # Keywords to detect game initiation
    initiation_keywords = ["じゃんけんしよう", "じゃんけんぽん", "じゃんけんしよ", "じゃんけんする", "rock paper scissors"]
    # Keywords for user's choice
    rock_keywords = ["rock", "グー", "ぐー"]
    paper_keywords = ["paper", "パー", "ぱー"]
    scissors_keywords = ["scissors", "チョキ", "ちょき"]

    ai_choices: List[Literal["rock", "paper", "scissors"]] = ["rock", "paper", "scissors"]
    
    # Check if user wants to start a game
    if any(keyword in user_input_lower for keyword in initiation_keywords):
        # Check if user also made a choice in the same message
        user_choice = None
        if any(keyword in user_input_lower for keyword in rock_keywords):
            user_choice = "rock"
        elif any(keyword in user_input_lower for keyword in paper_keywords):
            user_choice = "paper"
        elif any(keyword in user_input_lower for keyword in scissors_keywords):
            user_choice = "scissors"

        if user_choice:
            ai_choice = random.choice(ai_choices)
            result = determine_rps_winner(user_choice, ai_choice)
            response_content = f"じゃんけんぽん！私は{translate_choice_to_japanese(ai_choice)}！結果は... {translate_result_to_japanese(result, 'user')}！"
            if result == "win": # user wins
                response_content = f"私は{translate_choice_to_japanese(ai_choice)}！あなたの勝ち！やるね！"
            elif result == "lose": # user loses
                response_content = f"私は{translate_choice_to_japanese(ai_choice)}！やった、私の勝ちだ！"
            else: # draw
                response_content = f"私は{translate_choice_to_japanese(ai_choice)}！あいこだね！もう一回？"
            return ai_choice, result, response_content
        else:
            # AI prompts user to make a choice
            return None, None, "いいよ！じゃんけんしよう！最初はグー、じゃんけんぽん！何出す？"

    # Check if the user is making a choice (implicitly continuing a game)
    # This part relies on the conversation context (e.g., AI just prompted for a choice)
    # A simple check for choice keywords might lead to accidental game plays.
    # For now, we assume if choice keywords are present, it's a game move.
    # More robust state management might be needed (e.g. checking `memory_text` or a flag).
    
    # A simple way to check if a game was already initiated in memory (e.g. AI prompted to play)
    game_in_progress_keywords = ["何出す？", "じゃんけんぽん！", "出す手を選んでね！"]
    is_game_ongoing = any(keyword in memory_text for keyword in game_in_progress_keywords)

    user_choice = None
    if any(keyword in user_input_lower for keyword in rock_keywords):
        user_choice = "rock"
    elif any(keyword in user_input_lower for keyword in paper_keywords):
        user_choice = "paper"
    elif any(keyword in user_input_lower for keyword in scissors_keywords):
        user_choice = "scissors"

    if user_choice and is_game_ongoing: # Only proceed if user made a choice AND game seems to be ongoing
        ai_choice = random.choice(ai_choices)
        result = determine_rps_winner(user_choice, ai_choice)
        # User perspective for result: "win", "lose", "draw"
        response_content = f"あなたは{translate_choice_to_japanese(user_choice)}、私は{translate_choice_to_japanese(ai_choice)}！"
        if result == "win":
            response_content += "あなたの勝ちだね！すごい！"
        elif result == "lose":
            response_content += "私の勝ち！やったー！"
        else:
            response_content += "あいこだったね！もう一回する？"
        return ai_choice, result, response_content

    return None, None, None # No game action

def translate_choice_to_japanese(choice: str | None) -> str:
    if choice == "rock":
        return "グー"
    if choice == "paper":
        return "パー"
    if choice == "scissors":
        return "チョキ"
    return ""

def translate_result_to_japanese(result: str | None, perspective: str) -> str:
    # Perspective is 'user' or 'ai'
    if result == "win":
        return "勝ち" if perspective == "user" else "負け"
    if result == "lose":
        return "負け" if perspective == "user" else "勝ち"
    if result == "draw":
        return "あいこ"
    return ""

def determine_rps_winner(user_choice: Literal["rock", "paper", "scissors"], ai_choice: Literal["rock", "paper", "scissors"]) -> Literal["win", "lose", "draw"]:
    if user_choice == ai_choice:
        return "draw"
    if (user_choice == "rock" and ai_choice == "scissors") or \
       (user_choice == "scissors" and ai_choice == "paper") or \
       (user_choice == "paper" and ai_choice == "rock"):
        return "win" # User wins
    return "lose" # User loses

async def get_character(id: str) -> Character | None:

        if not session.user:
            raise HTTPException(status_code=400, detail="Invalid session")

        response = await generate.ainvoke(
            {
                "messages": [{"role": "user", "content": text}],
                "user_id": session.user.id,
                "character_id": character_id,
            }
        )

        assert isinstance(response, Response)

        # 並列で記憶を保存
        asyncio.create_task(
            save_memory(
                text,
                session.user.id,
                character_id,
                response.content,
            )
        )

        return response


@app.get("/chat")
async def chat_get(
    text: str,
    character_id: str,
    session: Session = Depends(get_session),
):
    # The response from chat() is now EmotionMessage directly
    response_obj = await chat(character_id=character_id, session=session, text=text)
    return JSONResponse(content=response_obj.model_dump())


@app.post("/chat")
async def chat_post(
    character_id: str,
    session: Session = Depends(get_session),
    text: str = Depends(get_audio_text),
):
    # The response from chat() is now EmotionMessage directly
    response_obj = await chat(character_id=character_id, session=session, text=text)
    return JSONResponse(content=response_obj.model_dump())
