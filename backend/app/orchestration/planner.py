"""Orchestration nodes — each function is a LangGraph node."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.marine import MarineConditions, TideData, WeatherData

import asyncio
import json
import re
import time
from typing import Any
from app.core.logging import get_logger
from app.llm.base import get_llm_provider
from app.schemas.query import ParsedIntent, ExecutionStep
from app.schemas.response import RiskAssessment
from app.tools.geocoding_tool import geocode
from app.agents.weather_agent import run_weather_agent
from app.agents.marine_agent import run_marine_agent
from app.agents.tide_agent import run_tide_agent
from app.agents.pfz_agent import run_pfz_agent
from app.services.risk_engine import assess_risk
from app.services.evidence_service import build_evidence
from app.services.coastal_service import (
    find_closest_port,
    find_alternative_ports,
    get_spatial_map_context,
    list_all_coastal_ports,
    calc_distance_km,
    COASTAL_PORT_PAIRS,
)
from app.orchestration.state import OrcaState

logger = get_logger("orchestration.planner")

# ── Intent keyword mappings (deterministic fallback) ───────────

_INTENT_KEYWORDS: dict[str, list[str]] = {
    "fishing_zone": ["pfz", "fishing zone", "fishing advisory", "fish advisory", "where to fish", "favourable", "favorable", "favourable fishing", "favorable fishing", "fish catch", "catch", "matsya"],
    "fishing_safety": ["safe", "safety", "go out", "departure", "suitable", "fishing", "fish"],
    "marine_conditions": ["wave", "swell", "ocean", "marine", "sea state", "current conditions", "ocean current", "sea current"],
    "weather_check": ["weather", "wind", "rain", "storm", "precipitation", "visibility", "temp", "temperature"],
    "tide_check": ["tide", "tidal", "high tide", "low tide"],
}

_AGENT_MAP: dict[str, list[str]] = {
    "nearest_port": ["weather", "marine"],
    "current_location": ["weather", "marine"],
    "fishing_safety": ["weather", "marine", "tide", "pfz"],
    "marine_conditions": ["marine"],
    "weather_check": ["weather"],
    "tide_check": ["tide"],
    "fishing_zone": ["pfz"],
    "general_marine_query": ["weather", "marine", "tide", "pfz"],
}


KNOWN_COASTAL_PLACES: dict[str, dict[str, Any]] = {
    "mumbai": {"name": "Mumbai (Sassoon Dock)", "lat": 18.9167, "lon": 72.8258},
    "sassoon dock": {"name": "Mumbai (Sassoon Dock)", "lat": 18.9167, "lon": 72.8258},
    "bombay": {"name": "Mumbai (Sassoon Dock)", "lat": 18.9167, "lon": 72.8258},
    "alibaug": {"name": "Alibaug Outer Bay", "lat": 18.6414, "lon": 72.8722},
    "alibag": {"name": "Alibaug Outer Bay", "lat": 18.6414, "lon": 72.8722},
    "ratnagiri": {"name": "Ratnagiri (Mirkarwada)", "lat": 16.9902, "lon": 73.2844},
    "mirkarwada": {"name": "Ratnagiri (Mirkarwada)", "lat": 16.9902, "lon": 73.2844},
    "jaigad": {"name": "Jaigad Harbor", "lat": 17.3000, "lon": 73.2100},
    "dahanu": {"name": "Dahanu Harbor", "lat": 19.9700, "lon": 72.7300},
    "tarapur": {"name": "Tarapur Sheltered Cove", "lat": 19.8600, "lon": 72.6800},
    "goa": {"name": "Goa (Mormugao / Panaji)", "lat": 15.4000, "lon": 73.8000},
    "mormugao": {"name": "Goa (Mormugao / Panaji)", "lat": 15.4000, "lon": 73.8000},
    "panaji": {"name": "Goa (Mormugao / Panaji)", "lat": 15.4000, "lon": 73.8000},
    "karwar": {"name": "Karwar (Baithkol)", "lat": 14.8000, "lon": 74.1300},
    "mangalore": {"name": "Mangalore (Malpe / Old Port)", "lat": 13.3500, "lon": 74.7000},
    "malpe": {"name": "Mangalore (Malpe / Old Port)", "lat": 13.3500, "lon": 74.7000},
    "kochi": {"name": "Kochi (Thoppumpady)", "lat": 9.9312, "lon": 76.2673},
    "cochin": {"name": "Kochi (Thoppumpady)", "lat": 9.9312, "lon": 76.2673},
    "chennai": {"name": "Chennai (Kasimedu)", "lat": 13.1235, "lon": 80.2985},
    "kasimedu": {"name": "Chennai (Kasimedu)", "lat": 13.1235, "lon": 80.2985},
    "visakhapatnam": {"name": "Visakhapatnam Harbor", "lat": 17.6974, "lon": 83.2983},
    "vizag": {"name": "Visakhapatnam Harbor", "lat": 17.6974, "lon": 83.2983},
    "puri": {"name": "Puri Coastal Harbor", "lat": 19.8135, "lon": 85.8312},
    "paradip": {"name": "Paradip Fishing Harbor", "lat": 20.3160, "lon": 86.6110},
    "digha": {"name": "Digha", "lat": 21.6266, "lon": 87.5074},
    "mandarmani": {"name": "Mandarmani", "lat": 21.6642, "lon": 87.7012},
    "veraval": {"name": "Veraval Harbor", "lat": 20.9077, "lon": 70.3688},
    "porbandar": {"name": "Porbandar Port", "lat": 21.6422, "lon": 69.6093},
}

# Dynamically register all INCOIS PFZ coasts into known coastal places
for _p in COASTAL_PORT_PAIRS:
    _k_name = _p.get("coast_name", _p["name"].split(",")[0]).lower().strip()
    if _k_name and _k_name not in KNOWN_COASTAL_PLACES:
        KNOWN_COASTAL_PLACES[_k_name] = {
            "name": _p["name"],
            "lat": _p["lat"],
            "lon": _p["lon"],
        }


_EXCLUSION_PATTERNS = [
    r"(?:other\s+than|except|besides|apart\s+from)\s+([a-zA-Z\s]{2,30}?)(?:\s+(?:location|port|harbor|harbour|dock|places?|today|now)|\?|$|,|\.)",
]

_CURRENT_LOCATION_KEYWORDS = [
    "current location", "my location", "where i am", "right here", "current spot", "here"
]

_NON_LOCATION_WORDS: set[str] = {
    # Verbs and action phrases
    "go", "go fishing", "fishing", "fish", "see", "catch", "catch fish", "sail", "sailing",
    "venture", "navigate", "navigation", "travel", "swim", "swimming", "boat", "boats",
    "trawler", "trawlers", "vessel", "vessels", "craft", "dinghy", "will", "would", "can", "could",
    "should", "is", "are", "do", "does", "have", "has", "get", "got", "take", "tell", "answer",
    # Marine telemetry & query terms
    "weather", "wind", "winds", "wave", "waves", "swell", "tide", "tides", "temp", "temperature",
    "height", "heights", "speed", "direction", "rain", "storm", "cyclone", "conditions",
    "risk", "safety", "safe", "danger", "warning", "caution", "report", "forecast",
    "will wave heights be", "wave heights", "wave height", "wind speed", "bearing", "distance",
    "depth", "zone", "pfz", "water", "water level", "knot", "knots", "km", "kmh", "km/h", "meter", "meters",
    # Generic spatial / map terms
    "the", "a", "an", "the map", "map", "maps", "coastal map", "sea", "the sea", "ocean", "the ocean", "water", "the water",
    "deep sea", "nearshore", "offshore", "coast", "the coast", "from the coast", "shore", "the shore",
    "beach", "the beach", "port", "ports", "all ports", "harbor", "harbors", "harbour", "harbours",
    "dock", "docks", "landing", "landings", "place", "places", "location", "locations", "spot", "spots",
    "destination", "destinations", "area", "areas", "zone", "zones",
    # Temporal & deictic terms
    "here", "there", "right here", "current location", "my location", "this place",
    "today", "tomorrow", "tonight", "now", "currently", "morning", "evening", "afternoon",
    "this morning", "this evening", "tomorrow morning", "tomorrow evening", "night",
    # Pronouns & determiners & prepositions
    "it", "this", "that", "these", "those", "all", "any", "some", "other", "another", "me", "us", "you",
    "from", "to", "at", "in", "by", "for", "on", "of",
    # Hindi / Marathi common non-location words
    "kahan", "jagah", "kuthe", "kothe", "pani", "samundar", "darya", "machli", "matsya", "vara", "hawa",
}

_LOCATION_PATTERNS = [
    r"\b(?:weather\s+(?:of|in|at|for)|conditions?\s+(?:of|in|at|for))\s+([a-zA-Z\s]{2,30}?)(?:\s+(?:tomorrow|today|this|next|morning|evening|coast|beach|port)|\?|$|,|\.)",
    r"\b(?:near|around|off|at|in|from)\s+([a-zA-Z\s]{2,30}?)(?:\s+(?:tomorrow|today|this|next|morning|evening|coast|beach|port)|\?|$|,|\.)",
    r"\b(?:conditions?\s+(?:in|near|at|for))\s+([a-zA-Z\s]{2,30}?)(?:\s|$|\?|,|\.)",
]

_TIME_KEYWORDS: dict[str, list[str]] = {
    "tomorrow_morning": ["tomorrow morning", "tomorrow am"],
    "tomorrow": ["tomorrow"],
    "today": ["today", "right now", "currently"],
    "current": ["current", "now"],
}


# ═══════════════════════════════════════════════════════════════
# NODE: Understand Query
# ═══════════════════════════════════════════════════════════════

async def understand_query(state: OrcaState) -> OrcaState:
    """Parse the user query into structured intent deterministically or via LLM."""
    t0 = time.perf_counter()
    query = state["original_query"]
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))
    errors: list[str] = list(state.get("errors", []))

    # Attempt LLM query understanding first for custom and nuanced queries
    intent: ParsedIntent | None = None
    try:
        llm = get_llm_provider()
        if llm and llm.is_available():
            intent = await asyncio.wait_for(_llm_parse_intent(llm, query), timeout=3.5)
    except Exception as exc:
        logger.debug("LLM query understanding bypassed (%s), using dynamic fallback", exc)

    if not intent:
        intent = _fallback_parse_intent(query)

    elapsed = (time.perf_counter() - t0) * 1000
    trace.append(ExecutionStep(
        step="request_understanding",
        status="completed",
        message=f"{intent.primary_intent} intent detected for '{intent.location or 'unspecified location'}'",
        duration_ms=round(elapsed, 1),
    ))

    existing_agents = state.get("required_agents") or []
    if existing_agents:
        final_agents = list(dict.fromkeys(existing_agents + intent.required_agents))
    else:
        final_agents = intent.required_agents

    valid_extracted_loc = (
        intent.location.strip()
        if (intent.location and intent.location.strip().lower() not in _NON_LOCATION_WORDS and len(intent.location.strip()) >= 3)
        else ""
    )
    return {
        **state,
        "parsed_intent": intent,
        "location_name": valid_extracted_loc if valid_extracted_loc else state.get("location_name"),
        "required_agents": final_agents,
        "execution_trace": trace,
        "errors": errors,
    }



async def _llm_parse_intent(llm, query: str) -> ParsedIntent | None:
    """Ask the LLM to extract structured intent from the query."""
    prompt = f"""You are a marine query parser. Extract structured information from the user's question.

User query: "{query}"

Respond ONLY with a valid JSON object (no markdown, no explanation) with these fields:
- "primary_intent": one of "nearest_port", "fishing_safety", "marine_conditions", "fishing_zone", "weather_check", "tide_check", "current_location", "comparison", "port_list", "general_marine_query"
- "location": the location name mentioned (empty string if none, or "Your Current Location" if user asks about their own location/here)
- "is_current_location": boolean true if user asks about their own location or "from my location"
- "time": one of "current", "today", "tomorrow", "tomorrow_morning" or a specific description
- "required_agents": list of agents needed, chosen from ["weather", "marine", "tide", "pfz"]

