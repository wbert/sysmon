import asyncio
from fastapi import Depends, FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .deps import Settings, get_settings, get_snapshot

app = FastAPI()

# Set CORS using a cached settings
_settings: Settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.ALLOW_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/stats")
def stats(snapshot=Depends(get_snapshot)):
    return snapshot


@app.websocket("/ws/stats")
async def ws_stats(ws: WebSocket, settings: Settings = Depends(get_settings)):
    await ws.accept()
    try:
        while True:
            await ws.send_json(get_snapshot())
            await asyncio.sleep(settings.WS_INTERVAL)
    finally:
        await ws.close()

