"""IMD (India Meteorological Department) Weather Tool.

Integrates with the official IMD Current Weather API:
- Endpoint: https://api.imd.gov.in/api/v1/current_wx?id=StationId
- Supports complete IMD wind direction codes (0 to 360)
- Supports complete IMD weather codes (01 to 99)
- Includes coastal station registry for geospatial station matching
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("tools.imd")

# ── IMD Wind Direction Code Mapping ──────────────────────────────
# Code -> (Full Description, Compass Label, Approximate Degrees)
IMD_WIND_DIRECTIONS: dict[int, tuple[str, str, float]] = {
    0: ("Calm", "CALM", 0.0),
    20: ("North-northeasterly", "NNE", 22.5),
    50: ("Northeasterly", "NE", 45.0),
    70: ("East-northeasterly", "ENE", 67.5),
    90: ("Easterly", "E", 90.0),
    110: ("East-southeasterly", "ESE", 112.5),
    140: ("Southeasterly", "SE", 135.0),
    160: ("South-southeasterly", "SSE", 157.5),
    180: ("Southerly", "S", 180.0),
    200: ("South-southwesterly", "SSW", 202.5),
    230: ("Southwesterly", "SW", 225.0),
    250: ("West-southwesterly", "WSW", 247.5),
    270: ("Westerly", "W", 270.0),
    290: ("West-northwesterly", "WNW", 292.5),
    320: ("Northwesterly", "NW", 315.0),
    340: ("North-northwesterly", "NNW", 337.5),
    360: ("Northerly", "N", 360.0),
}

# ── IMD Weather Code Mapping (01 - 99) ───────────────────────────
IMD_WEATHER_CODES: dict[int, str] = {
    1: "Clouds generally dissolving or becoming less developed",
    2: "State of sky on the whole unchanged",
    3: "Clouds generally forming or developing",
    4: "Visibility reduced by smoke",
    5: "Haze",
    6: "Widespread dust in suspension in the air",
    7: "Dust or sand raised by wind near station",
    8: "Well-developed dust/sand whirl(s)",
    9: "Duststorm or sandstorm within sight",
    10: "Mist",
    11: "Patches of shallow fog/ice fog at station",
    12: "More or less continuous shallow fog/ice fog at station",
    13: "Lightning visible, no thunder heard",
    14: "Precipitation within sight, not reaching surface",
    15: "Precipitation within sight, reaching surface (> 5 km distant)",
    16: "Precipitation within sight, near but not at station",
    17: "Thunderstorm, no precipitation at observation time",
    18: "Squalls at or within sight during preceding hour",
    19: "Funnel cloud(s) at or within sight",
    20: "Drizzle (not freezing) or snow grains not falling as showers",
    21: "Rain (not freezing) not falling as showers",
    22: "Snow not falling as showers",
    23: "Rain and snow / ice pellets, not falling as showers",
    24: "Freezing drizzle / freezing rain not falling as showers",
    25: "Showers of rain",
    26: "Showers of snow, or rain and snow",
    27: "Showers of hail, or rain and hail",
    28: "Fog or ice fog",
    29: "Thunderstorm (with or without precipitation)",
    30: "Slight/moderate duststorm/sandstorm - decreased",
    31: "Slight/moderate duststorm/sandstorm - no appreciable change",
    32: "Slight/moderate duststorm/sandstorm - begun/increased",
    33: "Severe duststorm/sandstorm - decreased",
    34: "Severe duststorm/sandstorm - no change",
    35: "Severe duststorm/sandstorm - increased",
    36: "Slight/moderate blowing snow (below eye level)",
    37: "Heavy drifting snow (below eye level)",
    38: "Slight/moderate blowing snow (above eye level)",
    39: "Heavy drifting snow (above eye level)",
    40: "Fog/ice fog at a distance",
    41: "Fog or ice fog in patches",
    42: "Fog/ice fog, sky visible, becoming thinner",
    43: "Fog/ice fog, sky invisible, becoming thinner",
    44: "Fog/ice fog, sky visible, no appreciable change",
    45: "Fog/ice fog, sky invisible, no appreciable change",
    46: "Fog/ice fog, sky visible, thicker",
    47: "Fog/ice fog, sky invisible, thicker",
    48: "Fog depositing rime, sky visible",
    49: "Fog depositing rime, sky invisible",
    50: "Drizzle, not freezing, intermittent slight",
    51: "Drizzle, not freezing, continuous slight",
    52: "Drizzle, not freezing, intermittent moderate",
    53: "Drizzle, not freezing, continuous moderate",
    54: "Drizzle, not freezing, intermittent heavy",
    55: "Drizzle, not freezing, continuous heavy",
    56: "Drizzle, freezing, slight",
    57: "Drizzle, freezing, moderate or heavy",
    58: "Drizzle and rain, slight",
    59: "Drizzle and rain, moderate or heavy",
    60: "Rain, not freezing, intermittent slight",
    61: "Rain, not freezing, continuous slight",
    62: "Rain, not freezing, intermittent moderate",
    63: "Rain, not freezing, continuous moderate",
    64: "Rain, not freezing, intermittent heavy",
    65: "Rain, not freezing, continuous heavy",
    66: "Rain, freezing, slight",
    67: "Rain, freezing, moderate or heavy",
    68: "Rain, or drizzle and snow, slight",
    69: "Rain, or drizzle and snow, moderate or heavy",
    70: "Intermittent fall of snowflakes, slight",
    71: "Continuous fall of snowflakes, slight",
    72: "Intermittent fall of snowflakes, moderate",
    73: "Continuous fall of snowflakes, moderate",
    74: "Intermittent fall of snowflakes, heavy",
    75: "Continuous fall of snowflakes, heavy",
    76: "Ice prisms (with or without fog)",
    77: "Snow grains (with or without fog)",
    78: "Isolated star-like snow crystals",
    79: "Ice pellets",
    80: "Rain shower(s), slight",
    81: "Rain shower(s), moderate or heavy",
    82: "Rain shower(s), violent",
    83: "Shower(s) of rain and snow mixed, slight",
    84: "Shower(s) of rain and snow mixed, moderate or heavy",
    85: "Snow shower(s), slight",
    86: "Snow shower(s), moderate or heavy",
    87: "Shower(s) of snow/ice pellets, slight",
    88: "Shower(s) of snow/ice pellets, moderate or heavy",
    89: "Shower(s) of hail, not associated with thunder, slight",
    90: "Shower(s) of hail, not associated with thunder, moderate/heavy",
    91: "Slight rain at observation; thunderstorm preceding",
    92: "Moderate/heavy rain at observation; thunderstorm preceding",
    93: "Slight snow/rain+snow mixed/hail; thunderstorm preceding",
    94: "Moderate/heavy snow/rain+snow/hail; thunderstorm preceding",
    95: "Thunderstorm, slight/moderate, without hail",
    96: "Thunderstorm, slight/moderate, with hail",
    97: "Thunderstorm, heavy, without hail",
    98: "Thunderstorm combined with duststorm/sandstorm",
    99: "Thunderstorm, heavy, with hail",
}

# ── Major Coastal IMD Stations Registry ──────────────────────────
COASTAL_IMD_STATIONS = [
    {"id": "42901", "name": "Digha", "state": "West Bengal", "lat": 21.6266, "lon": 87.5074},
    {"id": "42903", "name": "Sagar Island", "state": "West Bengal", "lat": 21.6500, "lon": 88.0500},
    {"id": "42809", "name": "Kolkata (Alipore)", "state": "West Bengal", "lat": 22.5273, "lon": 88.3262},
    {"id": "42976", "name": "Paradip Port", "state": "Odisha", "lat": 20.2612, "lon": 86.6668},
    {"id": "43053", "name": "Puri", "state": "Odisha", "lat": 19.8135, "lon": 85.8312},
    {"id": "43049", "name": "Gopalpur", "state": "Odisha", "lat": 19.2600, "lon": 84.9100},
    {"id": "43105", "name": "Kalingapatnam", "state": "Andhra Pradesh", "lat": 18.3300, "lon": 84.1200},
    {"id": "43149", "name": "Visakhapatnam", "state": "Andhra Pradesh", "lat": 17.6868, "lon": 83.2185},
    {"id": "43185", "name": "Machilipatnam", "state": "Andhra Pradesh", "lat": 16.1875, "lon": 81.1389},
    {"id": "43279", "name": "Chennai (Meenambakkam)", "state": "Tamil Nadu", "lat": 12.9941, "lon": 80.1809},
    {"id": "43278", "name": "Chennai (Nungambakkam)", "state": "Tamil Nadu", "lat": 13.0604, "lon": 80.2496},
    {"id": "43355", "name": "Kochi (Naval Base)", "state": "Kerala", "lat": 9.9615, "lon": 76.2711},
    {"id": "43110", "name": "Ratnagiri", "state": "Maharashtra", "lat": 16.9944, "lon": 73.3000},
    {"id": "43003", "name": "Mumbai (Colaba)", "state": "Maharashtra", "lat": 18.9067, "lon": 72.8147},
    {"id": "43057", "name": "Mumbai (Santacruz)", "state": "Maharashtra", "lat": 19.0896, "lon": 72.8656},
    {"id": "42909", "name": "Veraval", "state": "Gujarat", "lat": 20.9000, "lon": 70.3700},
]


def find_nearest_imd_station(lat: float, lon: float) -> dict:
    """Find the closest coastal IMD weather station to given coordinates."""
    best = COASTAL_IMD_STATIONS[0]
    min_dist = float("inf")

    for st in COASTAL_IMD_STATIONS:
        # Euclidean approximation is adequate for station selection
        d = math.hypot(st["lat"] - lat, st["lon"] - lon)
        if d < min_dist:
            min_dist = d
            best = st

    return best


def parse_imd_wind_direction(code_val: int | str | None) -> tuple[str, str, float | None]:
    """Parse IMD wind direction code into (Description, Label, Degrees)."""
    if code_val is None:
        return "Unknown", "", None

    try:
        code_int = int(code_val)
    except (ValueError, TypeError):
        return str(code_val), "", None

    if code_int in IMD_WIND_DIRECTIONS:
        return IMD_WIND_DIRECTIONS[code_int]

    # Find closest degree if exact code not matched
    closest_code = min(IMD_WIND_DIRECTIONS.keys(), key=lambda c: abs(c - code_int))
    return IMD_WIND_DIRECTIONS[closest_code]


def parse_imd_weather_code(code_val: int | str | None) -> tuple[int | None, str]:
    """Parse IMD weather code into (code, description)."""
    if code_val is None:
        return None, ""

    try:
        code_int = int(code_val)
        desc = IMD_WEATHER_CODES.get(code_int, f"Weather condition code {code_int}")
        return code_int, desc
    except (ValueError, TypeError):
        return None, str(code_val)


async def fetch_imd_current_weather(
    station_id: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
) -> dict | None:
    """Fetch live weather data from IMD Current Weather API.

    Handles authentication via X-API-KEY and Authorization headers.
    Returns normalized dictionary compatible with WeatherData schema.
    Returns None if API key is not configured or if API returns an error.
    """
    settings = get_settings()

    # Determine station
    target_station = None
    if station_id:
        target_station = next((s for s in COASTAL_IMD_STATIONS if s["id"] == station_id), None)
    elif lat is not None and lon is not None:
        target_station = find_nearest_imd_station(lat, lon)

    st_id = station_id or (target_station["id"] if target_station else "42901")
    url = f"{settings.imd_api_url}?id={st_id}"

    # Build auth headers
    headers: dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": "ORCA-Marine-Decision-Support/1.0",
    }
    if settings.imd_api_key:
        headers["X-API-KEY"] = settings.imd_api_key
    if settings.imd_auth_token:
        headers["Authorization"] = f"Bearer {settings.imd_auth_token}"

    # If no credentials configured, log and return None for graceful fallback
    if not settings.imd_api_key and not settings.imd_auth_token:
        logger.debug("IMD API key/token not configured; weather agent will fall back.")
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning("IMD API returned HTTP %d: %s", resp.status_code, resp.text[:200])
                return None

            raw_data = resp.json()

        # Handle list or single object responses
        if isinstance(raw_data, list) and len(raw_data) > 0:
            item = raw_data[0]
        elif isinstance(raw_data, dict):
            # Check for error payload
            if "error" in raw_data:
                logger.warning("IMD API error payload: %s", raw_data["error"])
                return None
            item = raw_data
        else:
            logger.warning("Unexpected IMD response format: %s", raw_data)
            return None

        # Parse fields based on IMD specification
        # Field names in IMD API can be "Station Id", "Station", "Temperature", etc.
        st_name = item.get("Station") or item.get("station") or (target_station["name"] if target_station else "IMD Station")
        st_id_val = str(item.get("Station Id") or item.get("station_id") or st_id)
        obs_date = item.get("Date of Observation") or item.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        obs_time = item.get("Time of Observation") or item.get("time") or "00:00"
        timestamp = f"{obs_date}T{obs_time}:00Z"

        # Wind
        wind_speed = float(item.get("Wind Speed") or item.get("wind_speed") or 0.0)
        wind_dir_code = item.get("Wind Direction") or item.get("wind_direction")
        wind_desc, wind_label, wind_deg = parse_imd_wind_direction(wind_dir_code)

        # Weather Code
        w_code_raw = item.get("Weather Code") or item.get("weather_code")
        w_code_int, w_desc = parse_imd_weather_code(w_code_raw)

        # Additional IMD metrics
        temp_c = float(item.get("Temperature") or item.get("temperature") or 0.0)
        mslp = float(item.get("M.S.L.P") or item.get("mslp") or 0.0) if (item.get("M.S.L.P") or item.get("mslp")) else None
        nebulosity = int(item.get("Nebulosity") or item.get("nebulosity") or 0) if (item.get("Nebulosity") or item.get("nebulosity")) is not None else None
        humidity = float(item.get("Humidity") or item.get("humidity") or 0.0) if (item.get("Humidity") or item.get("humidity")) is not None else None
        rainfall_24h = float(item.get("Last 24 hrs Rainfall") or item.get("rainfall") or 0.0) if (item.get("Last 24 hrs Rainfall") or item.get("rainfall")) is not None else None

        st_lat = target_station["lat"] if target_station else (lat or 21.6266)
        st_lon = target_station["lon"] if target_station else (lon or 87.5074)

        result = {
            "timestamp": timestamp,
            "latitude": st_lat,
            "longitude": st_lon,
            "wind_speed_kmh": wind_speed,
            "wind_direction_deg": wind_deg,
            "wind_direction_label": wind_label or _wind_degrees_to_label(wind_deg),
            "temperature_c": temp_c,
            "precipitation_mm": rainfall_24h,
            "visibility_km": None,
            "humidity_pct": humidity,
            "weather_code": w_code_int,
            "weather_description": w_desc,
            "station_id": st_id_val,
            "station_name": st_name,
            "mslp_hpa": mslp,
            "nebulosity": nebulosity,
            "rainfall_last_24h_mm": rainfall_24h,
            "source": f"IMD ({st_name})",
            "is_live": True,
        }

        logger.info("IMD weather fetched: Station=%s (%s), Wind=%.1f km/h (%s), Temp=%.1f°C",
                    st_name, st_id_val, wind_speed, wind_label, temp_c)
        return result

    except Exception as exc:
        logger.warning("Failed to fetch from IMD API: %s", exc)
        return None


def _wind_degrees_to_label(deg: float | None) -> str:
    if deg is None:
        return ""
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(deg / 22.5) % 16
    return dirs[idx]
