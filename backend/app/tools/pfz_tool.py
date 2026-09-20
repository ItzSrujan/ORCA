"""PFZ tool — Potential Fishing Zone advisory with fallback data."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger("tools.pfz")

FALLBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "fallback_pfz.json"


def _load_fallback() -> list[dict]:
    """Load fallback PFZ data from JSON."""
    try:
        if FALLBACK_PATH.exists():
            with open(FALLBACK_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as exc:
        logger.error("Failed to load fallback PFZ data: %s", exc)
    return []


def _find_nearest_zone(zones: list[dict], lat: float, lon: float, max_degrees: float = 1.5) -> dict | None:
    """Find the nearest PFZ zone to the given coordinates within maximum coastal radius."""
    best = None
    best_dist = float("inf")
    for z in zones:
        zlat = z.get("latitude", 0)
        zlon = z.get("longitude", 0)
        dist = (zlat - lat) ** 2 + (zlon - lon) ** 2
        if dist < best_dist and dist <= (max_degrees ** 2):
            best_dist = dist
            best = z
    return best


async def fetch_pfz(lat: float, lon: float) -> dict:
    """Fetch PFZ advisory data.

    Currently loads from fallback JSON. Every result is clearly labelled
    as prototype fallback data.
    """
    zones = _load_fallback()

    if not zones:
        logger.info("No PFZ fallback data available")
        return {
            "available": False,
            "zone": "",
            "summary": "No PFZ data available",
            "issued_at": "",
            "latitude": lat,
            "longitude": lon,
            "source": "prototype_fallback",
            "is_live": False,
        }

    nearest = _find_nearest_zone(zones, lat, lon)
    if nearest is None:
        return {
            "available": False,
            "zone": "",
            "summary": "No nearby PFZ zone found in fallback data",
            "issued_at": "",
            "latitude": lat,
            "longitude": lon,
            "source": "prototype_fallback",
            "is_live": False,
        }

    logger.info("PFZ fallback zone found: %s", nearest.get("zone", "Unknown"))
    return {
        "available": True,
        "zone": nearest.get("zone", ""),
        "summary": nearest.get("summary", ""),
        "issued_at": nearest.get("issued_at", ""),
        "latitude": nearest.get("latitude", lat),
        "longitude": nearest.get("longitude", lon),
        "source": "prototype_fallback",
        "is_live": False,
    }