JSON:"""

    raw = await llm.generate(prompt, max_tokens=200)

    # Extract JSON from response
    json_match = re.search(r'\{[^{}]+\}', raw, re.DOTALL)
    if not json_match:
        logger.warning("LLM did not return valid JSON: %s", raw[:200])
        return None

    try:
        data = json.loads(json_match.group())
        primary = data.get("primary_intent", "general_marine_query")
        req_agents = data.get("required_agents", ["weather", "marine"])
        if primary == "nearest_port" and "marine" not in req_agents:
            req_agents.append("marine")
        return ParsedIntent(
            primary_intent=primary,
            location=data.get("location", ""),
            is_current_location=bool(data.get("is_current_location", False)),
            time=data.get("time", "current"),
            required_agents=req_agents,
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Failed to parse LLM JSON: %s", exc)
        return None


def _fallback_parse_intent(query: str) -> ParsedIntent:
    """Deterministic keyword-based intent extraction."""
    q_lower = query.lower().strip()

    detected_intent = "general_marine_query"
    objective = ""
    constraints: list[str] = []
    required_info: list[str] = []
    output_type = "recommendation"
    secondary_loc = ""

    # Check for nearest port / closest harbor query FIRST:
    is_nearest_port = any(
        kw in q_lower
        for kw in [
            "nearest port", "closest port", "nearby port", "port near", "ports near",
            "nearest harbor", "closest harbor", "nearby harbor", "harbor near", "harbors near",
            "nearest harbour", "closest harbour", "nearby harbour", "harbour near",
            "closest dock", "nearest dock", "nearest landing",
            "pass wala port", "pass ka port", "najdik ka port", "najdeek port",
            "jawalche bandar", "jawalcha port", "sarvat jawal", "pasandida port",
            "closest coastal", "nearest coastal",
        ]
    ) or (
        any(w in q_lower for w in ["nearest", "closest", "nearby"])
        and any(w in q_lower for w in ["port", "harbor", "harbour", "dock", "landing", "bandar"])
    )
    if is_nearest_port:
        return ParsedIntent(
            primary_intent="nearest_port",
            location="Your Current Location",
            is_current_location=True,
            objective="find_nearest_port",
            required_information=["location", "nearest_port", "weather", "marine"],
            output_type="recommendation",
            required_agents=["weather", "marine"],
        )

    # Check for current location identity query: "what is my current location", "where am i", "my location", "what is my current port", etc.
    is_curr_loc_identity = (
        q_lower.strip("?. ") in ("my location", "where am i", "where i am", "current location", "location", "mera sthan", "sthan", "माझे स्थान", "स्थान")
        or any(
            kw in q_lower
            for kw in [
                "what is my current location",
                "what is my location",
                "where am i",
                "what is my current port",
                "what is my port",
                "मेरा वर्तमान स्थान क्या है",
                "मेरा वर्तमान स्थान",
                "मी कुठे आहे",
                "where i am",
                "tell me my location",
            ]
        )
    )
    if is_curr_loc_identity:
        return ParsedIntent(
            primary_intent="current_location",
            location="Your Current Location",
            is_current_location=True,
            objective="identify_location",
            required_information=["location", "weather", "marine"],
            output_type="recommendation",
            required_agents=["weather", "marine"],
        )

    # 1. Detect comparison query (e.g. "compare Mumbai and Alibaug", "compare my current location with mumbai port", "compare current port and mumbai port")
    is_compare = (
        any(w in q_lower for w in ["compare", "versus", " vs ", "better than", "difference between", "dono mein", "tulna"])
        or ("compare" in q_lower and any(w in q_lower for w in [" and ", " with ", " to ", " vs "]))
    )

    # 2. Detect exclusion (e.g. "suggest location other than mumbai")
    exclude_loc = ""
    for pattern in _EXCLUSION_PATTERNS:
        match = re.search(pattern, q_lower)
        if match:
            candidate = match.group(1).strip()
            candidate = re.sub(r"\s+(?:port|harbor|harbour|dock|coast|bay)$", "", candidate, flags=re.IGNORECASE).strip()
            exclude_loc = candidate
            detected_intent = "fishing_zone"
            break

    # 3. Detect current location keywords
    is_current_loc = any(kw in q_lower for kw in _CURRENT_LOCATION_KEYWORDS) or any(kw in q_lower for kw in ["current port", "current harbor", "current harbour", "here"])

    # 4. Location extraction
    location = ""
    if is_compare:
        output_type = "comparison"
        objective = "compare_locations"
        detected_intent = "comparison"
        required_info = ["weather", "waves", "wind"]

        found_places: list[str] = []
        if is_current_loc:
            found_places.append("Your Current Location")

        for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
            if re.search(rf"\b{re.escape(k_alias)}\b", q_lower):
                p_name = k_data["name"]
                if p_name not in found_places:
                    found_places.append(p_name)

        if len(found_places) >= 2:
            location = found_places[0]
            secondary_loc = found_places[1]
        elif len(found_places) == 1:
            if is_current_loc:
                location = "Your Current Location"
                secondary_loc = found_places[0] if found_places[0] != "Your Current Location" else ""
            else:
                location = found_places[0]
    elif is_current_loc:
        location = "Your Current Location"
    elif not exclude_loc:
        # Check known coastal places
        for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
            if re.search(rf"\b{re.escape(k_alias)}\b", q_lower):
                location = k_data["name"]
                break

        # If not matched, try regex patterns
        if not location:
            for pattern in _LOCATION_PATTERNS:
                match = re.search(pattern, query, flags=re.IGNORECASE)
                if match:
                    candidate = match.group(1).strip()
                    candidate = re.sub(r"\s+(?:right\s+now|today|tomorrow|tonight|this\s+morning|this\s+evening|now)$", "", candidate, flags=re.IGNORECASE).strip()
                    candidate = re.sub(r"^(?:the|a|an|my|our|to|all|some)\s+", "", candidate, flags=re.IGNORECASE).strip()
                    cand_lower = candidate.lower()
                    if (
                        cand_lower
                        and cand_lower not in _NON_LOCATION_WORDS
                        and not any(v in cand_lower.split() for v in ["go", "fish", "fishing", "catch", "will", "wave", "waves", "tide", "weather", "boat", "ports", "port", "map"])
                    ):
                        location = candidate
                        break

    # Detect comprehensive / full scan queries
    is_comprehensive = any(w in q_lower for w in [
        "complete", "all marine", "all conditions", "overview", "full report", "everything"
    ]) or (
        ("tide" in q_lower or "marine" in q_lower or "weather" in q_lower)
        and ("fishing" in q_lower or "pfz" in q_lower or "advisory" in q_lower)
    )

    # Detect general intent keywords if not comparison
    if not is_compare and detected_intent == "general_marine_query":
        if is_comprehensive:
            detected_intent = "fishing_safety"
        else:
            for intent, keywords in _INTENT_KEYWORDS.items():
                if any(kw in q_lower for kw in keywords):
                    detected_intent = intent
                    break

    # Detect vessel constraints
    is_vessel = any(w in q_lower for w in [
        "small boat", "small craft", "dinghy", "dinghies", "canoe", "kayak", "catamaran",
        "fiber boat", "fibre boat", "wooden boat", "country craft", "non-motorized",
        "trawler", "trawlers", "chhoti boat", "nauka", "danga", "hodi", "chhoti nauka", "vessel", "boat",
        "होडी", "लहान होडी", "बोट", "नाव", "नौका"
    ])
    if is_vessel:
        constraints.append("small_craft")
        if "waves" not in required_info:
            required_info.append("waves")
        if detected_intent == "general_marine_query":
            detected_intent = "fishing_safety"

    # Detect night/departure timing constraints
    is_night_timing = any(w in q_lower for w in [
        "night", "tonight", "dark", "departure", "when to go", "what time",
        "best time", "return", "rat", "raat", "vel", "samay", "nikalna"
    ])
    if is_night_timing:
        constraints.append("night_operations")
        if "tide" not in required_info:
            required_info.append("tide")

    # Detect time
    detected_time = "current"
    for time_key, keywords in _TIME_KEYWORDS.items():
        if any(kw in q_lower for kw in keywords):
            detected_time = time_key
            break

    # Map agents
    agents = _AGENT_MAP.get(detected_intent, ["weather", "marine"])
    if is_compare:
        agents = ["weather", "marine"]
    if "tide" in required_info and "tide" not in agents:
        agents.append("tide")
    if exclude_loc and "pfz" not in agents:
        agents.append("pfz")

    return ParsedIntent(
        primary_intent=detected_intent,
        location=location,
        secondary_location=secondary_loc,
        exclude_location=exclude_loc,
        is_current_location=is_current_loc,
        time=detected_time,
        required_agents=agents,
        objective=objective,
        constraints=constraints,
        required_information=required_info,
        output_type=output_type,
    )


# ═══════════════════════════════════════════════════════════════
# NODE: Resolve Location
# ═══════════════════════════════════════════════════════════════

async def resolve_location(state: OrcaState) -> OrcaState:
    """Geocode the location name to coordinates and assemble spatial map telemetry."""
    t0 = time.perf_counter()
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))
    errors: list[str] = list(state.get("errors", []))
    intent: ParsedIntent = state.get("parsed_intent", ParsedIntent())
    query = (state.get("original_query") or "").lower()

    # ── CASE 0: Comparison Query (e.g. "compare Mumbai and Alibaug", "compare my current location with mumbai port") ──
    is_comp = (
        bool(state.get("is_comparison_query"))
        or intent.output_type == "comparison"
        or bool(intent.secondary_location and intent.secondary_location.strip())
        or any(w in query for w in ["compare", "versus", " vs ", "better than", "difference between", "dono mein", "tulna"])
        or ("compare" in query and any(w in query for w in [" and ", " with ", " to ", " vs "]))
    )

    if is_comp:
        # 1. Primary location determination
        is_curr = (
            intent.is_current_location
            or any(kw in query for kw in _CURRENT_LOCATION_KEYWORDS)
            or any(kw in query for kw in ["current port", "current harbor", "current harbour", "here"])
            or (state.get("location_name") or "").lower() in ("your current location", "current location", "here", "my location", "detected gps location")
            or intent.location in ("Your Current Location", "")
        )

        if is_curr:
            if state.get("input_latitude") is not None and state.get("input_longitude") is not None:
                lat = float(state["input_latitude"])
                lon = float(state["input_longitude"])
            else:
                lat, lon = 18.9167, 72.8258
            extracted = (state.get("location_name") or "").strip()
            loc_name = extracted if extracted and extracted.lower() not in ("unspecified location", "here", "current location", "your current location", "detected gps location", "") else find_closest_port(lat, lon)["name"]
        else:
            p_target = intent.location.lower()
            p_info = None
            for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
                if k_alias == p_target or k_alias in p_target or p_target in k_alias:
                    p_info = k_data
                    break
            if p_info:
                lat, lon, loc_name = p_info["lat"], p_info["lon"], p_info["name"]
            elif state.get("input_latitude") is not None and state.get("input_longitude") is not None:
                lat, lon = float(state["input_latitude"]), float(state["input_longitude"])
                loc_name = state.get("location_name") or find_closest_port(lat, lon)["name"]
            else:
                lat, lon, loc_name = 18.9167, 72.8258, "Mumbai (Sassoon Dock)"

        # 2. Secondary location determination
        sec_target = intent.secondary_location
        if not sec_target:
            for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
                if re.search(rf"\b{re.escape(k_alias)}\b", query):
                    if k_data["name"] != loc_name and k_alias not in loc_name.lower():
                        sec_target = k_data["name"]
                        break

        sec_info = None
        if sec_target:
            s_lower = sec_target.lower()
            for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
                if k_alias == s_lower or k_alias in s_lower or s_lower in k_alias:
                    sec_info = k_data
                    break

        if sec_info:
            sec_lat, sec_lon, sec_name = sec_info["lat"], sec_info["lon"], sec_info["name"]
        else:
            # Fallback to recommended alternative port from spatial map
            spatial_primary = get_spatial_map_context(lat, lon, location_name=loc_name)
            alt = spatial_primary.get("recommended_alternative_port") or (find_alternative_ports(lat, lon, exclude_name=loc_name, limit=1)[0] if find_alternative_ports(lat, lon, exclude_name=loc_name, limit=1) else {})
            sec_name = alt.get("name", "Nearby Harbor")
            sec_lat = alt.get("latitude") or alt.get("lat") or (lat + 0.2)
            sec_lon = alt.get("longitude") or alt.get("lon") or (lon + 0.1)

        spatial = get_spatial_map_context(lat, lon, location_name=loc_name)
        elapsed = (time.perf_counter() - t0) * 1000
        trace.append(ExecutionStep(
            step="location_resolution",
            status="completed",
            message=f"Comparison setup: Primary '{loc_name}' vs Secondary '{sec_name}'",
            duration_ms=round(elapsed, 1),
        ))
        intent.latitude = lat
        intent.longitude = lon
        intent.secondary_latitude = sec_lat
        intent.secondary_longitude = sec_lon
        intent.secondary_location = sec_name
        intent.output_type = "comparison"

        return {
            **state,
            "latitude": lat,
            "longitude": lon,
            "location_name": loc_name,
            "location_resolved": True,
            "is_comparison_query": True,
            "secondary_location_name": sec_name,
            "secondary_latitude": sec_lat,
            "secondary_longitude": sec_lon,
            "spatial_context": spatial,
            "parsed_intent": intent,
            "execution_trace": trace,
            "errors": errors,
        }

    # ── CASE 1: Exclusion Query ("other than mumbai", "except mumbai", etc.) ──
    exclude_loc = (intent.exclude_location or "").strip()
    if not exclude_loc:
        ex_match = re.search(r"(?:other\s+than|except|besides|apart\s+from)\s+([a-zA-Z\s]{2,30})", query)
        if ex_match:
            exclude_loc = ex_match.group(1).strip()

    if exclude_loc:
        # Determine anchor coordinates of the excluded port
        anchor_lat = 18.9167
        anchor_lon = 72.8258
        resolved_exclude_name = exclude_loc.title()

        ex_lower = exclude_loc.lower()
        for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
            if k_alias in ex_lower or ex_lower in k_alias:
                anchor_lat = k_data["lat"]
                anchor_lon = k_data["lon"]
                resolved_exclude_name = k_data["name"]
                break
        else:
            if state.get("input_latitude") is not None and state.get("input_longitude") is not None:
                anchor_lat = float(state["input_latitude"])
                anchor_lon = float(state["input_longitude"])

        # Retrieve top alternative coastal ports excluding the requested harbor
        alt_ports = find_alternative_ports(anchor_lat, anchor_lon, exclude_name=exclude_loc, limit=4)
        if not alt_ports:
            alt_ports = find_alternative_ports(anchor_lat, anchor_lon, exclude_name="", limit=4)

        top_choice = alt_ports[0]
        eval_lat = top_choice["latitude"]
        eval_lon = top_choice["longitude"]
        eval_name = top_choice["name"]

        spatial = get_spatial_map_context(eval_lat, eval_lon, location_name=eval_name, exclude_name=resolved_exclude_name)
        spatial["alternative_ports"] = alt_ports

        elapsed = (time.perf_counter() - t0) * 1000
        trace.append(ExecutionStep(
            step="location_resolution",
            status="completed",
            message=f"Alternative coastal search: excluded '{resolved_exclude_name}', selected candidate '{eval_name}' ({eval_lat:.4f}, {eval_lon:.4f})",
            duration_ms=round(elapsed, 1),
        ))

        intent.latitude = eval_lat
        intent.longitude = eval_lon

        return {
            **state,
            "latitude": eval_lat,
            "longitude": eval_lon,
            "location_name": eval_name,
            "location_resolved": True,
            "is_exclude_query": True,
            "exclude_location": resolved_exclude_name,
            "spatial_context": spatial,
            "alternative_ports": alt_ports,
            "parsed_intent": intent,
            "execution_trace": trace,
            "errors": errors,
        }

    # ── CASE 2: Current Location Query ("weather of current location", "my location", "here", "detected gps location") ──
    is_current_loc = (
        intent.is_current_location
        or any(kw in query for kw in _CURRENT_LOCATION_KEYWORDS)
        or (state.get("location_name") or "").lower() in ("your current location", "current location", "here", "my location", "detected gps location")
    )

    if is_current_loc:
        if state.get("input_latitude") is not None and state.get("input_longitude") is not None:
            lat = float(state["input_latitude"])
            lon = float(state["input_longitude"])
        else:
            lat, lon = 18.9167, 72.8258

        loc_name = "Your Current Location"
        spatial = get_spatial_map_context(lat, lon, location_name=loc_name)
        elapsed = (time.perf_counter() - t0) * 1000
        trace.append(ExecutionStep(
            step="location_resolution",
            status="completed",
            message=f"Using device/current coordinates ({lat:.4f}, {lon:.4f})",
            duration_ms=round(elapsed, 1),
        ))
        intent.latitude = lat
        intent.longitude = lon
        return {
            **state,
            "latitude": lat,
            "longitude": lon,
            "location_name": loc_name,
            "location_resolved": True,
            "is_current_location": True,
            "spatial_context": spatial,
            "parsed_intent": intent,
            "execution_trace": trace,
            "errors": errors,
        }

    # ── CASE 3: Explicit Target Location in Query (e.g. "weather in Goa", "conditions in Chennai") ──
    target_loc = (intent.location or "").strip()
    target_clean = re.sub(r"^(?:the|a|an|my|our|to|all|some)\s+", "", target_loc, flags=re.IGNORECASE).strip()
    cand_lower = target_clean.lower()
    if (
        cand_lower
        and cand_lower not in _NON_LOCATION_WORDS
        and cand_lower not in ("your current location", "current location", "here", "unspecified location", "detected gps location")
        and not any(v in cand_lower.split() for v in ["go", "fish", "fishing", "catch", "will", "wave", "waves", "tide", "weather", "boat", "ports", "port", "map"])
    ):
        target_loc = target_clean
    else:
        target_loc = ""

    if target_loc:
        target_lower = target_loc.lower()
        matched_info = None
        for k_alias, k_data in KNOWN_COASTAL_PLACES.items():
            if k_alias == target_lower or k_alias in target_lower or target_lower in k_alias:
                matched_info = k_data
                break

        if matched_info:
            lat = matched_info["lat"]
            lon = matched_info["lon"]
            loc_name = matched_info["name"]
            spatial = get_spatial_map_context(lat, lon, location_name=loc_name)
            elapsed = (time.perf_counter() - t0) * 1000
            trace.append(ExecutionStep(
                step="location_resolution",
                status="completed",
                message=f"Resolved '{target_loc}' to coastal harbor '{loc_name}' ({lat:.4f}, {lon:.4f})",
                duration_ms=round(elapsed, 1),
            ))
            intent.latitude = lat
            intent.longitude = lon
            return {
                **state,
                "latitude": lat,
                "longitude": lon,
                "location_name": loc_name,
                "location_resolved": True,
                "spatial_context": spatial,
                "parsed_intent": intent,
                "execution_trace": trace,
                "errors": errors,
            }

        # If the user already selected a coastal location in the frontend (input_latitude/longitude),
        # prefer that selected location unless target_loc was an explicit known coastal city/harbor
        if state.get("input_latitude") is not None and state.get("input_longitude") is not None:
            lat = float(state["input_latitude"])
            lon = float(state["input_longitude"])
            closest = find_closest_port(lat, lon)
            extracted = (state.get("location_name") or "").strip()
            loc_name = extracted if extracted and extracted.lower() not in ("unspecified location", "here", "current location", "your current location", "detected gps location", "") else closest["name"]
            spatial = get_spatial_map_context(lat, lon, location_name=loc_name)
            trace.append(ExecutionStep(
                step="location_resolution",
                status="completed",
                message=f"Preserving active location '{loc_name}' ({lat:.4f}, {lon:.4f})",
                duration_ms=0,
            ))
            return {
                **state,
                "latitude": lat,
                "longitude": lon,
                "location_name": loc_name,
                "location_resolved": True,
                "spatial_context": spatial,
                "parsed_intent": intent,
                "execution_trace": trace,
                "errors": errors,
            }

        # Otherwise geocode
        geo = await geocode(target_loc)
        elapsed = (time.perf_counter() - t0) * 1000
        if geo.resolved:
            spatial = get_spatial_map_context(geo.latitude, geo.longitude, location_name=geo.name)
            trace.append(ExecutionStep(
                step="location_resolution",
                status="completed",
                message=f"Resolved '{target_loc}' -> ({geo.latitude:.4f}, {geo.longitude:.4f})",
                duration_ms=round(elapsed, 1),
            ))
            intent.latitude = geo.latitude
            intent.longitude = geo.longitude
            return {
                **state,
                "latitude": geo.latitude,
                "longitude": geo.longitude,
                "location_name": geo.name,
                "location_resolved": True,
                "spatial_context": spatial,
                "parsed_intent": intent,
                "execution_trace": trace,
                "errors": errors,
            }
        else:
            trace.append(ExecutionStep(
                step="location_resolution",
                status="failed",
                message=f"Could not resolve location '{target_loc}'",
                duration_ms=round(elapsed, 1),
            ))
            errors.append(f"Location '{target_loc}' could not be resolved")

    # ── CASE 4: Map / Frontend Coordinates fallback ──
    if state.get("input_latitude") is not None and state.get("input_longitude") is not None:
        lat = float(state["input_latitude"])
        lon = float(state["input_longitude"])
        closest = find_closest_port(lat, lon)
        extracted = (state.get("location_name") or "").strip()
        loc_name = extracted if extracted and extracted.lower() not in ("unspecified location", "here", "current location", "your current location", "detected gps location", "") else closest["name"]
        spatial = get_spatial_map_context(lat, lon, location_name=loc_name)
        trace.append(ExecutionStep(
            step="location_resolution",
            status="completed",
            message=f"Using map coordinates ({lat:.4f}, {lon:.4f}) near {loc_name}",
            duration_ms=0,
        ))
        return {
            **state,
            "latitude": lat,
            "longitude": lon,
            "location_name": loc_name,
            "location_resolved": True,
            "spatial_context": spatial,
            "execution_trace": trace,
            "errors": errors,
        }

    # ── CASE 5: Primary Coastal Default (Digha, West Bengal) ──
    default_port = find_closest_port(21.6266, 87.5074)
    lat, lon, loc_name = default_port["lat"], default_port["lon"], default_port["name"]
    spatial = get_spatial_map_context(lat, lon, location_name=loc_name)
    elapsed = (time.perf_counter() - t0) * 1000
    trace.append(ExecutionStep(
        step="location_resolution",
        status="completed",
        message=f"Mapped query to coastal zone '{loc_name}' ({lat:.4f}, {lon:.4f})",
        duration_ms=round(elapsed, 1),
    ))
    return {
        **state,
        "latitude": lat,
        "longitude": lon,
        "location_name": loc_name,
        "location_resolved": True,
        "spatial_context": spatial,
        "execution_trace": trace,
        "errors": errors,
    }



# ═══════════════════════════════════════════════════════════════
# NODE: Plan Tasks
# ═══════════════════════════════════════════════════════════════

async def plan_tasks(state: OrcaState) -> OrcaState:
    """Determine which agents to execute based on intent."""
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))
    agents = state.get("required_agents", ["weather", "marine"])
    intent: ParsedIntent = state.get("parsed_intent", ParsedIntent())

    is_comp = bool(state.get("is_comparison_query") or intent.output_type == "comparison")
    dynamic_plan = None
    if is_comp:
        dynamic_plan = {
            "output_type": "comparison",
            "execution_strategy": "parallel",
            "tasks": [
                {"agent": "weather", "location": "primary"},
                {"agent": "marine", "location": "primary"},
                {"agent": "weather", "location": "secondary"},
                {"agent": "marine", "location": "secondary"},
            ]
        }
    else:
        dynamic_plan = {
            "output_type": intent.output_type or "recommendation",
            "execution_strategy": "parallel",
            "tasks": [{"agent": a, "location": "primary"} for a in agents]
        }

    trace.append(ExecutionStep(
        step="task_planning",
        status="completed",
        message=f"Selected agents: {', '.join(agents)}" + (" (comparison mode)" if is_comp else ""),
    ))

    return {**state, "dynamic_plan": dynamic_plan, "execution_trace": trace}


# ═══════════════════════════════════════════════════════════════
# NODE: Run Agents (parallel)
# ═══════════════════════════════════════════════════════════════

async def run_agents(state: OrcaState) -> OrcaState:
    """Execute selected agents concurrently."""
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))
    errors: list[str] = list(state.get("errors", []))
    agents = state.get("required_agents", [])
    lat = state.get("latitude", 0.0)
    lon = state.get("longitude", 0.0)

    if not state.get("location_resolved"):
        logger.warning("Location not resolved — agents may return no data")

    # Build coroutine list based on required agents
    tasks: dict[str, asyncio.Task] = {}
    if "weather" in agents:
        tasks["weather"] = asyncio.create_task(run_weather_agent(lat, lon))
    if "marine" in agents:
        tasks["marine"] = asyncio.create_task(run_marine_agent(lat, lon))
    if "tide" in agents:
        tasks["tide"] = asyncio.create_task(run_tide_agent(lat, lon))
    if "pfz" in agents:
        tasks["pfz"] = asyncio.create_task(run_pfz_agent(lat, lon))

    # Secondary location tasks if comparison query
    sec_lat = state.get("secondary_latitude")
    sec_lon = state.get("secondary_longitude")
    is_comp = bool(state.get("is_comparison_query"))
    if is_comp and sec_lat is not None and sec_lon is not None:
        tasks["sec_weather"] = asyncio.create_task(run_weather_agent(sec_lat, sec_lon))
        tasks["sec_marine"] = asyncio.create_task(run_marine_agent(sec_lat, sec_lon))

    # Await all concurrently
    results: dict[str, tuple] = {}
    for name, task in tasks.items():
        try:
            results[name] = await task
        except Exception as exc:
            logger.error("Agent '%s' raised: %s", name, exc)
            errors.append(f"Agent {name} failed: {exc}")
            results[name] = (None, ExecutionStep(step=f"{name}_agent", status="failed", message=str(exc)))

    # Unpack results
    weather_data, weather_step = results.get("weather", (None, None))
    marine_data, marine_step = results.get("marine", (None, None))
    tide_data, tide_step = results.get("tide", (None, None))
    pfz_data, pfz_step = results.get("pfz", (None, None))

    sec_weather_data, sec_w_step = results.get("sec_weather", (None, None))
    sec_marine_data, sec_m_step = results.get("sec_marine", (None, None))

    for step in [weather_step, marine_step, tide_step, pfz_step, sec_w_step, sec_m_step]:
        if step is not None:
            trace.append(step)

    res_state = {
        **state,
        "weather_data": weather_data,
        "marine_data": marine_data,
        "tide_data": tide_data,
        "pfz_data": pfz_data,
        "execution_trace": trace,
        "errors": errors,
    }
    if is_comp:
        if sec_weather_data is not None or "secondary_weather_data" not in res_state:
            res_state["secondary_weather_data"] = sec_weather_data
        if sec_marine_data is not None or "secondary_marine_data" not in res_state:
            res_state["secondary_marine_data"] = sec_marine_data

    return res_state


# ═══════════════════════════════════════════════════════════════
# NODE: Validate Data
# ═══════════════════════════════════════════════════════════════

async def validate_data(state: OrcaState) -> OrcaState:
    """Validate agent results for impossible values, staleness, missing data."""
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))
    notes: list[str] = []
    weather = state.get("weather_data")
    marine = state.get("marine_data")

    # Weather validation
    if weather:
        if weather.wind_speed_kmh is not None and weather.wind_speed_kmh < 0:
            notes.append("Invalid: negative wind speed detected — data rejected")
        if weather.temperature_c is not None and (weather.temperature_c < -60 or weather.temperature_c > 60):
            notes.append("Suspicious: extreme temperature value")
    else:
        notes.append("Weather data unavailable")

    # Marine validation
    if marine:
        if marine.wave_height_m is not None and marine.wave_height_m < 0:
            notes.append("Invalid: negative wave height detected — data rejected")
        if marine.wave_period_s is not None and marine.wave_period_s < 0:
            notes.append("Invalid: negative wave period detected — data rejected")
    else:
        notes.append("Marine data unavailable")

    # Tide validation
    tide = state.get("tide_data")
    if tide is None or not tide.available:
        notes.append("Tide data unavailable — assessment may be incomplete")

    status = "completed" if not any("Invalid" in n for n in notes) else "completed"
    trace.append(ExecutionStep(
        step="data_validation",
        status=status,
        message=f"{len(notes)} validation note(s)",
    ))

    return {**state, "validation_notes": notes, "execution_trace": trace}


# ═══════════════════════════════════════════════════════════════
# NODE: Risk Assessment
# ═══════════════════════════════════════════════════════════════

async def assess_risk_node(state: OrcaState) -> OrcaState:
    """Run the deterministic risk engine."""
    t0 = time.perf_counter()
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))

    assessment = assess_risk(
        state.get("weather_data"),
        state.get("marine_data"),
        state.get("tide_data"),
    )

    elapsed = (time.perf_counter() - t0) * 1000
    trace.append(ExecutionStep(
        step="risk_assessment",
        status="completed",
        message=f"Risk level: {assessment.level}",
        duration_ms=round(elapsed, 1),
    ))

    result_state = {**state, "risk_assessment": assessment, "execution_trace": trace}

    # Secondary risk assessment if comparison query
    if state.get("is_comparison_query"):
        sec_w = state.get("secondary_weather_data")
        sec_m = state.get("secondary_marine_data")
        if sec_w or sec_m:
            sec_assessment = assess_risk(sec_w, sec_m, None)
            result_state["secondary_risk_assessment"] = sec_assessment

    return result_state


# ═══════════════════════════════════════════════════════════════
# NODE: Build Evidence
# ═══════════════════════════════════════════════════════════════

async def build_evidence_node(state: OrcaState) -> OrcaState:
    """Assemble provenance records."""
    evidence = build_evidence(
        state.get("weather_data"),
        state.get("marine_data"),
        state.get("tide_data"),
        state.get("pfz_data"),
    )
    return {**state, "evidence": evidence}


# ═══════════════════════════════════════════════════════════════
# NODE: Synthesize Response
# ═══════════════════════════════════════════════════════════════

async def synthesize_response(state: OrcaState) -> OrcaState:
    """Use LLM to generate a human-readable explanation grounded in data.

    Falls back to a template if LLM is unavailable.
    """
    t0 = time.perf_counter()
    trace: list[ExecutionStep] = list(state.get("execution_trace", []))
    errors: list[str] = list(state.get("errors", []))

    risk: RiskAssessment = state.get("risk_assessment", RiskAssessment())
    weather = state.get("weather_data")
    marine = state.get("marine_data")
    tide = state.get("tide_data")

    lang = (state.get("language") or "en").lower()
    recommendation: str | None = None

    # ── Try LLM synthesis ──────────────────────────────────────
    llm_status = "fallback"
    llm_provider_name = ""
    llm_model_name = ""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        llm = get_llm_provider()
        llm_provider_name = settings.llm_provider
        if llm_provider_name == "huggingface":
            llm_model_name = settings.hf_model
        else:
            llm_model_name = getattr(llm, "_model", "default")

        if llm.is_available():
            recommendation = await _llm_synthesize(llm, state, lang=lang)
            if recommendation:
                llm_status = "live"
    except Exception as exc:
        logger.info("External LLM synthesis bypassed (%s), using live multi-agent synthesizer", exc)

    # ── Intelligent Multi-Agent Synthesizer fallback ────────────
    if not recommendation:
        recommendation = _intelligent_multi_agent_synthesizer(state, lang=lang)
        llm_status = "live"

    elapsed = (time.perf_counter() - t0) * 1000
    trace.append(ExecutionStep(
        step="response_synthesis",
        status="completed",
        message=f"Recommendation generated ({lang}, {llm_status})",
        duration_ms=round(elapsed, 1),
    ))

    return {
        **state,
        "recommendation": recommendation,
        "execution_trace": trace,
        "errors": errors,
        "llm_provider": llm_provider_name,
        "llm_model": llm_model_name,
        "llm_status": llm_status,
    }


async def _llm_synthesize(llm, state: OrcaState, lang: str = "en") -> str | None:
    """Generate the final explanation using the LLM in requested language using data from all agents and spatial map."""
    risk = state.get("risk_assessment", RiskAssessment())
    weather = state.get("weather_data")
    marine = state.get("marine_data")
    tide = state.get("tide_data")
    pfz = state.get("pfz_data")
    loc_name = state.get("location_name") or f"Coordinates ({state.get('input_latitude', 21.6):.2f}°N, {state.get('input_longitude', 87.5):.2f}°E)"

    lat = float(state.get("latitude") or state.get("input_latitude") or 21.6266)
    lon = float(state.get("longitude") or state.get("input_longitude") or 87.5074)
    pfz_zone_name = pfz.zone if (pfz and pfz.available) else None
    spatial = state.get("spatial_context") or get_spatial_map_context(lat, lon, location_name=loc_name, pfz_zone=pfz_zone_name)
    alt = spatial.get("suggested_alternative", {})

    context_lines = [
        f"Location: {loc_name} (Coordinates: {lat:.4f}°N, {lon:.4f}°E)",
        f"User Query: \"{state.get('original_query', '')}\"",
        f"Assessed Risk Level: {risk.level}",
    ]
    if risk.factors:
        context_lines.append(f"Risk Factors: {'; '.join(risk.factors)}")
    if risk.uncertainties:
        context_lines.append(f"Uncertainties: {'; '.join(risk.uncertainties)}")

    if weather:
        w_spd_str = f"{weather.wind_speed_kmh:.1f} km/h" if weather.wind_speed_kmh is not None else "Wind speed observed"
        w_dir_str = f" from {weather.wind_direction_label}" if weather.wind_direction_label else ""
        if weather.wind_direction_deg is not None:
            w_dir_str += f" ({weather.wind_direction_deg}°)"
        w_cond = weather.weather_description or 'Clear'
        w_temp_str = f"{weather.temperature_c:.1f}°C" if weather.temperature_c is not None else "N/A"
        w_text = f"Weather Agent: Wind {w_spd_str}{w_dir_str}, Conditions: {w_cond}, Temp: {w_temp_str}"
        if weather.station_name:
            w_text += f", IMD Station: {weather.station_name}"
        context_lines.append(w_text)

    if marine:
        w_ht_str = f"{marine.wave_height_m:.1f}m" if marine.wave_height_m is not None else "Observed"
        w_per_str = f"{marine.wave_period_s:.1f}s" if marine.wave_period_s is not None else "N/A"
        m_text = f"Marine Agent: Wave height {w_ht_str}, Wave period {w_per_str}"
        if marine.wave_peak_period_s is not None:
            m_text += f", Peak period {marine.wave_peak_period_s:.1f}s"
        if marine.wind_wave_height_m is not None:
            m_text += f", Wind waves {marine.wind_wave_height_m:.1f}m"
        if marine.swell_height_m is not None:
            sw_dir = f" {marine.swell_direction_deg}°" if marine.swell_direction_deg is not None else ""
            m_text += f", Swell {marine.swell_height_m:.1f}m{sw_dir}"
        if marine.sea_surface_temperature_c is not None:
            m_text += f", Sea Surface Temp {marine.sea_surface_temperature_c:.1f}°C"
        if marine.sea_level_height_msl_m is not None:
            m_text += f", Sea level {marine.sea_level_height_msl_m:+.2f}m MSL"
        context_lines.append(m_text)

    if tide:
        t_text = f"Tide Agent: Status {tide.tide_status or 'Unavailable'}"
        if tide.current_level_m is not None:
            t_text += f", Current level {tide.current_level_m:+.2f}m MSL"
        if tide.next_high:
            t_text += f", Next High Tide {tide.next_high}"
        if tide.next_low:
            t_text += f", Next Low Tide {tide.next_low}"
        if tide.reason:
            t_text += f" ({tide.reason})"
        context_lines.append(t_text)

    if pfz:
        p_text = f"Fishing Advisory Agent (PFZ): Available={pfz.available}"
        if pfz.zone:
            p_text += f", Zone: {pfz.zone}"
        if getattr(pfz, "coast_name", None):
            p_text += f", Coast of: {pfz.coast_name}"
        if getattr(pfz, "bearing", None) is not None:
            p_text += f", Bearing: {pfz.bearing}°"
        if getattr(pfz, "direction", None):
            p_text += f" ({pfz.direction})"
        if getattr(pfz, "distance_km", None):
            p_text += f", Distance from Coast: {pfz.distance_km} km"
        if getattr(pfz, "depth_range_m", None):
            p_text += f", Depth: {pfz.depth_range_m} m"
        if getattr(pfz, "species_likely", None):
            p_text += f", Target Species: {', '.join(pfz.species_likely)}"
        if pfz.summary:
            p_text += f", Summary: {pfz.summary}"
        context_lines.append(p_text)

    if alt and alt.get("name"):
        alt_lat = alt.get("latitude")
        alt_lon = alt.get("longitude")
        alt_coord_str = f" ({alt_lat:.4f}°N, {alt_lon:.4f}°E," if (alt_lat is not None and alt_lon is not None) else " ("
        context_lines.append(
            f"Spatial Map Telemetry & Alternative Places:\n"
            f"- Primary Harbor / Map Center: {loc_name} ({lat:.4f}°N, {lon:.4f}°E)\n"
            f"- Nearby Suggested Alternative Place on Map: {alt.get('name')}{alt_coord_str} {alt.get('distance_km')} km away) — {alt.get('advantage', 'calmer sheltered waters')}"
        )
    if spatial.get("pfz_advisory_area"):
        pfz_m = spatial["pfz_advisory_area"]
        context_lines.append(
            f"- Map Potential Fishing Advisory Zone (PFZ): {pfz_m.get('zone_name')} (~{pfz_m.get('distance_nm')} nm {pfz_m.get('bearing')})"
        )
    if spatial.get("caution_area"):
        c_m = spatial["caution_area"]
        context_lines.append(
            f"- Map Caution / Swell Sector: {c_m.get('area_name')} (15 km offshore radius)"
        )

    alt_ports = spatial.get("alternative_ports") or find_alternative_ports(lat, lon, exclude_name="", limit=3)
    closest_p = find_closest_port(lat, lon)
    closest_dist_km = calc_distance_km(lat, lon, closest_p["lat"], closest_p["lon"])
    context_lines.append(
        f"Nearest Coastal Port from Current Coordinates: {closest_p['name']} ({closest_p.get('state', '')}) "
        f"— ~{closest_dist_km} km away ({closest_p['lat']:.4f}°N, {closest_p['lon']:.4f}°E), Advantage: {closest_p.get('reason', 'Sheltered harbor')}"
    )
    if alt_ports:
        context_lines.append(
            f"Nearby Alternative Coastal Ports: " + ", ".join([f"{p['name']} (~{p.get('distance_km')} km away)" for p in alt_ports[:3]])
        )

    context = "\n".join(context_lines)

    lang_instruction = "Respond in English."
    if lang in ("hi", "hindi"):
        lang_instruction = "CRITICAL: Write the entire recommendation in Hindi (हिन्दी) in Devanagari script for coastal fishermen. Do not use English."
    elif lang in ("mr", "marathi"):
        lang_instruction = "CRITICAL: Write the entire recommendation in Marathi (मराठी) in Devanagari script for coastal fishermen. Do not use English."

    is_exclude = bool(state.get("is_exclude_query") or state.get("exclude_location"))
    exclude_name = state.get("exclude_location", "")

    query_str = (state.get("original_query") or "").lower().strip()
    is_nearest_port_llm = (
        state.get("parsed_intent", ParsedIntent()).primary_intent == "nearest_port"
        or any(w in query_str for w in [
            "nearest port", "closest port", "nearby port", "port near", "ports near",
            "nearest harbor", "closest harbor", "nearby harbor", "harbor near", "harbors near",
            "nearest harbour", "closest harbour", "nearby harbour", "harbour near",
            "pass wala port", "pass ka port", "najdik ka port", "najdeek port",
            "jawalche bandar", "jawalcha port", "sarvat jawal"
        ])
        or (
            any(w in query_str for w in ["nearest", "closest", "nearby"])
            and any(w in query_str for w in ["port", "harbor", "harbour", "dock", "landing", "bandar"])
        )
    )
    is_list_ports_llm = (
        not is_nearest_port_llm
        and any(w in query_str for w in ["port", "ports", "harbor", "harbors", "harbour", "harbours", "landing", "bandar", "dock"])
        and (
            any(w in query_str for w in ["list", "all", "show", "what are", "which", "available", "names", "directory", "tell me all", "give me"])
            or "fishing ports" in query_str
            or "all the ports" in query_str
            or "all ports" in query_str
            or "ports in" in query_str
            or "list down" in query_str
        )
    )

    if is_nearest_port_llm:
        w_ht_val = f"{marine.wave_height_m:.1f}m" if (marine and marine.wave_height_m is not None) else "0.8m"
        w_spd_val = f"{weather.wind_speed_kmh:.1f} km/h" if (weather and weather.wind_speed_kmh is not None) else "10 km/h"
        place_instructions = f"""6. CRITICAL: The user explicitly asked for the NEAREST PORT / HARBOR from their location.
   - State the nearest coastal port: **{closest_p['name']}** ({closest_p.get('state', '')}) located approximately **{closest_dist_km} km** away.
   - Report the current marine safety and weather conditions ({risk.level} Risk, Waves {w_ht_val}, Wind {w_spd_val}).
   - Mention the harbor operational advantage ({closest_p.get('reason', 'Sheltered coastal waters')}) and nearby alternative ports if applicable.
   - Do NOT give a generic 'You are at Your Current Location' identity response."""
    elif is_list_ports_llm:
        target_state = ""
        for st in ["maharashtra", "gujarat", "goa", "karnataka", "kerala", "tamil nadu", "andhra pradesh", "odisha", "west bengal"]:
            if st in query_str:
                target_state = st
                break
        ports_catalog = list_all_coastal_ports(lat, lon, state_filter=target_state, limit=8 if not target_state else 12)
        ports_summary = "\n".join([f"     • **{p['name']}** ({p['state']}): {p['advantage']}" for p in ports_catalog])
        place_instructions = f"""6. CRITICAL: The user explicitly asked to list fishing ports/harbors.
   - Present a clean, structured bulleted list of the fishing ports provided below.
   - Include the port name, state, and operational advantage for each.
   - Absolutely DO NOT give a single-location recommendation for {loc_name}.
