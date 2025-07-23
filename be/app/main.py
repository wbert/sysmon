import asyncio
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.deps import get_settings, get_snapshot, Settings

app = FastAPI()
settings: Settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOW_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: set[WebSocket] = set()


async def broadcaster():
    while True:
        snap = get_snapshot()  # one snapshot for everyone
        dead = []
        for ws in clients:
            try:
                await ws.send_json(snap)
            except Exception:
                dead.append(ws)
        for ws in dead:
            clients.discard(ws)
        await asyncio.sleep(settings.WS_INTERVAL)


@app.on_event("startup")
async def start_bg_task():
    asyncio.create_task(broadcaster())


@app.get("/api/stats")
def stats():
    return get_snapshot()


@app.websocket("/ws/stats")
async def ws_stats(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        # keep the connection alive; broadcaster sends data
        while True:
            await asyncio.sleep(3600)
    finally:
        clients.discard(ws)
        await ws.close()

