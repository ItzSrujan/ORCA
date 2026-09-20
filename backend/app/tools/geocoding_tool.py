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
