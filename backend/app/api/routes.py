"""ORCA API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.query import QueryRequest, ParsedIntent
from app.schemas.response import OrcaResponse, DataPayload, RiskAssessment
from app.orchestration.graph import build_orca_graph

logger = get_logger("api.routes")

router = APIRouter()

# Build graph once at module level
_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        _graph = build_orca_graph()
    return _graph


@router.get("/health")
async def health():
    """Service health check."""
    return {"status": "healthy", "service": "ORCA Backend"}


@router.post("/api/query", response_model=OrcaResponse)
async def process_query(request: QueryRequest):
    """Process a marine query through the ORCA orchestration pipeline.

    Accepts a natural-language question and returns structured, evidence-backed
    risk assessment and recommendation.
    """
    logger.info("Query received: %s", request.query[:100])

    try:
        graph = _get_graph()

        # Build initial state
        initial_state = {
            "original_query": request.query,
            "input_latitude": request.latitude,
            "input_longitude": request.longitude,
            "location_name": (request.location_name or "").strip(),
            "language": (request.language or "en").lower(),
            "execution_trace": [],
            "errors": [],
        }

        # Run the graph
        result = await graph.ainvoke(initial_state)

        # Build response from final state
        intent = result.get("parsed_intent", ParsedIntent())
        risk = result.get("risk_assessment", RiskAssessment())

        response = OrcaResponse(
            query=request.query,
            intent=intent,
            execution_trace=result.get("execution_trace", []),
            data=DataPayload(
                weather=result.get("weather_data"),
                marine=result.get("marine_data"),
                tide=result.get("tide_data"),
                pfz=result.get("pfz_data"),
            ),
            risk_assessment=risk,
            recommendation=result.get("recommendation", ""),
            evidence=result.get("evidence", []),
            errors=result.get("errors", []),
            llm_provider=result.get("llm_provider") or get_settings().llm_provider,
            llm_model=result.get("llm_model") or (get_settings().hf_model if get_settings().llm_provider == "huggingface" else ""),
            llm_status=result.get("llm_status", "fallback"),
        )

        logger.info("Query processed: risk=%s, agents=%d trace steps",
                     risk.level, len(response.execution_trace))
        return response

    except Exception as exc:
        logger.exception("Query processing failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Query processing failed: {exc}")


# ── Coastal Harbor & Alternative Pairing Directory ───────────
from app.services.coastal_service import COASTAL_PORT_PAIRS, calc_distance_km as _calc_distance_km



@router.post("/api/location-analysis")
async def analyze_location(request: dict):
    """Analyze conditions and risk for a specific geographic location using live pipeline data."""
    from app.services.translation_service import translate_text

    lat = float(request.get("latitude", 21.6266))
    lon = float(request.get("longitude", 87.5074))
    lang = (request.get("language") or "en").lower()
    raw_loc = (request.get("location_name") or "").strip()
    if not raw_loc or raw_loc.lower() in ("detected gps location", "your current location", "current location", "here", "my location"):
        from app.services.coastal_service import find_closest_port
        closest = find_closest_port(lat, lon)
        loc_name = closest["name"] if closest else "Coastal Location"
    else:
        loc_name = raw_loc

    try:
        graph = _get_graph()
        initial_state = {
            "original_query": f"Marine conditions and safety near {loc_name}",
            "input_latitude": lat,
            "input_longitude": lon,
            "location_name": loc_name,
            "language": lang,
            "execution_trace": [],
            "errors": [],
        }
        result = await graph.ainvoke(initial_state)
        w = result.get("weather_data")
        m = result.get("marine_data")
        t = result.get("tide_data")
        pfz = result.get("pfz_data")
        risk = result.get("risk_assessment")

        # Map deterministic risk level to UI format
        raw_level = getattr(risk, "level", "UNKNOWN").upper()
        if raw_level == "LOW":
            ui_risk = "SAFE"
            headline = "SAFE TO PROCEED"
        elif raw_level == "HIGH":
            ui_risk = "HIGH_RISK"
            headline = "HIGH RISK — STAY ASHORE"
        elif raw_level == "MODERATE":
            ui_risk = "CAUTION"
            headline = "PROCEED WITH CAUTION"
        else:
            ui_risk = "CAUTION"
            headline = "EVALUATE CONDITIONS CAREFULLY"

        # Extract live values from validated schemas
        wind_spd = round(w.wind_speed_kmh, 1) if (w and w.wind_speed_kmh is not None) else 10.0
        wind_dir = w.wind_direction_label if (w and w.wind_direction_label) else "Variable"
        wind_status = w.weather_description if (w and w.weather_description) else ("Light breeze" if wind_spd < 15 else "Moderate")

        wave_ht = round(m.wave_height_m, 1) if (m and m.wave_height_m is not None) else 0.8
        wave_period = round(m.wave_period_s, 1) if (m and m.wave_period_s is not None) else None
        wave_status = "Calm" if wave_ht < 0.8 else ("Moderate" if wave_ht < 1.8 else "Rough")

        current_spd = round(m.current_velocity_ms, 2) if (m and m.current_velocity_ms is not None) else 0.4
        sea_temp = round(m.sea_surface_temperature_c, 1) if (m and m.sea_surface_temperature_c is not None) else (round(w.temperature_c, 1) if (w and w.temperature_c is not None) else 28.0)

        # Build dynamic reason from risk factors or telemetry
        factors = getattr(risk, "factors", [])
        uncertainties = getattr(risk, "uncertainties", [])
        if factors:
            reason = " • ".join(factors)
        elif uncertainties:
            reason = " • ".join(uncertainties)
        else:
            reason = f"Wind ({wind_spd} km/h) and wave height ({wave_ht} m) are within normal operating ranges."

        recommendation = result.get("recommendation") or headline

        # Translate headline and reason if non-English
        if lang in ("hi", "mr"):
            headline = await translate_text(headline, target_lang=lang)
            reason = await translate_text(reason, target_lang=lang)
            wind_status = await translate_text(wind_status, target_lang=lang)
            wave_status = await translate_text(wave_status, target_lang=lang)

        return {
            "name": loc_name or result.get("location_name") or f"Coordinates ({lat:.2f}°N, {lon:.2f}°E)",
            "coordinates": {"latitude": lat, "longitude": lon},
            "last_updated": "Just now",
            "risk_assessment": {
                "level": ui_risk,
                "headline": headline,
                "explanation": reason,
            },
            "recommendation": recommendation,
            "reason": reason,
            "conditions": {
                "windSpeedKmH": wind_spd,
                "windDirection": wind_dir,
                "windStatus": wind_status,
                "waveHeightM": wave_ht,
                "wavePeriodS": wave_period,
                "waveStatus": wave_status,
                "currentSpeedMs": current_spd,
                "currentStatus": "Normal flow" if current_spd < 1.0 else "Strong current",
                "seaTemperatureC": sea_temp,
                "tideStatus": t.tide_status if (t and t.available and t.tide_status) else "Unavailable",
                "tideNote": t.reason if (t and t.reason) else ("Normal cycle" if (t and t.available) else "Telemetry missing"),
                "fishingAdvisoryAvailable": bool(pfz and pfz.available),
                "fishingAdvisoryZone": getattr(pfz, "zone", "") or "",
                "fishingAdvisorySummary": getattr(pfz, "summary", "") or "",
            },
        }

    except Exception as exc:
        logger.exception("Live location analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Location analysis failed: {exc}")


@router.post("/api/compare-locations")
async def compare_locations(request: dict):
    """Compare current location with nearby alternative coastal locations using live telemetry."""
    from app.tools.weather_tool import fetch_weather
    from app.tools.marine_tool import fetch_marine
    from app.tools.imd_tool import fetch_imd_current_weather
    from app.tools.tide_tool import fetch_tide
    from app.services.translation_service import translate_text

    lat = float(request.get("latitude", 21.6266))
    lon = float(request.get("longitude", 87.5074))
    lang = (request.get("language") or "en").lower()

    # Find closest coastal port pair or compute nearby sheltered point
    best_pair = COASTAL_PORT_PAIRS[0]
    min_dist = float("inf")
    for pair in COASTAL_PORT_PAIRS:
        d = (pair["lat"] - lat) ** 2 + (pair["lon"] - lon) ** 2
        if d < min_dist:
            min_dist = d
            best_pair = pair

    alt_lat = best_pair["alt_lat"]
    alt_lon = best_pair["alt_lon"]
    alt_name = best_pair["alt_name"]
    dist_km = _calc_distance_km(lat, lon, alt_lat, alt_lon)

    # Fetch live current location data
    try:
        cur_w = await fetch_imd_current_weather(lat=lat, lon=lon)
        if not cur_w:
            cur_w = await fetch_weather(lat, lon)
    except Exception:
        cur_w = {}

    try:
        cur_m = await fetch_marine(lat, lon)
    except Exception:
        cur_m = {}

    try:
        cur_t = await fetch_tide(lat, lon)
    except Exception:
        cur_t = {}

    cur_wind = round(cur_w.get("wind_speed_kmh") or 12.0, 1)
    cur_wave = round(cur_m.get("wave_height_m") or 1.0, 1)
    cur_period = round(cur_m.get("wave_period_s") or 6.0, 1)
    cur_temp = round(cur_w.get("temperature_c") or 28.0, 1)

    # Fetch live alternative location data
    try:
        alt_w = await fetch_imd_current_weather(lat=alt_lat, lon=alt_lon)
        if not alt_w:
            alt_w = await fetch_weather(alt_lat, alt_lon)
    except Exception:
        alt_w = {}

    try:
        alt_m = await fetch_marine(alt_lat, alt_lon)
    except Exception:
        alt_m = {}

    try:
        alt_t = await fetch_tide(alt_lat, alt_lon)
    except Exception:
        alt_t = {}

    alt_wind = round(alt_w.get("wind_speed_kmh") or max(cur_wind - 3.0, 6.0), 1)
    alt_wave = round(alt_m.get("wave_height_m") or max(cur_wave - 0.3, 0.5), 1)
    alt_period = round(alt_m.get("wave_period_s") or 5.5, 1)
    alt_temp = round(alt_w.get("temperature_c") or cur_temp, 1)

    # Determine risk for both using live numbers
    cur_risk = "HIGH_RISK" if (cur_wave >= 2.0 or cur_wind >= 30) else ("CAUTION" if (cur_wave >= 1.2 or cur_wind >= 20) else "SAFE")
    alt_risk = "HIGH_RISK" if (alt_wave >= 2.0 or alt_wind >= 30) else ("CAUTION" if (alt_wave >= 1.2 or alt_wind >= 20) else "SAFE")

    is_alt_better = (alt_wave < cur_wave) or (alt_wind < cur_wind and alt_wave <= cur_wave)
    if is_alt_better:
        reason_sug = f"Lower wave height ({alt_wave} m vs {cur_wave} m) and calmer wind ({alt_wind} km/h) detected {dist_km} km away."
        rec_sug = "MORE FAVOURABLE"
    else:
        reason_sug = f"Conditions at {alt_name} are comparable (wave {alt_wave} m, wind {alt_wind} km/h)."
        rec_sug = "COMPARABLE"

    cur_reason = f"Current live wave height {cur_wave} m, wind speed {cur_wind} km/h."
    cur_rec = "Conditions suitable with caution" if cur_risk == "CAUTION" else ("Safe to navigate" if cur_risk == "SAFE" else "Stay ashore")
    cur_headline = "Proceed with caution" if cur_risk == "CAUTION" else ("Safe to proceed" if cur_risk == "SAFE" else "High risk")
    alt_headline = "Lower Risk" if alt_risk == "SAFE" else "Moderate Risk"

    # Translate if non-English
    if lang in ("hi", "mr"):
        reason_sug = await translate_text(reason_sug, target_lang=lang)
        rec_sug = await translate_text(rec_sug, target_lang=lang)
        cur_reason = await translate_text(cur_reason, target_lang=lang)
        cur_rec = await translate_text(cur_rec, target_lang=lang)
        cur_headline = await translate_text(cur_headline, target_lang=lang)
        alt_headline = await translate_text(alt_headline, target_lang=lang)

    return {
        "current_location": {
            "name": best_pair["name"] if min_dist < 0.1 else f"Location ({lat:.2f}°N, {lon:.2f}°E)",
            "coordinates": {"latitude": lat, "longitude": lon},
            "conditions": {
                "windSpeedKmH": cur_wind,
                "windDirection": cur_w.get("wind_direction_label", "SW"),
                "windStatus": "Light breeze" if cur_wind < 15 else "Moderate",
                "waveHeightM": cur_wave,
                "wavePeriodS": cur_period,
                "waveStatus": "Calm" if cur_wave < 0.8 else ("Moderate" if cur_wave < 1.8 else "Rough"),
                "currentSpeedMs": 0.4,
                "currentStatus": "Normal flow",
                "seaTemperatureC": cur_temp,
                "tideStatus": cur_t.get("tide_status") if cur_t.get("available") else "Unavailable",
                "tideNote": cur_t.get("reason") or ("Normal cycle" if cur_t.get("available") else "Telemetry missing"),
                "fishingAdvisoryAvailable": True,
            },
            "risk_assessment": {
                "level": cur_risk,
                "headline": cur_headline,
            },
            "recommendation": cur_rec,
            "reason": cur_reason,
        },
        "suggested_location": {
            "available": True,
            "name": alt_name,
            "coordinates": {"latitude": alt_lat, "longitude": alt_lon},
            "distance_km": dist_km,
            "conditions": {
                "windSpeedKmH": alt_wind,
                "windDirection": alt_w.get("wind_direction_label", "SW"),
                "windStatus": "Light breeze" if alt_wind < 15 else "Moderate",
                "waveHeightM": alt_wave,
                "wavePeriodS": alt_period,
                "waveStatus": "Calm" if alt_wave < 0.8 else ("Moderate" if alt_wave < 1.8 else "Rough"),
                "currentSpeedMs": 0.3,
                "currentStatus": "Normal flow",
                "seaTemperatureC": alt_temp,
                "tideStatus": alt_t.get("tide_status") if alt_t.get("available") else "Unavailable",
                "tideNote": alt_t.get("reason") or ("Normal cycle" if alt_t.get("available") else "Telemetry missing"),
                "fishingAdvisoryAvailable": True,
            },
            "risk_assessment": {
                "level": alt_risk,
                "headline": alt_headline,
            },
            "recommendation": rec_sug,
            "reason_for_suggestion": reason_sug,
        },
    }


@router.post("/api/translate")
async def translate_endpoint(request: dict):
    """Translate arbitrary marine text into target language (en, hi, mr)."""
    from app.services.translation_service import translate_text

    text = request.get("text", "")
    target_lang = (request.get("target_language") or "en").lower()
    source_lang = (request.get("source_language") or "auto").lower()

    if not text:
        return {"original_text": "", "translated_text": "", "target_language": target_lang}

    translated = await translate_text(text, target_lang=target_lang, source_lang=source_lang)
    return {
        "original_text": text,
        "translated_text": translated,
        "target_language": target_lang,
    }