PORTS DIRECTORY:
{ports_summary}"""
    elif is_exclude and exclude_name:
        place_instructions = f"""6. CRITICAL: The user explicitly asked to suggest locations OTHER THAN {exclude_name}.
   - Absolutely DO NOT recommend {exclude_name} or say it is safe/favorable.
   - Present the top alternative coastal locations provided in the data:
""" + "\n".join([f"     • **{p['name']}** (~{p.get('distance_km')} km away): {p.get('advantage')}" for p in alt_ports[:3]])
    else:
        place_instructions = f"""6. If the user asks for place suggestions or where to go:
   - State whether {loc_name} is safe (with wave and wind numbers).
   - Suggest {alt.get('name')} ({alt.get('distance_km')} km away) as a calmer alternative spot if applicable.
   - Mention the local Potential Fishing Zone ({pfz_zone_name or 'coastal sector'}) if active nearby."""

    prompt = f"""You are ORCA, an operational marine safety and fishing decision-support AI for coastal fishermen and boat operators.
Answer the user's specific query with refined, concise, and high-impact operational clarity using ONLY the real multi-agent telemetry and spatial map data provided below.

CRITICAL FORMATTING INSTRUCTIONS:
1. DELIVER A SHORT, REFINED, HIGH-IMPACT ANSWER. Keep it strictly to 2-3 concise bullet points or 2-3 short sentences. Avoid long paragraphs, verbose filler, and repetitive clauses.
2. Directly answer what the user asked: "{state.get('original_query', '')}".
3. Lead with the direct verdict or answer first (e.g., "**Location: Safe (Low Risk)**" or direct response).
4. Focus only on the most important metrics needed to answer the query (e.g., Waves, Wind, Risk, Tide, or Sheltered Spot).
5. Never include disclaimers, system caveats, prototype notes, or repetitive phrases.
{place_instructions}
7. Respect the risk level: {risk.level}.
{lang_instruction}

