import os

from langgraph.store.postgres import PostgresStore

db_url = os.getenv("DATABASE_URL") or ""

with PostgresStore.from_conn_string(db_url) as store:
    store.conn.execute("CREATE SCHEMA IF NOT EXISTS memories;")
    store.conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    store.conn.execute("SET search_path TO memories, public;")
    store.setup()
