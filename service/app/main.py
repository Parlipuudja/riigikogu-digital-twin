import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import close_db
from app.routers import data, health, sync

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.tasks.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    stop_scheduler()
    await close_db()


app = FastAPI(
    title="Riigikogu Radar",
    description="Estonian Parliament legibility service",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(sync.router)
app.include_router(data.router)
