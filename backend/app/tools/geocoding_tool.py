"""Geocoding tool — resolves place names to coordinates via Nominatim."""

from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.schemas.marine import GeoLocation

logger = get_logger("tools.geocoding")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "ORCA-MarineAdvisory/1.0"


async def geocode(place_name: str) -> GeoLocation:
    """Resolve a place name to latitude/longitude using Nominatim.

    Returns a GeoLocation with resolved=False if the lookup fails.
    """
    if not place_name or not place_name.strip():
        return GeoLocation(resolved=False)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={
                    "q": place_name.strip(),
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "in",
                },
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            results = resp.json()

        if not results:
            logger.warning("Geocoding returned no results for '%s'", place_name)
            return GeoLocation(name=place_name, resolved=False)

        hit = results[0]
        geo = GeoLocation(
            name=hit.get("display_name", place_name),
            latitude=float(hit["lat"]),
            longitude=float(hit["lon"]),
            resolved=True,
        )
        logger.info("Geocoded '%s' -> (%.4f, %.4f)", place_name, geo.latitude, geo.longitude)
        return geo

    except Exception as exc:
        logger.error("Geocoding failed for '%s': %s", place_name, exc)
        return GeoLocation(name=place_name, resolved=False)


async def reverse_geocode(lat: float, lon: float) -> str | None:
    """Reverse geocode coordinates to a human-readable city/district/state using Nominatim."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lon,
                    "format": "json",
                },
                headers={"User-Agent": USER_AGENT},
            )
            if resp.status_code == 200:
                data = resp.json()
                addr = data.get("address", {})
                city = (
                    addr.get("city")
                    or addr.get("town")
                    or addr.get("village")
                    or addr.get("suburb")
                    or addr.get("state_district")
                    or addr.get("county")
                )
                state = addr.get("state")
                parts = [p for p in [city, state] if p]
                if parts:
                    return ", ".join(parts)
    except Exception as exc:
        logger.warning("Reverse geocoding failed for (%.4f, %.4f): %s", lat, lon, exc)
    return None

