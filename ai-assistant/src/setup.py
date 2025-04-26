import os
from langgraph.store.postgres import PostgresStore
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL") or ""

with PostgresStore.from_conn_string(db_url) as store:
    store.conn.execute("SET search_path TO memories")
    store.setup()
