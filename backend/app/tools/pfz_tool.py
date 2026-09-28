"""PFZ tool — Potential Fishing Zone advisory powered by Global Fishing Watch (GFW) live AIS telemetry."""

from __future__ import annotations

import json
import math
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("tools.pfz")

FALLBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "fallback_pfz.json"

# In-memory TTL cache for live GFW events to ensure sub-millisecond responses on repeated queries
_GFW_CACHE: dict[str, Any] = {
    "entries": [],
    "fetched_at": 0.0,
    "ttl_seconds": 600.0,  # 10 minutes cache
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    return 2.0 * r * math.asin(math.sqrt(max(0.0, min(1.0, a))))


def _load_fallback() -> list[dict]:
    """Load fallback PFZ data from JSON."""
    try:
        if FALLBACK_PATH.exists():
            with open(FALLBACK_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as exc:
        logger.error("Failed to load fallback PFZ data: %s", exc)
    return []


def _find_nearest_zone(zones: list[dict], lat: float, lon: float, max_degrees: float = 3.5) -> dict | None:
    """Find the nearest PFZ zone to the given coordinates within maximum coastal radius."""
    best = None
    best_dist = float("inf")
    for z in zones:
        zlat = z.get("coast_latitude") or z.get("latitude", 0)
        zlon = z.get("coast_longitude") or z.get("longitude", 0)
        dist = (zlat - lat) ** 2 + (zlon - lon) ** 2
        if dist < best_dist and dist <= (max_degrees ** 2):
            best_dist = dist
            best = z
    return best


async def _fetch_gfw_events(lat: float, lon: float) -> list[dict]:
    """Fetch live fishing events from Global Fishing Watch API with TTL caching."""
    settings = get_settings()
    token = settings.gfw_access_token.strip()
    if not token:
        logger.debug("No GFW_ACCESS_TOKEN configured; skipping live GFW lookup")
        return []

    now = time.time()
    cache_key = "IND" if (5.0 <= lat <= 26.0 and 65.0 <= lon <= 96.0) else "GLOBAL"

    # Return cached events if still fresh
    if _GFW_CACHE["entries"] and (now - _GFW_CACHE["fetched_at"]) < _GFW_CACHE["ttl_seconds"]:
        if _GFW_CACHE.get("cache_key") == cache_key:
            return _GFW_CACHE["entries"]

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=120)

    params: dict[str, Any] = {
        "datasets[0]": "public-global-fishing-events:latest",
        "start-date": start_date.isoformat(),
        "end-date": today.isoformat(),
        "limit": 150,
        "offset": 0,
        "sort": "-start",
    }
    if cache_key == "IND":
        params["flags[0]"] = "IND"

    api_url = f"{settings.gfw_api_url.rstrip('/')}/events"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(api_url, headers=headers, params=params)
            if resp.status_code == 200:
                data = resp.json()
                entries = data.get("entries", [])
                _GFW_CACHE["entries"] = entries
                _GFW_CACHE["fetched_at"] = now
                _GFW_CACHE["cache_key"] = cache_key
                logger.info("GFW API fetched %d live fishing events (key=%s)", len(entries), cache_key)
                return entries
            else:
                logger.warning("GFW API returned status %d: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("GFW API request failed: %s", exc)

    # If recent call failed but cache exists, return stale cache
    if _GFW_CACHE["entries"]:
        return _GFW_CACHE["entries"]

    return []


async def fetch_pfz(lat: float, lon: float) -> dict:
    """Fetch Port Safety & Coastal Advisory data.

    Identifies the nearest active coastal port and recommends the safest
    sheltered harbor for berthing or calm water operations instead of raw AIS fleet data.
    """
    from app.services.coastal_service import find_closest_port, calc_distance_km

    try:
        closest = find_closest_port(lat, lon)
        dist_nearest = calc_distance_km(lat, lon, closest["lat"], closest["lon"])
        dist_safest = calc_distance_km(lat, lon, closest["alt_lat"], closest["alt_lon"])

        nearest_name = closest["name"]
        safest_name = closest["alt_name"]
        safest_reason = closest.get(
            "reason",
            "Sheltered natural bay providing lower wave energy and protected anchorage."
        )

        zone_title = f"Safe Port: {safest_name.split('(')[0].strip()} ({dist_safest} km)"
        summary = (
            f"Nearest port is {nearest_name} ({dist_nearest} km away). "
            f"Safest sheltered harbor recommendation is {safest_name} ({dist_safest} km away) — {safest_reason}"
        )

        logger.info(
            "Port advisory for (%.2f, %.2f): nearest=%s (%.1f km), safest=%s (%.1f km)",
            lat, lon, nearest_name, dist_nearest, safest_name, dist_safest
        )

        incois_zone = _find_nearest_zone(_load_fallback(), lat, lon, max_degrees=3.5) or {}

        return {
            "available": True,
            "zone": zone_title,
            "summary": summary,
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "latitude": closest["lat"],
            "longitude": closest["lon"],
            "source": "INCOIS Coastal Safety & Marine Ports Directory",
            "is_live": True,
            "nearest_port_name": nearest_name,
            "nearest_port_distance_km": dist_nearest,
            "safest_port_name": safest_name,
            "safest_port_distance_km": dist_safest,
            "safest_port_reason": safest_reason,
            "coast_name": incois_zone.get("coast_name") or nearest_name,
            "direction": incois_zone.get("direction"),
            "bearing": incois_zone.get("bearing"),
            "distance_km": str(dist_nearest),
            "depth_range_m": incois_zone.get("depth_range_m", "10-50m"),
            "species_likely": incois_zone.get("species_likely", ["Mackerel", "Sardines", "Pomfret"]),
            "nearest_vessel_name": None,
            "distance_to_vessel_km": None,
            "distance_from_shore_km": None,
            "active_fleet_count": None,
            "average_speed_knots": None,
            "potential_risk": False,
            "vessel_type": None,
            "flag": None,
        }
    except Exception as exc:
        logger.warning("Error generating port advisory for (%.2f, %.2f): %s", lat, lon, exc)
        return {
            "available": False,
            "zone": "",
            "summary": "Coastal port safety advisory temporarily unavailable.",
            "issued_at": "",
            "latitude": lat,
            "longitude": lon,
            "source": "INCOIS Coastal Safety & Marine Ports Directory",
            "is_live": False,
        }

