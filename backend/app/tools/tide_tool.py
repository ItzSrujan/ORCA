"""Tide tool — provider abstraction and tidal hydrodynamic modeling."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("tools.tide")

OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"


def _parse_worldtides(data: dict, lat: float, lon: float, source_url: str) -> dict:
    import time

    now_ts = time.time()
    now_utc = datetime.now(timezone.utc)

    heights = data.get("heights", [])
    extremes = data.get("extremes", [])
    station = data.get("station", "")

    # 1. Current level: closest sample to now
    closest_h = min(heights, key=lambda h: abs(h.get("dt", 0) - now_ts), default=None)
    cur_level = closest_h.get("height") if closest_h else None

    # 2. Upcoming extremes
    upcoming_extremes = [e for e in extremes if e.get("dt", 0) >= (now_ts - 300)]
    next_extreme = upcoming_extremes[0] if upcoming_extremes else None

    next_high = next((e for e in upcoming_extremes if e.get("type", "").lower() == "high"), None)
    next_low = next((e for e in upcoming_extremes if e.get("type", "").lower() == "low"), None)

    # 3. Status
    if next_extreme:
        ext_type = next_extreme.get("type", "").capitalize()
        # If the extreme is happening right now (within 15 mins)
        if abs(next_extreme.get("dt", 0) - now_ts) < 900:
            tide_status = f"{ext_type} Tide"
        elif ext_type == "High":
            tide_status = "Rising"
        else:
            tide_status = "Falling"
    else:
        tide_status = "Normal"

    def _fmt_extreme(e: dict | None) -> str:
        if not e:
            return ""
        d_str = e.get("date", "")
        h = e.get("height", 0.0)
        try:
            t_part = d_str.split("T")[1][:5]
            return f"{t_part} UTC ({h:+.2f}m)"
        except Exception:
            return f"{h:+.2f}m"

    next_high_str = _fmt_extreme(next_high)
    next_low_str = _fmt_extreme(next_low)

    # Detailed note
    notes = []
    if next_high and tide_status == "Rising":
        diff_h = max(0, (next_high["dt"] - now_ts) / 3600)
        hrs = int(diff_h)
        mins = int((diff_h % 1) * 60)
        notes.append(f"High tide in {hrs}h {mins}m ({next_high.get('height', 0):+.2f}m)")
    elif next_low and tide_status == "Falling":
        diff_h = max(0, (next_low["dt"] - now_ts) / 3600)
        hrs = int(diff_h)
        mins = int((diff_h % 1) * 60)
        notes.append(f"Low tide in {hrs}h {mins}m ({next_low.get('height', 0):+.2f}m)")
    elif next_high:
        notes.append(f"Next high: {next_high_str}")
    elif cur_level is not None:
        notes.append(f"Level: {cur_level:+.2f}m")

    if station:
        notes.append(f"Station: {station}")

    reason_str = " • ".join(notes) if notes else "WorldTides live tidal forecast"

    return {
        "timestamp": now_utc.isoformat(),
        "latitude": lat,
        "longitude": lon,
        "tide_status": tide_status,
        "current_level_m": round(cur_level, 3) if cur_level is not None else None,
        "next_high": next_high_str,
        "next_low": next_low_str,
        "available": True,
        "reason": reason_str,
        "source": "WorldTides (FES2022)" if "worldtides" in source_url.lower() else source_url,
        "is_live": True,
    }


async def fetch_tide(lat: float, lon: float) -> dict:
    """Fetch tide data from configured provider or Open-Meteo tidal MSL model.

    Returns structured tide data with current level, status (Rising/Falling),
    next high tide, next low tide, and live provenance.
    """
    settings = get_settings()

    # If external dedicated tide API is configured, attempt retrieval
    if settings.tide_api_key and settings.tide_api_url:
        try:
            is_worldtides = "worldtides.info" in settings.tide_api_url.lower()
            params: dict[str, Any] = {
                "lat": lat,
                "lon": lon,
                "key": settings.tide_api_key,
            }
            if is_worldtides:
                params["heights"] = ""
                params["extremes"] = ""
                params["days"] = 2

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    settings.tide_api_url,
                    params=params,
                    headers={"User-Agent": "ORCA-Marine/1.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if is_worldtides and ("heights" in data or "extremes" in data):
                        logger.info("WorldTides data received for (%.2f, %.2f)", lat, lon)
                        return _parse_worldtides(data, lat, lon, settings.tide_api_url)

                    return {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "latitude": lat,
                        "longitude": lon,
                        "tide_status": data.get("status", "Normal"),
                        "current_level_m": data.get("level"),
                        "next_high": data.get("next_high", ""),
                        "next_low": data.get("next_low", ""),
                        "available": True,
                        "reason": data.get("note", "Live provider feed"),
                        "source": settings.tide_api_url,
                        "is_live": True,
                    }
                else:
                    logger.warning(
                        "External tide API returned %s: %s",
                        resp.status_code,
                        resp.text[:200],
                    )
        except Exception as exc:
            logger.warning(
                "External tide API error: %s. Falling back to Open-Meteo MSL model.",
                exc,
            )

    # Use Open-Meteo Marine tidal hydrodynamic model (sea_level_height_msl)
    try:
        params: dict[str, Any] = {
            "latitude": lat,
            "longitude": lon,
            "current": "sea_level_height_msl",
            "hourly": "sea_level_height_msl",
            "forecast_days": 2,
            "timezone": "auto",
        }
        if settings.open_meteo_api_key:
            params["apikey"] = settings.open_meteo_api_key
            url = settings.open_meteo_customer_url
        else:
            url = settings.open_meteo_marine_url

        async with httpx.AsyncClient(timeout=12.0) as client:
            try:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
            except Exception:
                if url != OPEN_METEO_MARINE_URL:
                    params.pop("apikey", None)
                    resp = await client.get(OPEN_METEO_MARINE_URL, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                else:
                    raise

        current = data.get("current", {})
        cur_msl = current.get("sea_level_height_msl")
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        vals = hourly.get("sea_level_height_msl", [])

        if cur_msl is None or not vals:
            logger.info(
                "Coordinates (%.2f, %.2f) have no tidal observations (inland or non-tidal)",
                lat,
                lon,
            )
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latitude": lat,
                "longitude": lon,
                "tide_status": "Unavailable",
                "current_level_m": None,
                "next_high": "",
                "next_low": "",
                "available": False,
                "reason": "Non-tidal or inland coordinates",
                "source": "Open-Meteo Marine (MSL Model)",
                "is_live": False,
            }

        now_time = current.get("time", "")
        # Find index in hourly closest to current time
        idx = 0
        for i, t in enumerate(times):
            if t >= now_time[:13]:
                idx = i
                break

        # Calculate slope/derivative for rising vs falling
        if idx + 1 < len(vals) and vals[idx + 1] is not None and vals[idx] is not None:
            slope = vals[idx + 1] - vals[idx]
        elif idx > 0 and vals[idx - 1] is not None and vals[idx] is not None:
            slope = vals[idx] - vals[idx - 1]
        else:
            slope = 0.0

        if slope > 0.03:
            tide_status = "Rising"
        elif slope < -0.03:
            tide_status = "Falling"
        else:
            tide_status = "High Tide" if cur_msl > 0 else "Low Tide"

        # Find future local peaks (Highs) and troughs (Lows)
        next_high_str = ""
        next_low_str = ""
        next_high_tuple = None
        next_low_tuple = None

        for k in range(max(1, idx), len(vals) - 1):
            if (
                vals[k] is not None
                and vals[k - 1] is not None
                and vals[k + 1] is not None
            ):
                if (
                    vals[k] >= vals[k - 1]
                    and vals[k] >= vals[k + 1]
                    and vals[k] > vals[k - 1]
                ):
                    if not next_high_tuple:
                        next_high_tuple = (times[k], vals[k])
                elif (
                    vals[k] <= vals[k - 1]
                    and vals[k] <= vals[k + 1]
                    and vals[k] < vals[k - 1]
                ):
                    if not next_low_tuple:
                        next_low_tuple = (times[k], vals[k])
                if next_high_tuple and next_low_tuple:
                    break

        if next_high_tuple:
            t_str = (
                next_high_tuple[0].split("T")[-1]
                if "T" in next_high_tuple[0]
                else next_high_tuple[0]
            )
            next_high_str = f"{t_str} ({next_high_tuple[1]:+.1f}m)"

        if next_low_tuple:
            t_str = (
                next_low_tuple[0].split("T")[-1]
                if "T" in next_low_tuple[0]
                else next_low_tuple[0]
            )
            next_low_str = f"{t_str} ({next_low_tuple[1]:+.1f}m)"

        if next_high_str and tide_status == "Rising":
            tide_note = f"High tide at {next_high_str}"
        elif next_low_str and tide_status == "Falling":
            tide_note = f"Low tide at {next_low_str}"
        elif next_high_str:
            tide_note = f"Next High: {next_high_str}"
        else:
            tide_note = f"Level: {cur_msl:+.2f}m MSL"

        logger.info(
            "Tide computed for (%.2f, %.2f): status=%s, level=%.2fm, high=%s, low=%s",
            lat,
            lon,
            tide_status,
            cur_msl,
            next_high_str,
            next_low_str,
        )

        return {
            "timestamp": current.get("time", datetime.now(timezone.utc).isoformat()),
            "latitude": lat,
            "longitude": lon,
            "tide_status": tide_status,
            "current_level_m": round(cur_msl, 2),
            "next_high": next_high_str,
            "next_low": next_low_str,
            "available": True,
            "reason": tide_note,
            "source": "Open-Meteo Marine (MSL Tide Model)",
            "is_live": True,
        }

    except Exception as exc:
        logger.error("Failed to fetch tide data: %s", exc)
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "tide_status": "Unavailable",
            "current_level_m": None,
            "next_high": "",
            "next_low": "",
            "available": False,
            "reason": f"Tide service unreachable: {exc}",
            "source": "Open-Meteo Marine",
            "is_live": False,
        }
