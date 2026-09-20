"""ORCA Backend — FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — runs setup on startup, cleanup on shutdown."""
    setup_logging()
    logger = get_logger("main")
    settings = get_settings()
    logger.info("ORCA Backend starting — LLM provider: %s, model: %s",
                settings.llm_provider, settings.hf_model)
    yield
    logger.info("ORCA Backend shutting down")


app = FastAPI(
    title="ORCA — Ocean Risk & Coordinated Advisory",
    description=(
        "AI-orchestrated marine decision-support system. "
        "Coordinates weather, ocean and advisory data to produce "
        "evidence-backed risk assessments and recommendations."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(router)