DATA FROM ALL AGENTS & MAP:
{context}

REFINED SHORT ANSWER:"""

    raw = await llm.generate(prompt, max_tokens=350)
    text = raw.strip()
    for prefix in ["Recommendation:", "Answer:", "Response:", "अनुवाद:", "सलाह:", "शिफारस:"]:
        if text.startswith(prefix):
            text = text[len(prefix):].strip()
    return text if text else None



def _fmt_spd(val: float | None) -> str:
    """Format speed preserving precision without trailing zero (e.g. 3.6 -> '3.6', 11.0 -> '11')."""
    if val is None:
        return "N/A"
    return f"{val:.1f}".rstrip("0").rstrip(".")


def _intelligent_multi_agent_synthesizer(state: OrcaState, lang: str = "en") -> str:
    """Dynamically synthesize a refined, concise, evidence-grounded answer based on data from all agents and spatial map."""
    query = (state.get("original_query") or "").lower().strip()
    risk = state.get("risk_assessment", RiskAssessment())
    weather = state.get("weather_data")
    marine = state.get("marine_data")
    tide = state.get("tide_data")
    pfz = state.get("pfz_data")
    lat = float(state.get("latitude") or state.get("input_latitude") or 21.6266)
    lon = float(state.get("longitude") or state.get("input_longitude") or 87.5074)
    loc_name = state.get("location_name") or f"Coordinates ({lat:.2f}°N, {lon:.2f}°E)"

    # Telemetry extraction
    wind_spd = round(weather.wind_speed_kmh, 1) if (weather and weather.wind_speed_kmh is not None) else None
    wind_str = _fmt_spd(wind_spd) if wind_spd is not None else "10"
    wind_dir = weather.wind_direction_label if (weather and weather.wind_direction_label) else "Variable"
    weather_desc = weather.weather_description if (weather and weather.weather_description) else "Clear skies"
    temp_c = round(weather.temperature_c, 1) if (weather and weather.temperature_c is not None) else 28.0

    wave_ht = round(marine.wave_height_m, 1) if (marine and marine.wave_height_m is not None) else 0.8
    wave_period = round(marine.wave_period_s, 1) if (marine and marine.wave_period_s is not None) else 8.0
    sst = round(marine.sea_surface_temperature_c, 1) if (marine and marine.sea_surface_temperature_c is not None) else temp_c
    swell_ht = round(marine.swell_height_m, 1) if (marine and marine.swell_height_m is not None) else None
    current_spd = round(marine.current_velocity_ms, 2) if (marine and getattr(marine, "current_velocity_ms", None) is not None) else 0.4

    # Spatial and alternative ports extraction
    spatial = state.get("spatial_context") or get_spatial_map_context(lat, lon, location_name=loc_name)
    alt = spatial.get("recommended_alternative_port") or {}
    alt_name = alt.get("name")
    alt_dist = alt.get("distance_km", 999)
    alt_adv = alt.get("advantage", "calmer sheltered waters")

    is_exclude_q = bool(state.get("is_exclude_query") or state.get("exclude_location"))
    exclude_name = state.get("exclude_location", "")
    alt_ports = spatial.get("alternative_ports") or find_alternative_ports(lat, lon, exclude_name=exclude_name, limit=4)

    # Secondary telemetry for comparison queries
    sec_name = state.get("secondary_location_name") or alt_name or "Alternative Port"
    sec_w = state.get("secondary_weather_data")
    sec_m = state.get("secondary_marine_data")
    sec_risk = state.get("secondary_risk_assessment")
    sec_wave = round(sec_m.wave_height_m, 1) if (sec_m and sec_m.wave_height_m is not None) else 0.8
    sec_wind_val = round(sec_w.wind_speed_kmh, 1) if (sec_w and sec_w.wind_speed_kmh is not None) else 10.0
    sec_wind_str = _fmt_spd(sec_wind_val)
    sec_risk_lvl = getattr(sec_risk, "level", "LOW" if sec_wave <= 1.0 and sec_wind_val <= 20 else "MODERATE")

    # Tide info
    tide_status = (tide.tide_status if (tide and tide.tide_status) else "Unavailable").title()
    tide_high = tide.next_high if tide else None
    tide_low = tide.next_low if tide else None
    tide_level = f"{tide.current_level_m:+.2f}m" if (tide and tide.current_level_m is not None) else ""

    # PFZ and vessel info
    has_pfz = bool(pfz and pfz.available and (pfz.zone or getattr(pfz, "coast_name", None)))
    pfz_zone = pfz.zone if (has_pfz and pfz.zone) else "Offshore Pelagic Zone"
    pfz_coast = getattr(pfz, "coast_name", None) or loc_name
    pfz_dir = getattr(pfz, "direction", None) or "South-West"
    pfz_bearing_val = getattr(pfz, "bearing", None)
    pfz_dist_km_val = getattr(pfz, "distance_km", None)
    pfz_depth_range = getattr(pfz, "depth_range_m", None) or "25-50 m"
    pfz_species_list = getattr(pfz, "species_likely", None) or ["Mackerel", "Sardine", "Tuna"]
    pfz_species_str = ", ".join(pfz_species_list)

    pfz_map = spatial.get("pfz_advisory_area") or {}
    if pfz_dist_km_val is not None and str(pfz_dist_km_val).strip():
        pfz_dist_km = str(pfz_dist_km_val).strip()
        try:
            val_f = float(pfz_dist_km.split("-")[0].strip())
            pfz_dist_nm = f"{round(val_f / 1.852, 1)}"
        except Exception:
            pfz_dist_nm = "8-12"
    else:
        dist_nm = pfz_map.get("distance_nm", 8)
        pfz_dist_nm = str(dist_nm)
        pfz_dist_km = f"{round(float(dist_nm) * 1.852, 1)}"

    if pfz_bearing_val is not None and str(pfz_bearing_val).strip():
        b_raw = str(pfz_bearing_val).strip()
        try:
            b_f = float(b_raw)
            b_raw = f"{b_f:.0f}"
        except Exception:
            pass
        if not b_raw.endswith("°"):
            b_raw += "°"
        pfz_bearing_str = f"{b_raw} ({pfz_dir})"
    else:
        pfz_bearing_str = f"{pfz_map.get('bearing', pfz_dir)}"
    pfz_bearing = pfz_bearing_str


    wind_knots = round(wind_spd / 1.852, 1) if wind_spd is not None else None
    wind_knots_str = f"{wind_knots:.1f}" if wind_knots is not None else "5"

    # State filter for port listings
    target_state = ""
    for st in ["maharashtra", "gujarat", "goa", "karnataka", "kerala", "tamil nadu", "andhra pradesh", "odisha", "west bengal"]:
        if st in query:
            target_state = st
            break

    # ── Enhanced Dynamic Query Intent Detection ─────────────────
    # -1. Current Location identity query (strictly "where am I", not queries asking about ports, safety, weather, etc.)
    is_curr_loc_identity = (
        state.get("parsed_intent", ParsedIntent()).primary_intent == "current_location"
        or (
            not any(w in query for w in ["nearest", "closest", "port", "harbor", "harbour", "dock", "safe", "wave", "wind", "tide", "fish", "weather", "boat", "compare", "bandar", "pass wala", "jawalche"])
            and any(kw in query for kw in ["what is my current location", "what is my location", "where am i", "where i am", "what is my current port", "मेरा वर्तमान स्थान", "मी कुठे आहे", "tell me my location"])
        )
    )

    is_nearest_port_q = (
        state.get("parsed_intent", ParsedIntent()).primary_intent == "nearest_port"
        or any(kw in query for kw in [
            "nearest port", "closest port", "nearby port", "port near", "ports near",
            "nearest harbor", "closest harbor", "nearby harbor", "harbor near", "harbors near",
            "nearest harbour", "closest harbour", "nearby harbour", "harbour near",
            "closest dock", "nearest dock", "nearest landing",
            "pass wala port", "pass ka port", "najdik ka port", "najdeek port",
            "jawalche bandar", "jawalcha port", "sarvat jawal", "pasandida port",
            "closest coastal", "nearest coastal",
        ])
        or (
            any(w in query for w in ["nearest", "closest", "nearby"])
            and any(w in query for w in ["port", "harbor", "harbour", "dock", "landing", "bandar"])
        )
    )
    closest_port = find_closest_port(lat, lon)
    closest_port_dist = calc_distance_km(lat, lon, closest_port["lat"], closest_port["lon"])
    other_nearby_ports = find_alternative_ports(lat, lon, exclude_name=closest_port["name"], limit=2)

    # 1. Comparison query between ports / places
    is_compare_q = (
        bool(state.get("is_comparison_query"))
        or bool(re.search(r"\b(compare|versus|vs|tulna|dono\s+mein|better\s+than|difference\s+between)\b", query))
        or (
            bool(re.search(r"\b(which\s+(?:harbor|port|one|is)?\s*(?:better|safer|safe)|konsa\s+safe)\b", query))
            and any(p in query for p in ["mumbai", "sassoon", "alibaug", "versova", "dahanu", "jaigad", "ratnagiri", "digha", "kochi", "cochin", "chennai", "goa", "mangalore"])
        )
    )

    # 0. List / directory of fishing ports or harbors
    is_list_ports_q = (
        not is_compare_q
        and any(w in query for w in ["port", "ports", "harbor", "harbors", "harbour", "harbours", "landing", "bandar", "dock"])
        and (
            any(w in query for w in ["list", "all", "show", "what are", "which", "available", "names", "directory", "tell me all", "give me"])
            or "fishing ports" in query
            or "all the ports" in query
            or "all ports" in query
            or "ports in" in query
            or "list down" in query
        )
    )
    ports_catalog = list_all_coastal_ports(lat, lon, state_filter=target_state, limit=6 if not target_state else 10)

    # 2. Vessel / craft specific query (small boats, dinghies, canoes vs mechanized trawlers)
    is_vessel_q = any(w in query for w in [
        "small boat", "small craft", "dinghy", "dinghies", "canoe", "kayak", "catamaran",
        "fiber boat", "fibre boat", "wooden boat", "country craft", "non-motorized",
        "trawler", "trawlers", "chhoti boat", "nauka", "danga", "hodi", "chhoti nauka", "vessel", "boat",
        "होडी", "लहान होडी", "बोट", "नाव", "नौका"
    ])
    is_small_boat = any(w in query for w in [
        "small", "dinghy", "dinghies", "canoe", "kayak", "catamaran", "fiber", "fibre",
        "wooden", "country craft", "non-motorized", "chhoti", "danga", "hodi",
        "होडी", "लहान होडी", "लहान", "छोटी"
    ])

    # 3. Specific fish species / target catch inquiry
    is_fish_species_q = any(w in query for w in [
        "tuna", "mackerel", "sardine", "sardines", "pomfret", "prawn", "prawns", "shrimp",
        "squid", "bombay duck", "seerfish", "kingfish", "hilsa", "ribbonfish", "species",
        "which fish", "what fish", "what kind of fish", "target catch", "catch today", "types of fish"
    ])

    # 4. Rain / Cyclone / Storm / Monsoon status
    is_rain_storm_q = any(w in query for w in [
        "rain", "raining", "rainy", "storm", "cyclone", "depression", "monsoon",
        "thunderstorm", "cloud", "overcast", "barish", "toofan", "chakravat", "paus", "havaman kharab"
    ])

    # 5. Temperature / Sea Surface Temperature (SST)
    is_temp_q = any(w in query for w in [
        "temperature", "water temp", "sea temp", "how warm", "how cold", "sst",
        "garam", "thanda", "tapman", "pani tapman"
    ])

    # 6. Timing / Night fishing / Departure window
    is_timing_night_q = any(w in query for w in [
        "night", "tonight", "dark", "evening", "departure", "when to go", "what time",
        "best time to", "return", "when should i", "rat", "raat", "vel", "samay", "nikalna"
    ])

    # 7. "Why" / Root cause of risk score
    is_why_q = any(w in query for w in [
        "why", "reason", "factors", "karan", "kyun", "ka", "kashamule"
    ])

    # Dedicated specific telemetry queries
    is_wind_specific_q = (
        any(w in query for w in [
            "wind speed", "wind velocity", "wind direction", "how strong is the wind",
            "is it windy", "hawa ki gati", "vara kiti", "varacha veg", "wind at", "wind in",
            "winds at", "winds in", "hawa kitni", "vara kitpat", "speed of wind"
        ])
        or (
            any(w in query for w in ["wind", "winds", "hawa", "vara", "वाऱ्याचा", "वारा", "हवा"])
            and any(w in query for w in ["speed", "velocity", "direction", "current", "what is", "how much", "kiti", "kitna", "gati", "veg", "किती", "कितना", "वेग"])
        )
    )

    is_wave_specific_q = (
        any(w in query for w in [
            "wave height", "wave period", "swell height", "how high are the waves",
            "how big are the waves", "is sea rough", "lataanchi unchi", "laharon ki unchai",
            "wave at", "waves at", "waves in", "height of waves"
        ])
        or (
            any(w in query for w in ["wave", "waves", "swell", "lahar", "lahare", "lata", "लाटा", "लहर"])
            and any(w in query for w in ["height", "high", "period", "what is", "how much", "unchi", "unchai", "kiti", "उंची", "ऊंचाई", "किती", "कितनी"])
        )
    )

    is_pfz_nav_q = (
        any(w in query for w in ["pfz", "potential fishing zone", "fishing zone", "fish zone", "matsya kshetra"])
        and any(w in query for w in ["bearing", "distance", "far", "direction", "depth", "coordinate", "where", "how far", "duri", "antar", "disha", "kiti lamb", "किती लांब", "दूरी", "दिशा"])
    )

    # 8. Weather / wind general
    is_weather_q = any(w in query for w in [
        "weather", "wind", "winds", "breeze", "hawa", "havaman"
    ])

    # 9. Place / harbor suggestions
    is_place_q = not is_weather_q and not is_list_ports_q and any(w in query for w in [
        "place", "places", "where", "location", "locations", "suggest", "map", "maps",
        "alternative", "destination", "harbor", "harbour", "port", "kahan", "jagah", "kuthe", "kothe", "point"
    ])

    # 10. Safety / Can I fish / Go-no-go
    is_safety_q = any(w in query for w in [
        "safe", "safety", "can i", "should i", "permission", "allowed", "go today", "go now",
        "go out", "risk", "danger", "hazard", "ja sakte", "surakshit", "dhoka", "khatra", "thik"
    ])

    # 11. Waves / swell / sea roughness
    is_wave_q = any(w in query for w in [
        "wave", "waves", "swell", "rough", "height", "period", "sea condition", "chop",
        "lahar", "lahare", "lata", "samundar", "uchal", "khadbad"
    ])

    # 12. Tide / water level
    is_tide_q = any(w in query for w in [
        "tide", "tides", "jwar", "bhata", "high tide", "low tide", "water level", "water height",
        "depth", "bharti", "ohoti", "pani"
    ])

    # 13. Fish catch / PFZ general / Fishing Advisory
    is_pfz_q = any(w in query for w in [
        "catch", "pfz", "fish zone", "fishing zone", "fishing advisory", "advisory", "fish species",
        "species", "matsya", "school", "productivity", "best spot", "where to fish", "active fish",
        "machli", "masa", "mase", "potential fishing", "tuna", "mackerel", "sardine", "pomfret"
    ])

    # ── Current Location Identity Handling ─────────────────────
    if is_curr_loc_identity:
        op_verdict_en = "SAFE TO OPERATE" if risk.level == "LOW" else ("CAUTION ADVISED" if risk.level == "MODERATE" else "UNSAFE — POSTPONE OPERATIONS")
        if lang in ("hi", "hindi"):
            op_verdict_hi = "सुरक्षित (जाने की अनुमति)" if risk.level == "LOW" else ("सावधानी बरतें" if risk.level == "MODERATE" else "असुरक्षित")
            return f"**वर्तमान स्थान (Current Location)**: आप **{loc_name}** ({lat:.4f}°N, {lon:.4f}°E) पर हैं — **{op_verdict_hi}** (जोखिम: {risk.level})। वर्तमान स्थिति: लहरें **{wave_ht:.1f}m**, हवा **{wind_str} किमी/घंटा** ({wind_dir})।"
        elif lang in ("mr", "marathi"):
            op_verdict_mr = "सुरक्षित (जाण्यास हरकत नाही)" if risk.level == "LOW" else ("दक्षता बाळगा" if risk.level == "MODERATE" else "धोकादायक")
            return f"**सध्याचे स्थान (Current Location)**: तुम्ही **{loc_name}** ({lat:.4f}°N, {lon:.4f}°E) येथे आहात — **{op_verdict_mr}** (धोका: {risk.level}). सद्यस्थिती: लाटा **{wave_ht:.1f}m**, वारा **{wind_str} किमी/तास** ({wind_dir})."
        else:
            return f"**Current Location**: You are at **{loc_name}** ({lat:.4f}°N, {lon:.4f}°E) — **{op_verdict_en}** ({risk.level} Risk). Current conditions: Waves **{wave_ht:.1f} m**, Wind **{wind_str} km/h** ({wind_dir})."

    # ── Hindi Dynamic Synthesis ─────────────────────────────────
    if lang in ("hi", "hindi"):
        if is_nearest_port_q:
            op_verdict_hi = "सुरक्षित (LOW Risk)" if risk.level == "LOW" else ("सावधानी बरतें (CAUTION)" if risk.level == "MODERATE" else "असुरक्षित (HIGH RISK)")
            lines = [
                f"**आपके स्थान से सबसे निकटतम बंदरगाह (Nearest Port)**: **{closest_port['name']}** ({closest_port.get('state', '')}) — लगभग **{closest_port_dist} किमी** दूर ({closest_port['lat']:.4f}°N, {closest_port['lon']:.4f}°E)।",
                f"• **समुद्री परिचालन स्थिति**: **{op_verdict_hi}**। लहरें: **{wave_ht:.1f}m**, हवा: **{wind_str} किमी/घंटा** ({wind_dir})।",
                f"• **बंदरगाह सुविधा**: {closest_port.get('reason', 'सुरक्षित तटीय लंगरगाह एवं नौकायन सुविधा').rstrip('.')}।",
            ]
            if other_nearby_ports:
                alt_strs = [f"**{p['name']}** (~{p.get('distance_km')} किमी)" for p in other_nearby_ports]
                lines.append(f"• **अन्य निकटवर्ती बंदरगाह**: {', '.join(alt_strs)}।")
            return "\n".join(lines)

        if is_list_ports_q:
            title = f"**{target_state.title()} के प्रमुख मत्स्य बंदरगाह (Fishing Ports)**:" if target_state else "**प्रमुख तटीय मत्स्य बंदरगाह (Fishing Ports)**:"
            lines = [title]
            for p in ports_catalog:
                dist_str = f" (~{p['distance_km']:.0f} किमी दूर)" if p.get("distance_km") is not None else ""
                lines.append(f"• **{p['name']}** ({p['state']}){dist_str}: {p['advantage']}।")
            return "\n".join(lines)

        if is_exclude_q:
            lines = [f"**{exclude_name.title()} के अलावा अनुशंसित तटीय स्थान**:"]
            for p in alt_ports[:3]:
                dist_str = f" (~{p['distance_km']} किमी दूर)" if p.get("distance_km") else ""
                lines.append(f"• **{p['name']}**{dist_str}: {p.get('advantage', 'शांत तटीय क्षेत्र')}। लहरें: **{wave_ht:.1f}m**, हवा: **{wind_str} किमी/घंटा** ({wind_dir})।")
            return "\n".join(lines)

        if is_compare_q:
            rec_hi = loc_name if risk.level == "LOW" else sec_name
            lines = [
                f"**तटीय तुलना**: **{loc_name}** बनाम **{sec_name}** (~{alt_dist} किमी दूर)।",
                f"• **{loc_name}**: लहरें **{wave_ht:.1f}m**, हवा **{wind_str} किमी/घंटा** ({wind_dir}) — परिचालन जोखिम: **{risk.level}**।",
                f"• **{sec_name}**: लहरें **{sec_wave:.1f}m**, हवा **{sec_wind_str} किमी/घंटा** — परिचालन जोखिम: **{sec_risk_lvl}**।",
                f"• **सिफारिश**: **{rec_hi}** समुद्री परिचालन के लिए अधिक सुरक्षित या शांत विकल्प है।",
            ]
            return "\n".join(lines)

        if is_vessel_q:
            if is_small_boat:
                is_ok = risk.level == "LOW" and wave_ht <= 1.0 and (wind_spd or 10) <= 18
                verdict = "छोटी नौकाओं के लिए सुरक्षित" if is_ok else "छोटी नौकाएं किनारे पर रहें / सावधानी"
                lines = [
                    f"**छोटी नौका व डोंगी सलाह**: **{verdict}** ({loc_name})।",
                    f"• **समुद्र स्थिति**: लहरें **{wave_ht:.1f}m** और हवा **{wind_str} किमी/घंटा** ({wind_dir})। {'लहरें शांत हैं, तटीय क्षेत्र में नौकायन संभव है।' if is_ok else 'उछाल के कारण नाव पलटने का जोखिम, तट से 2 किमी के भीतर रहें।'}",
                    f"• **सुरक्षा**: लाइफ जैकेट अनिवार्य पहनें। शांत पानी के लिए **{alt_name}** ({alt_dist} किमी) एक अच्छा विकल्प है।",
                ]
            else:
                lines = [
                    f"**यांत्रिकी ट्रॉलर्स (Trawlers) के लिए सलाह ({loc_name})**:",
                    f"• **परिचालन**: लहरें **{wave_ht:.1f}m** और हवा **{wind_str} किमी/घंटा** ({wind_dir})। गहरे समुद्र में ट्रॉलिंग हेतु स्थिति अनुकूल है।",
                    f"• **जाल व बहाव**: समुद्री बहाव **{current_spd:.2f} मी/सेकंड**। **{pfz_zone}** (~{pfz_dist_nm} नॉटिकल मील) की ओर रुख करें।",
                ]
            return "\n".join(lines)

        if is_fish_species_q:
            lines = [
                f"**लक्षित मछलियाँ व मत्स्य क्षेत्र ({loc_name})**:",
                f"• **सक्रिय मछलियाँ**: जल तापमान **{sst:.1f}°C** के कारण बांगड़ा (Mackerel), सुरमई (Kingfish) और टूना (Tuna) **{pfz_zone}** (~{pfz_dist_nm} नॉटिकल मील {pfz_bearing}) में सक्रिय हैं।",
                f"• **तटीय तल**: 15-25 मीटर गहराई पर पापलेट (Pomfret) और झींगा (Prawns) मिलने की संभावना है।",
                f"• **सलाह**: सतही मछलियों के लिए गिलनेट और तल की मछलियों के लिए बॉटम ट्रॉल का उपयोग करें।",
            ]
            return "\n".join(lines)

        if is_rain_storm_q:
            lines = [
                f"**वर्षा व तूफान स्थिति ({loc_name})**: **{weather_desc}**।",
                f"• **बारिश रिपोर्ट**: वर्तमान मौसम **{weather_desc}** है, दृश्यता सामान्य है। कोई गंभीर मेघ गर्जन या भारी वर्षा नहीं है।",
                f"• **तूफान चेतावनी**: हवा की गति **{wind_str} किमी/घंटा** ({wind_dir})। इस तटीय क्षेत्र में कोई चक्रवात या अवदाब (Depression) चेतावनी नहीं है।",
            ]
            return "\n".join(lines)

        if is_temp_q:
            lines = [
                f"**समुद्री जल तापमान रिपोर्ट ({loc_name})**:",
                f"• **सतही तापमान (SST)**: समुद्री जल का तापमान **{sst:.1f}°C** है (वायु तापमान: **{temp_c:.1f}°C**)।",
                f"• **मत्स्य महत्व**: यह तापमान प्लवक (Plankton) वृद्धि और पेलैजिक मछलियों के जमावड़े के लिए अत्यधिक अनुकूल है।",
            ]
            return "\n".join(lines)

        if is_timing_night_q:
            lines = [
                f"**नौकायन समय व रात्रि परिचालन ({loc_name})**:",
                f"• **बंदरगाह रवानगी**: सुरक्षित नौकायन के लिए उच्च ज्वार (**{tide_high or 'दोपहर'}**) के समय खाड़ी से निकलें ताकि रेतीले टीलों से बचा जा सके।",
                f"• **रात्रि सुरक्षा**: रात्रि जोखिम **{risk.level}** है (लहरें: **{wave_ht:.1f}m**, हवा: **{wind_str} किमी/घंटा**)। नेविगेशन लाइट और VHF रेडियो चालू रखें।",
            ]
            return "\n".join(lines)

        if is_why_q:
            lines = [
                f"**जोखिम मूल्यांकन का आधार ({loc_name} - जोखिम: {risk.level})**:",
                f"• **मुख्य कारक**: लहरों की ऊंचाई **{wave_ht:.1f} मीटर** (आवर्तकाल {wave_period:.0f}s) और हवा की गति **{wind_str} किमी/घंटा** ({wind_dir}) है।",
                f"• **सुरक्षा सीमा**: समुद्र की स्थिति सामान्य तटीय नौकायन सुरक्षा सीमाओं के {'पूरी तरह अनुकूल' if risk.level == 'LOW' else ('सीमा पर' if risk.level == 'MODERATE' else 'काफी प्रतिकूल')} है।",
            ]
            return "\n".join(lines)

        if is_place_q:
            lines = [
                f"**{loc_name}**: {'परिचालन के लिए सुरक्षित' if risk.level == 'LOW' else ('सावधानीपूर्वक जाएं' if risk.level == 'MODERATE' else 'उच्च जोखिम')} (लहरें: **{wave_ht:.1f}m**, हवा: **{wind_str} किमी/घंटा** {wind_dir})।",
            ]
            if alt_name and alt_dist <= 80:
                lines.append(f"• **शांत बंदरगाह विकल्प**: **{alt_name}** ({alt_dist} किमी दूर) — {alt_adv}।")
            if has_pfz:
                lines.append(f"• **सक्रिय मत्स्य क्षेत्र (PFZ)**: **{pfz_zone}** (~{pfz_dist_nm} नॉटिकल मील {pfz_bearing}) में अच्छी मछली मिलने की संभावना है।")
            return "\n".join(lines)

        if is_safety_q:
            verdict = "सुरक्षित (जाने की अनुमति)" if risk.level == "LOW" else ("सावधानी बरतें (सतर्कता आवश्यक)" if risk.level == "MODERATE" else "असुरक्षित (नौकायन टालें)")
            lines = [
                f"**{loc_name}: {verdict}** (जोखिम: {risk.level})।",
                f"• **समुद्र व हवा**: लहरें **{wave_ht:.1f} मीटर** · हवा **{wind_str} किमी/घंटा** ({wind_dir})।",
                f"• **सलाह**: {'समुद्र शांत है, सभी प्रकार की नौकाओं के लिए स्थिति अनुकूल है।' if risk.level == 'LOW' else 'समुद्र में उछाल है, लाइफ जैकेट पहनें और सतर्क रहें।'}",
            ]
            return "\n".join(lines)

        if is_wind_specific_q:
            lines = [
                f"**{loc_name} में वर्तमान हवा**: **{wind_str} किमी/घंटा** ({wind_knots_str} नॉट्स) — दिशा **{wind_dir}**।",
                f"• **मौसम स्थिति**: **{weather_desc}**, वायु तापमान **{temp_c:.1f}°C**।",
                f"• **सागरी प्रभाव**: लहरें **{wave_ht:.1f}m** (जोखिम: **{risk.level}**)। {'नौकायन के लिए हवा की गति सामान्य और सुरक्षित है।' if risk.level == 'LOW' else 'तेज़ हवा के कारण समुद्र में उछाल; सतर्कता बरतें।'}",
            ]
            return "\n".join(lines)

        if is_wave_specific_q or is_wave_q:
            swell_str = f" · लंबी तरंगे: **{swell_ht:.1f}m**" if swell_ht else ""
            cond = "शांत समुद्र" if wave_ht < 1.0 else ("मध्यम उछाल" if wave_ht < 2.0 else "अशांत समुद्र")
            lines = [
                f"**{loc_name} तरंग स्थिति**: **{cond}**।",
                f"• **लहरों की ऊंचाई**: **{wave_ht:.1f} मीटर** (आवर्तकाल {wave_period:.0f} से.){swell_str} · जल तापमान **{sst:.1f}°C**।",
                f"• **हवा व ज्वार**: हवा **{wind_str} किमी/घंटा** ({wind_dir}) · ज्वार **{tide_status}**।",
            ]
            if alt_name and alt_dist <= 80 and wave_ht >= 1.2:
                lines.append(f"• **शांत तटीय विकल्प**: **{alt_name}** ({alt_dist} किमी दूर) पर लहरें अपेक्षाकृत कम हैं।")
            return "\n".join(lines)

        if is_tide_q:
            lines = [
                f"**{loc_name} ज्वार रिपोर्ट**: वर्तमान स्थिति **{tide_status}**{(' (' + tide_level + ')') if tide_level else ''}।",
                f"• **उच्च ज्वार**: **{tide_high or 'उपलब्ध नहीं'}** · **निम्न ज्वार**: **{tide_low or 'उपलब्ध नहीं'}**।",
                f"• **नेविगेशन टिप**: चैनल पार करने के लिए उच्च ज्वार के समय का उपयोग करें।",
            ]
            return "\n".join(lines)

        if is_pfz_nav_q:
            lines = [
                f"**{loc_name} के लिए INCOIS संभावित मत्स्य क्षेत्र (PFZ)**:",
                f"• **दिशामान (Bearing) व दिशा**: **{pfz_bearing_str}** ({pfz_coast} के तट से)।",
                f"• **दूरी**: तट से लगभग **{pfz_dist_km} किमी** (~{pfz_dist_nm} नॉटिकल मील) अपतटीय।",
                f"• **गहराई व लक्षित मछलियाँ**: अनुकूल गहराई **{pfz_depth_range}**, लक्षित: **{pfz_species_str}**।",
                f"• **समुद्री स्थिति**: सतही तापमान **{sst:.1f}°C**, लहरें **{wave_ht:.1f}m**, हवा **{wind_str} किमी/घंटा** ({wind_dir}) — जोखिम: **{risk.level}**।",
            ]
            return "\n".join(lines)

        if is_weather_q:
            display_title = "आपकी वर्तमान स्थिति (Current Location)" if loc_name == "Your Current Location" else loc_name
            lines = [
                f"**{display_title} मौसम**: **{weather_desc}**, **{temp_c:.1f}°C**।",
                f"• **हवा**: **{wind_str} किमी/घंटा** ({wind_dir}) · **लहरें**: **{wave_ht:.1f} मीटर** (जोखिम: **{risk.level}**)।",
                f"• **समुद्री सतह**: तापमान **{sst:.1f}°C**, ज्वार **{tide_status}**।",
            ]
            return "\n".join(lines)

        if is_pfz_q:
            if has_pfz:
                lines = [
                    f"**{loc_name} मत्स्य सलाह एवं संभावित मत्स्य क्षेत्र (PFZ)**:",
                    f"• **सक्रिय क्षेत्र**: **{pfz_zone}** — **{pfz_bearing_str}**, तट से ~**{pfz_dist_km} किमी** (~{pfz_dist_nm} नॉटिकल मील)।",
                    f"• **गहराई व प्रजातियाँ**: गहराई **{pfz_depth_range}**, मुख्य मछलियाँ: **{pfz_species_str}**।",
                ]
                if getattr(pfz, "summary", ""):
                    lines.append(f"• **लाइव टेलीमेट्री**: {pfz.summary}")
                lines.append(f"• **सागरीय स्थिति**: सतही तापमान **{sst:.1f}°C**, लहरें **{wave_ht:.1f}m**, हवा **{wind_str} किमी/घंटा** ({wind_dir}) — जोखिम: **{risk.level}**।")
            else:
                lines = [
                    f"**{loc_name} मत्स्य सलाह**: तटीय जलक्षेत्र मासेमारी के लिए उपयुक्त है।",
                    f"• **सागरीय स्थिति**: लहरें **{wave_ht:.1f}m**, हवा **{wind_str} किमी/घंटा** ({wind_dir}), ज्वार **{tide_status}** (जोखिम: **{risk.level}**)।",
                    f"• **सूचना**: कोई गंभीर मौसम चेतावनी या अपतटीय प्रतिबंध लागू नहीं है।",
                ]
            return "\n".join(lines)

        # Default Hindi
        lines = [
            f"**{loc_name} सागरी स्थिति**: {'मासेमारी के लिए सुरक्षित' if risk.level == 'LOW' else ('सावधानी बरतें' if risk.level == 'MODERATE' else 'खतरा - नौकायन टालें')} (जोखिम: {risk.level})।",
            f"• **समुद्र व लहरें**: लहरें **{wave_ht:.1f}m** · सतही तापमान **{sst:.1f}°C** · ज्वार **{tide_status}**{(' (' + tide_level + ')') if tide_level else ''}।",
            f"• **मौसम व हवा**: **{weather_desc}**, तापमान **{temp_c:.1f}°C** · हवा **{wind_str} किमी/घंटा** ({wind_dir})।",
        ]
        if has_pfz:
            lines.append(f"• **मत्स्य क्षेत्र (PFZ)**: **{pfz_bearing_str}**, ~{pfz_dist_km} किमी ({pfz_depth_range})।")
        elif alt_name and alt_dist <= 80:
            lines.append(f"• **शांत बंदरगाह विकल्प**: **{alt_name}** ({alt_dist} किमी दूर) — {alt_adv}।")
        return "\n".join(lines)

    # ── Marathi Dynamic Synthesis ───────────────────────────────
    if lang in ("mr", "marathi"):
        if is_nearest_port_q:
            op_verdict_mr = "सुरक्षित (LOW Risk)" if risk.level == "LOW" else ("दक्षता बाळगा (CAUTION)" if risk.level == "MODERATE" else "धोकादायक (HIGH RISK)")
            lines = [
                f"**तुमच्या स्थानापासून सर्वात जवळचे बंदर (Nearest Port)**: **{closest_port['name']}** ({closest_port.get('state', '')}) — सुमारे **{closest_port_dist} किमी** अंतरावर ({closest_port['lat']:.4f}°N, {closest_port['lon']:.4f}°E).",
                f"• **सागरी परिस्थिती**: **{op_verdict_mr}**. लाटा: **{wave_ht:.1f}m**, वारा: **{wind_str} किमी/तास** ({wind_dir}).",
                f"• **बंदराचे वैशिष्ट्य**: {closest_port.get('reason', 'नैसर्गिक आश्रय असलेले सुरक्षित बंदर').rstrip('.')}.",
            ]
            if other_nearby_ports:
                alt_strs = [f"**{p['name']}** (~{p.get('distance_km')} किमी)" for p in other_nearby_ports]
                lines.append(f"• **इतर जवळची सागरी बंदरे**: {', '.join(alt_strs)}.")
            return "\n".join(lines)

        if is_list_ports_q:
            title = f"**{target_state.title()} मधील प्रमुख सागरी मासेमारी बंदरे (Fishing Ports)**:" if target_state else "**प्रमुख सागरी मासेमारी बंदरे (Fishing Ports)**:"
            lines = [title]
            for p in ports_catalog:
                dist_str = f" (~{p['distance_km']:.0f} किमी अंतर)" if p.get("distance_km") is not None else ""
                lines.append(f"• **{p['name']}** ({p['state']}){dist_str}: {p['advantage']}.")
            return "\n".join(lines)

        if is_exclude_q:
            lines = [f"**{exclude_name.title()} व्यतिरिक्त पर्यायी सागरी ठिकाणे**:"]
            for p in alt_ports[:3]:
                dist_str = f" (~{p['distance_km']} किमी अंतर)" if p.get("distance_km") else ""
                lines.append(f"• **{p['name']}**{dist_str}: {p.get('advantage', 'शांत सागरी बंदर')}. लाटा: **{wave_ht:.1f}m**, वारा: **{wind_str} किमी/तास** ({wind_dir}).")
            return "\n".join(lines)

        if is_compare_q:
            rec_mr = loc_name if risk.level == "LOW" else sec_name
            lines = [
                f"**किनारपट्टी तुलना**: **{loc_name}** विरुद्ध **{sec_name}** (~{alt_dist} किमी अंतर).",
                f"• **{loc_name}**: लाटा **{wave_ht:.1f}m**, वारा **{wind_str} किमी/तास** ({wind_dir}) — धोका पातळी: **{risk.level}**.",
                f"• **{sec_name}**: लाटा **{sec_wave:.1f}m**, वारा **{sec_wind_str} किमी/तास** — धोका पातळी: **{sec_risk_lvl}**.",
                f"• **शिफारस**: **{rec_mr}** सागरी कामकाजासाठी अधिक सुरक्षित किंवा शांत पर्याय आहे.",
            ]
            return "\n".join(lines)

        if is_vessel_q:
            if is_small_boat:
                is_ok = risk.level == "LOW" and wave_ht <= 1.0 and (wind_spd or 10) <= 18
                verdict = "लहान बोटी व होडीसाठी सुरक्षित" if is_ok else "लहान बोटींनी किनाऱ्यालगत राहावे / दक्षता"
                lines = [
                    f"**लहान बोट व लहान होडी सल्ला**: **{verdict}** ({loc_name}).",
                    f"• **सागरी स्थिती**: लाटा **{wave_ht:.1f}m** व वारा **{wind_str} किमी/तास** ({wind_dir}). {'लाटा शांत असल्याने लहान बोटी सुरक्षितपणे जाऊ शकतात.' if is_ok else 'लाटांचा मारा जास्त असल्याने बोट उलटण्याचा धोका. किनाऱ्यापासून 2 सागरी मैलांच्या आत राहा.'}",
                    f"• **सुरक्षा**: लाइफ जॅकेट नक्की वापरा. शांत पाण्यासाठी **{alt_name}** ({alt_dist} किमी) उत्तम पर्याय आहे.",
                ]
            else:
                lines = [
                    f"**यांत्रिकी ट्रॉलर्स (Trawlers) सल्ला ({loc_name})**:",
                    f"• **सागरी नेव्हिगेशन**: लाटा **{wave_ht:.1f}m** व वारा **{wind_str} किमी/तास** ({wind_dir}). खोल समुद्रात मासेमारीसाठी अनुकूल.",
                    f"• **प्रवाह व दिशा**: सागरी प्रवाह **{current_spd:.2f} मी/से** असून **{pfz_zone}** (~{pfz_dist_nm} सागरी मैल) कडे जावे.",
                ]
            return "\n".join(lines)

        if is_fish_species_q:
            lines = [
                f"**प्रमुख मासे व संभाव्य क्षेत्र ({loc_name})**:",
                f"• **प्रमुख जाती**: पाण्याच्या **{sst:.1f}°C** तापमानामुळे बांगडा (Mackerel), सुरमई (Kingfish) आणि ट्युना (Tuna) **{pfz_zone}** (~{pfz_dist_nm} सागरी मैल {pfz_bearing}) भागात भरपूर उपलब्ध आहेत.",
                f"• **किनाऱ्यालगत**: 15 ते 25 मीटर खोलीवर पापलेट (Pomfret) आणि कोळंबी (Prawns) मिळण्याची दाट शक्यता आहे.",
                f"• **साधने**: वरच्या माशांसाठी गिलनेट व तळातील माशांसाठी ट्रॉल जाळ्या वापरा.",
            ]
            return "\n".join(lines)

        if is_rain_storm_q:
            lines = [
                f"**पाऊस व वादळ अंदाज ({loc_name})**: **{weather_desc}**.",
                f"• **पाऊस स्थिती**: सध्या हवामान **{weather_desc}** असून दृश्यमानता चांगली आहे. कोणतेही मोठे वादळ नाही.",
                f"• **वादळ इशारा**: वाऱ्याचा वेग **{wind_str} किमी/तास** ({wind_dir}). या किनारपट्टीवर चक्रीवादळाचा (Cyclone) कोणताही इशारा नाही.",
            ]
            return "\n".join(lines)

        if is_temp_q:
            lines = [
                f"**समुद्राचे तापमान ({loc_name})**:",
                f"• **पाण्याचे तापमान (SST)**: समुद्राच्या पृष्ठभागाचे तापमान **{sst:.1f}°C** आहे (हवेचे तापमान: **{temp_c:.1f}°C**).",
                f"• **मासेमारी अनुकूलता**: हे तापमान प्लवंक (Plankton) आणि पेलॅजिक माशांच्या थव्यासाठी अतिशय पोषक आहे.",
            ]
            return "\n".join(lines)

        if is_timing_night_q:
            lines = [
                f"**बोटीची वेळ व रात्रीची मासेमारी ({loc_name})**:",
                f"• **रवानगीची वेळ**: खाडी पार करण्यासाठी मोठी भरती (**{tide_high or 'दुपारी'}**) च्या वेळेस निघणे सुरक्षित राहील.",
                f"• **रात्रकालीन सुरक्षा**: रात्रीचा धोका **{risk.level}** (लाटा: **{wave_ht:.1f}m**, वारा: **{wind_str} किमी/तास**). मास्तुलावरील पांढरे दिवे व व्हीएचएफ रेडिओ चालू ठेवा.",
            ]
            return "\n".join(lines)

        if is_why_q:
            lines = [
                f"**धोका पातळीचे कारण ({loc_name} - धोका: {risk.level})**:",
                f"• **मुख्य आकडे**: लाटांची उंची **{wave_ht:.1f} मीटर** आणि वाऱ्याचा वेग **{wind_str} किमी/तास** ({wind_dir}).",
                f"• **सुरक्षा निष्कर्ष**: समुद्राची स्थिती लहान बोटींच्या सुरक्षित परिचालन मर्यादेच्या {'पूर्ण अनुकूल' if risk.level == 'LOW' else ('जवळ' if risk.level == 'MODERATE' else 'बाहेर')} आहे.",
            ]
            return "\n".join(lines)

        if is_place_q:
            lines = [
                f"**{loc_name}**: {'मासेमारीसाठी सुरक्षित' if risk.level == 'LOW' else ('दक्षतेने जा' if risk.level == 'MODERATE' else 'धोकादायक')} (लाटा: **{wave_ht:.1f}m**, वारा: **{wind_str} किमी/तास** {wind_dir}).",
            ]
            if alt_name and alt_dist <= 80:
                lines.append(f"• **शांत बंदर पर्याय**: **{alt_name}** ({alt_dist} किमी अंतर) — {alt_adv}.")
            if has_pfz:
                lines.append(f"• **सक्रिय मासेमारी क्षेत्र (PFZ)**: **{pfz_zone}** (~{pfz_dist_nm} सागरी मैल {pfz_bearing}) मध्ये मासेमारी उत्तम राहील.")
            return "\n".join(lines)

        if is_safety_q:
            verdict = "सुरक्षित (जाण्यास हरकत नाही)" if risk.level == "LOW" else ("दक्षता बाळगा (सावधगिरी आवश्यक)" if risk.level == "MODERATE" else "धोकादायक (समुद्रात जाणे टाळा)")
            lines = [
                f"**{loc_name}: {verdict}** (धोका: {risk.level}).",
                f"• **समुद्र व वारा**: लाटा **{wave_ht:.1f} मीटर** · वारा **{wind_str} किमी/तास** ({wind_dir}).",
                f"• **सल्ला**: {'समुद्र शांत असून सर्व प्रकारच्या बोटींसाठी परिस्थिती अनुकूल आहे.' if risk.level == 'LOW' else 'समुद्रात मध्यम उधाण आहे, सावधगिरी बाळगा.'}",
            ]
            return "\n".join(lines)

        if is_wind_specific_q:
            lines = [
                f"**{loc_name} येथे सध्याचा वारा**: **{wind_str} किमी/तास** ({wind_knots_str} नॉट्स) — दिशा **{wind_dir}**.",
                f"• **हवामान स्थिती**: **{weather_desc}**, हवेचे तापमान **{temp_c:.1f}°C**.",
                f"• **सागरी प्रभाव**: लाटा **{wave_ht:.1f}m** (धोका: **{risk.level}**). {'वाऱ्याचा वेग नौकेसाठी सुरक्षित मर्यादेत आहे.' if risk.level == 'LOW' else 'वाऱ्यामुळे लाटांचा जोर जास्त; सावधगिरी बाळगा.'}",
            ]
            return "\n".join(lines)

        if is_wave_specific_q or is_wave_q:
            swell_str = f" · उधाण लाटा: **{swell_ht:.1f}m**" if swell_ht else ""
            cond = "शांत समुद्र" if wave_ht < 1.0 else ("मध्यम लाटा" if wave_ht < 2.0 else "उधाण व खवळलेला समुद्र")
            lines = [
                f"**{loc_name} लाटांचा अहवाल**: **{cond}**.",
                f"• **लाटांची उंची**: **{wave_ht:.1f} मीटर** (कालावधी {wave_period:.0f} से.){swell_str} · तापमान **{sst:.1f}°C**.",
                f"• **वारा व भरती**: वारा **{wind_str} किमी/तास** ({wind_dir}) · भरती स्थिती **{tide_status}**.",
            ]
            if alt_name and alt_dist <= 80 and wave_ht >= 1.2:
                lines.append(f"• **शांत बंदर पर्याय**: **{alt_name}** ({alt_dist} किमी अंतर) येथे लाटा कमी आहेत.")
            return "\n".join(lines)

        if is_tide_q:
            lines = [
                f"**{loc_name} भरती-ओहोटी अहवाल**: सध्या स्थिती **{tide_status}**{(' (' + tide_level + ')') if tide_level else ''}.",
                f"• **पुढील मोठी भरती**: **{tide_high or 'उपलब्ध नाही'}** · **पुढील ओहोटी**: **{tide_low or 'उपलब्ध नाही'}**.",
                f"• **खाडी नेव्हिगेशन**: बोटी बंदरात आणण्यासाठी भरतीच्या वेळेचा उपयोग करा.",
            ]
            return "\n".join(lines)

        if is_pfz_nav_q:
            lines = [
                f"**{loc_name} साठी INCOIS संभाव्य मासेमारी क्षेत्र (PFZ)**:",
                f"• **दिशा व बेअरिंग (Bearing)**: **{pfz_bearing_str}** ({pfz_coast} किनाऱ्यापासून).",
                f"• **अंतर**: किनाऱ्यापासून ~**{pfz_dist_km} किमी** (~{pfz_dist_nm} सागरी मैल).",
                f"• **खोली व माशांच्या जाती**: **{pfz_depth_range}** खोलीवर **{pfz_species_str}** मिळण्याची दाट शक्यता.",
                f"• **सागरी स्थिती**: पाण्याचे तापमान **{sst:.1f}°C**, लाटा **{wave_ht:.1f}m**, वारा **{wind_str} किमी/तास** ({wind_dir}) — धोका: **{risk.level}**.",
            ]
            return "\n".join(lines)

        if is_weather_q:
            display_title = "तुमच्या चालू स्थानाचे हवामान (Current Location)" if loc_name == "Your Current Location" else f"{loc_name} हवामान"
            lines = [
                f"**{display_title}**: **{weather_desc}**, **{temp_c:.1f}°C**.",
                f"• **वारा**: **{wind_str} किमी/तास** ({wind_dir}) · **लाटा**: **{wave_ht:.1f} मीटर** (धोका: **{risk.level}**).",
                f"• **सागरी स्थिती**: तापमान **{sst:.1f}°C**, भरती **{tide_status}**.",
            ]
            return "\n".join(lines)

        if is_pfz_q:
            if has_pfz:
                lines = [
                    f"**{loc_name} मासेमारी सल्ला व संभाव्य मासेमारी क्षेत्र (PFZ)**:",
                    f"• **सक्रिय क्षेत्र**: **{pfz_zone}** — **{pfz_bearing_str}**, ~**{pfz_dist_km} किमी** (~{pfz_dist_nm} सागरी मैल).",
                    f"• **खोली व जाती**: **{pfz_depth_range}** खोलीवर **{pfz_species_str}**.",
                ]
                if getattr(pfz, "summary", ""):
                    lines.append(f"• **थेट माहिती**: {pfz.summary}")
                lines.append(f"• **सागरी स्थिती**: तापमान **{sst:.1f}°C**, लाटा **{wave_ht:.1f}m**, वारा **{wind_str} किमी/तास** ({wind_dir}) — धोका: **{risk.level}**.")
            else:
                lines = [
                    f"**{loc_name} मासेमारी सल्ला**: किनाऱ्यालगतचे पाणी मासेमारीसाठी अनुकूल आहे.",
                    f"• **सागरी स्थिती**: लाटा **{wave_ht:.1f}m**, वारा **{wind_str} किमी/तास** ({wind_dir}), भरती **{tide_status}** (धोका: **{risk.level}**).",
                    f"• **सूचना**: सध्या कोणताही गंभीर हवामान इशारा किंवा मासेमारी बंदी नाही.",
                ]
            return "\n".join(lines)

        # Default Marathi
        lines = [
            f"**{loc_name} सागरी आढावा**: {'मासेमारीसाठी सुरक्षित' if risk.level == 'LOW' else ('सावधगिरी बाळगा' if risk.level == 'MODERATE' else 'धोकादायक')} (धोका: {risk.level}).",
            f"• **लाटा व समुद्र**: लाटा **{wave_ht:.1f}m** · पाण्याचे तापमान **{sst:.1f}°C** · भरती **{tide_status}**{(' (' + tide_level + ')') if tide_level else ''}.",
            f"• **हवामान व वारा**: **{weather_desc}**, तापमान **{temp_c:.1f}°C** · वारा **{wind_str} किमी/तास** ({wind_dir}).",
        ]
        if has_pfz:
            lines.append(f"• **मासेमारी क्षेत्र (PFZ)**: **{pfz_bearing_str}**, ~{pfz_dist_km} किमी ({pfz_depth_range}).")
        elif alt_name and alt_dist <= 80:
            lines.append(f"• **शांत बंदर पर्याय**: **{alt_name}** ({alt_dist} किमी अंतर) — {alt_adv}.")
        return "\n".join(lines)

    # ── English Dynamic Synthesis ───────────────────────────────
    if is_nearest_port_q:
        op_verdict_en = "SAFE TO OPERATE (LOW Risk)" if risk.level == "LOW" else ("CAUTION ADVISED" if risk.level == "MODERATE" else "UNSAFE — POSTPONE OPERATIONS")
        lines = [
            f"**Nearest Port from Your Location**: **{closest_port['name']}** ({closest_port.get('state', '')}) — ~**{closest_port_dist} km** away ({closest_port['lat']:.4f}°N, {closest_port['lon']:.4f}°E).",
            f"• **Marine Conditions**: Sea state is **{op_verdict_en}** with waves at **{wave_ht:.1f} m** and wind at **{wind_str} km/h** ({wind_dir}).",
            f"• **Harbor Advantage**: {closest_port.get('reason', 'Natural coastal shelter and berthing').rstrip('.')}.",
        ]
        if other_nearby_ports:
            alt_strs = [f"**{p['name']}** (~{p.get('distance_km')} km away)" for p in other_nearby_ports]
            lines.append(f"• **Other Nearby Coastal Ports**: {', '.join(alt_strs)}.")
        return "\n".join(lines)

    if is_list_ports_q:
        title = f"**Major Coastal Fishing Ports in {target_state.title()}**:" if target_state else "**Major Coastal Fishing Ports & Harbors**:"
        lines = [title]
        for p in ports_catalog:
            dist_str = f" (~{p['distance_km']:.0f} km away)" if p.get("distance_km") is not None else ""
            lines.append(f"• **{p['name']}** ({p['state']}){dist_str}: {p['advantage']}.")
        return "\n".join(lines)

    if is_exclude_q:
        lines = [
            f"**Recommended Coastal Alternatives to {exclude_name.title()}**:",
        ]
        for p in alt_ports[:3]:
            dist_str = f" (~{p['distance_km']} km away)" if p.get("distance_km") else ""
            lines.append(f"• **{p['name']}**{dist_str}: {p.get('advantage', 'Sheltered coastal waters')}. Current conditions: Waves **{wave_ht:.1f} m**, Wind **{wind_str} km/h** ({wind_dir}).")
        return "\n".join(lines)

    if is_compare_q:
        rec_en = loc_name if risk.level == "LOW" else sec_name
        lines = [
            f"**Coastal Harbor Comparison**: **{loc_name}** vs **{sec_name}** (~{alt_dist} km away).",
            f"• **{loc_name}**: Waves **{wave_ht:.1f} m**, Wind **{wind_str} km/h** ({wind_dir}) — Operational risk: **{risk.level}**.",
            f"• **{sec_name}**: Waves **{sec_wave:.1f} m**, Wind **{sec_wind_str} km/h** — Operational risk: **{sec_risk_lvl}**.",
            f"• Recommendation: **{rec_en}** offers comparable or safer conditions for marine operations.",
        ]
        return "\n".join(lines)

    if is_vessel_q:
        if is_small_boat:
            is_ok = risk.level == "LOW" and wave_ht <= 1.0 and (wind_spd or 10) <= 18
            verdict = "SAFE FOR INSHORE OPERATIONS" if is_ok else "CAUTION / RESTRICT TO SHELTERED WATERS"
            lines = [
                f"**Small Craft & Dinghy Advisory**: **{verdict} at {loc_name}**.",
                f"• **Sea State**: Waves at **{wave_ht:.1f} m** with winds at **{wind_str} km/h** ({wind_dir}). {'Calm surface conditions within small craft stability limits.' if is_ok else 'Surface chop poses swamping risk for low-freeboard vessels.'}",
                f"• **Operational Limit**: Restrict transit to within 3 nm of shore. Wear lifejackets. {'Protected waters available at **' + alt_name + '** (' + str(alt_dist) + ' km away).' if alt_name and not is_ok else 'Favorable for handline and nearshore gillnetting.'}",
            ]
        else:
            lines = [
                f"**Mechanized Trawler & Deepwater Vessel Advisory ({loc_name})**:",
                f"• **Navigation**: Wave swell is **{wave_ht:.1f} m** (period {wave_period:.0f}s) with sustained winds of **{wind_str} km/h** ({wind_dir}). Favorable for trawler transit.",
                f"• **Trawl Operations**: Surface drift velocity is **{current_spd:.2f} m/s**. Navigate toward **{pfz_zone}** (~{pfz_dist_nm} nm {pfz_bearing}) for productive hauls.",
            ]
        return "\n".join(lines)

    if is_fish_species_q:
        lines = [
            f"**Target Fish Species & Aggregation near {loc_name}**:",
            f"• **Pelagic Schools**: Indian mackerel, skipjack tuna, and oil sardines are active near thermal fronts in **{pfz_zone}** (~{pfz_dist_nm} nm {pfz_bearing}, SST: **{sst:.1f}°C**).",
            f"• **Demersal & Inshore**: Silver pomfret and coastal prawns are active along 15-30m depth shelves.",
            f"• **Gear Guidance**: Deploy surface drift gillnets for mackerel/tuna schools; bottom trawls for pomfret and prawns.",
        ]
        return "\n".join(lines)

    if is_rain_storm_q:
        lines = [
            f"**Precipitation & Storm Advisory for {loc_name}**: **{weather_desc}**.",
            f"• **Rainfall Status**: Weather is currently **{weather_desc}** with visibility intact. No squall lines or convective storms detected.",
            f"• **Cyclone & Warning Check**: Winds are blowing at **{wind_str} km/h** ({wind_dir}). No IMD depression or cyclone warnings active in this coastal sector.",
        ]
        return "\n".join(lines)

    if is_temp_q:
        lines = [
            f"**Sea Surface Temperature Report for {loc_name}**: **{sst:.1f}°C**.",
            f"• **Thermal Metrics**: Sea surface water temperature is **{sst:.1f}°C** (ambient air: **{temp_c:.1f}°C**).",
            f"• **Fishery Impact**: Thermal boundaries around {sst:.1f}°C stimulate plankton accumulation and pelagic feeding in **{pfz_zone}**.",
        ]
        return "\n".join(lines)

    if is_timing_night_q:
        lines = [
            f"**Harbor Timing & Night Operations for {loc_name}**:",
            f"• **Departure Window**: Plan channel crossing near high tide (**{tide_high or 'afternoon'}**) to ensure maximum navigational draft over coastal shoals.",
            f"• **Night Navigation**: Night sea risk is **{risk.level}** (Waves: **{wave_ht:.1f} m**, Wind: **{wind_str} km/h**). Ensure masthead lights, GPS, and VHF radio are functional.",
        ]
        return "\n".join(lines)

    if is_why_q:
        lines = [
            f"**Risk Assessment Rationale for {loc_name}** ({risk.level} Risk):",
            f"• **Primary Telemetry**: Significant wave height is **{wave_ht:.1f} m** (period {wave_period:.0f}s) with wind at **{wind_str} km/h** ({wind_dir}).",
            f"• **Safety Margin**: Conditions are {'well within standard operating thresholds for all craft' if risk.level == 'LOW' else ('moderately elevated, requiring cautious helm control' if risk.level == 'MODERATE' else 'hazardous, warranting postponement of operations')}.",
        ]
        return "\n".join(lines)

    if is_place_q:
        lines = [
            f"**{loc_name}**: {'Favorable for operations' if risk.level == 'LOW' else ('Proceed with caution' if risk.level == 'MODERATE' else 'High risk conditions')} (Waves: **{wave_ht:.1f} m**, Wind: **{wind_str} km/h** {wind_dir}).",
        ]
        if alt_name and alt_dist <= 80:
            lines.append(f"• **Recommended Sheltered Spot**: **{alt_name}** ({alt_dist} km away) — {alt_adv}.")
        if has_pfz:
            lines.append(f"• **Active Fishing Area (PFZ)**: **{pfz_zone}** (~{pfz_dist_nm} nm {pfz_bearing}) with favorable pelagic aggregation.")
        if tide_status != "Unavailable" and tide_high:
            lines.append(f"• **Tide Window**: Currently {tide_status} (Next High Tide at {tide_high}).")
        return "\n".join(lines)

    if is_safety_q:
        verdict = "SAFE TO OPERATE" if risk.level == "LOW" else ("CAUTION ADVISED" if risk.level == "MODERATE" else "UNSAFE — POSTPONE OPERATIONS")
        lines = [
            f"**{verdict} at {loc_name}** ({risk.level} Risk).",
            f"• **Sea & Wind**: Waves **{wave_ht:.1f} m** (period {wave_period:.0f}s) · Wind **{wind_str} km/h** ({wind_dir}).",
        ]
        if risk.level == "LOW":
            lines.append("• **Operational Advice**: Calm sea state within standard safety limits for small and motorized craft.")
        elif risk.level == "MODERATE":
            lines.append("• **Operational Advice**: Heightened swell/chop. Wear life jackets and avoid navigating alone.")
        else:
            lines.append("• **Operational Advice**: Hazardous sea conditions. Deepwater and small craft fishing should be postponed.")
        if alt_name and alt_dist <= 80 and risk.level != "LOW":
            lines.append(f"• **Shelter**: **{alt_name}** ({alt_dist} km away) offers protected waters.")
        return "\n".join(lines)

    if is_wind_specific_q:
        lines = [
            f"**Current Wind at {loc_name}**: **{wind_str} km/h** ({wind_knots_str} knots) from the **{wind_dir}**.",
            f"• **Atmospheric Conditions**: Weather is **{weather_desc}** with air temperature at **{temp_c:.1f}°C**.",
            f"• **Operational Impact**: Significant wave height is **{wave_ht:.1f} m** (Risk: **{risk.level}**). {'Favorable for coastal navigation and all vessel types.' if risk.level == 'LOW' else 'Elevated surface chop; exercise caution with low-freeboard craft.'}",
        ]
        return "\n".join(lines)

    if is_wave_specific_q or is_wave_q:
        swell_str = f" · Swell: **{swell_ht:.1f} m**" if swell_ht else ""
        cond = "Calm seas" if wave_ht < 1.0 else ("Moderate chop" if wave_ht < 2.0 else "Rough sea state")
        lines = [
            f"**Wave Conditions at {loc_name}**: **{cond}**.",
            f"• **Significant Waves**: **{wave_ht:.1f} m** (period {wave_period:.0f}s){swell_str} · SST **{sst:.1f}°C**.",
            f"• **Wind & Tide**: Wind **{wind_str} km/h** ({wind_dir}) · Tide **{tide_status}**.",
        ]
        if alt_name and alt_dist <= 80 and wave_ht >= 1.2:
            lines.append(f"• **Calmer Spot**: **{alt_name}** ({alt_dist} km away) provides lower swell.")
        return "\n".join(lines)

    if is_tide_q:
        lines = [
            f"**Tide Report for {loc_name}**: Currently **{tide_status}**{(' (' + tide_level + ')') if tide_level else ''}.",
            f"• **Next High Tide**: **{tide_high or 'N/A'}** · **Next Low Tide**: **{tide_low or 'N/A'}**.",
            f"• **Navigation Note**: Wave height is **{wave_ht:.1f} m** with **{wind_str} km/h** winds. Time harbor entry around high water.",
        ]
        return "\n".join(lines)

    if is_pfz_nav_q:
        lines = [
            f"**INCOIS Potential Fishing Zone (PFZ) for {loc_name}**:",
            f"• **Bearing & Direction**: **{pfz_bearing_str}** from the coast of **{pfz_coast}**.",
            f"• **Distance**: **{pfz_dist_km} km** (~{pfz_dist_nm} nautical miles) offshore.",
            f"• **Depth & Target Catch**: Operating depth **{pfz_depth_range}**; high probability of **{pfz_species_str}**.",
            f"• **Ocean State**: Sea Surface Temp **{sst:.1f}°C** · Waves **{wave_ht:.1f} m** · Wind **{wind_str} km/h** ({wind_dir}) — Risk: **{risk.level}**.",
        ]
        return "\n".join(lines)

    if is_weather_q:
        lines = [
            f"**Weather at {loc_name}**: **{weather_desc}**, **{temp_c:.1f}°C**.",
            f"• **Wind**: **{wind_str} km/h** ({wind_knots_str} knots, {wind_dir}) · **Waves**: **{wave_ht:.1f} m** (Risk: **{risk.level}**).",
            f"• **Sea State**: SST **{sst:.1f}°C**, Tide **{tide_status}**.",
        ]
        return "\n".join(lines)

    if is_pfz_q:
        if has_pfz:
            lines = [
                f"**Fishing Advisory & Potential Fishing Zone (PFZ) for {loc_name}**:",
                f"• **Active Zone**: **{pfz_zone}** — **{pfz_bearing_str}**, ~**{pfz_dist_km} km** (~{pfz_dist_nm} nm) from the coast of **{pfz_coast}**.",
                f"• **Operating Depth & Catch**: Depth **{pfz_depth_range}** · Target: **{pfz_species_str}**.",
            ]
            if getattr(pfz, "is_live", False) and getattr(pfz, "summary", ""):
                lines.append(f"• **Live Fleet Telemetry**: {pfz.summary}")
            elif getattr(pfz, "nearest_vessel_name", None) and getattr(pfz, "distance_to_vessel_km", None):
                lines.append(f"• **Nearest Vessel**: **{pfz.nearest_vessel_name}** (~{pfz.distance_to_vessel_km:.1f} km offshore).")
            lines.append(f"• **Ocean Telemetry**: Sea Surface Temp **{sst:.1f}°C** · Waves **{wave_ht:.1f} m** · Wind **{wind_str} km/h** ({wind_dir}) — Risk: **{risk.level}**.")
            lines.append(f"• **Operational Assessment**: Risk level is **{risk.level}**. Favorable conditions for pelagic operations.")
        else:
            lines = [
                f"**Fishing Advisory for {loc_name}**: Nearshore waters are suitable for coastal fishing.",
                f"• **Ocean Telemetry**: Waves **{wave_ht:.1f} m** · Wind **{wind_str} km/h** ({wind_dir}) · Tide **{tide_status}**.",
                f"• **Safety Assessment**: Operational risk is **{risk.level}**. No severe weather warnings or offshore closures currently in effect.",
            ]
        return "\n".join(lines)

    # Default English
    lines = [
        f"**{loc_name} Marine Telemetry**: {'Safe for operations' if risk.level == 'LOW' else ('Proceed with caution' if risk.level == 'MODERATE' else 'High risk - Unsafe')} ({risk.level} Risk).",
        f"• **Sea State**: Waves **{wave_ht:.1f} m** (period {wave_period:.0f}s) · SST **{sst:.1f}°C** · Tide **{tide_status}**{(' (' + tide_level + ')') if tide_level else ''}.",
        f"• **Weather & Wind**: **{weather_desc}**, air **{temp_c:.1f}°C** · Wind **{wind_str} km/h** ({wind_knots_str} knots) from **{wind_dir}**.",
    ]
    if has_pfz:
        lines.append(f"• **INCOIS PFZ**: **{pfz_bearing_str}**, ~**{pfz_dist_km} km** from {pfz_coast} (Depth: {pfz_depth_range}, Target: {pfz_species_str}).")
    elif alt_name and alt_dist <= 80:
        lines.append(f"• **Sheltered Harbor**: **{alt_name}** ({alt_dist} km away) — {alt_adv}.")
    return "\n".join(lines)


def _template_response(
    risk: RiskAssessment,
    weather: WeatherData | None,
    marine: MarineConditions | None,
    tide: TideData | None,
    lang: str = "en",
) -> str:
    """Deterministic multilingual fallback response."""
    state = {
        "risk_assessment": risk,
        "weather_data": weather,
        "marine_data": marine,
        "tide_data": tide,
        "language": lang,
    }
    return _intelligent_multi_agent_synthesizer(state, lang=lang)
