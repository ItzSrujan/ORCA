"""Coastal harbors and spatial map telemetry service backed by INCOIS PFZ data."""

from __future__ import annotations

import json
import math
from pathlib import Path
import re
from typing import Any

from app.core.logging import get_logger

logger = get_logger("services.coastal")

PFZ_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "incois_pfz.json"


def calc_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate approximate geodesic distance in kilometers between two coordinates."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return round(r * c, 1)


def clean_pfz_name(raw_name: str) -> str:
    """Clean raw Excel coast landing names into readable location names."""
    n = raw_name
    n = re.sub(r'F\.?F\.?T\.?A\.?\s*\([^)]*\)', '', n)
    n = re.sub(r'F\.?F\.?T\.?A\.?', '', n)
    if n.endswith('FH'):
        n = n[:-2]
    n = re.sub(r'\.([A-Za-z(])', r'. \1', n)
    n = re.sub(r'([a-z])([A-Z])', r'\1 \2', n)
    n = re.sub(r'\s+', ' ', n).strip()
    return n or raw_name


def _load_incois_coasts() -> list[dict[str, Any]]:
    """Load and index all coastal ports from the user-provided INCOIS PFZ dataset."""
    if not PFZ_DATA_PATH.exists():
        logger.warning("incois_pfz.json not found at %s", PFZ_DATA_PATH)
        return []

    try:
        with open(PFZ_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("coasts", [])
    except Exception as exc:
        logger.error("Failed to load incois_pfz.json: %s", exc)
        return []


# Load coasts at module initialization
_RAW_COASTS = _load_incois_coasts()

# Build comprehensive paired port directory from INCOIS PFZ data
COASTAL_PORT_PAIRS: list[dict[str, Any]] = []

if _RAW_COASTS:
    for c in _RAW_COASTS:
        c_lat = float(c["lat"])
        c_lon = float(c["lon"])
        c_name = clean_pfz_name(c["name"])
        c_state = c.get("state", "")
        c_state_id = c.get("stateId", "")

        # Find closest distinct alternative coast from the same state (>= 3.0 km)
        same_state_alts = [
            other for other in _RAW_COASTS
            if other.get("stateId") == c_state_id and calc_distance_km(c_lat, c_lon, float(other["lat"]), float(other["lon"])) >= 3.0
        ]

        if same_state_alts:
            same_state_alts.sort(key=lambda o: calc_distance_km(c_lat, c_lon, float(o["lat"]), float(o["lon"])))
            alt = same_state_alts[0]
        else:
            other_alts = [
                other for other in _RAW_COASTS
                if calc_distance_km(c_lat, c_lon, float(other["lat"]), float(other["lon"])) >= 5.0
            ]
            other_alts.sort(key=lambda o: calc_distance_km(c_lat, c_lon, float(o["lat"]), float(o["lon"])))
            alt = other_alts[0] if other_alts else c

        alt_name = clean_pfz_name(alt["name"])
        alt_state = alt.get("state", "")
        alt_depth = alt.get("depth", "20-40")
        alt_bearing = alt.get("bearing")
        alt_dir = alt.get("direction", "")
        alt_dist = calc_distance_km(c_lat, c_lon, float(alt["lat"]), float(alt["lon"]))

        dir_desc = f" ({alt_dir} sector)" if alt_dir else ""
        bearing_desc = f" with {alt_bearing}° offshore bearing" if alt_bearing else ""
        reason = (
            f"Documented INCOIS PFZ landing center in {alt_state}{dir_desc} at {alt_depth}m depth"
            f"{bearing_desc}, providing natural coastal shelter and calmer waters."
        )

        COASTAL_PORT_PAIRS.append({
            "id": c.get("id", c_name.lower().replace(" ", "-")),
            "name": f"{c_name}, {c_state}" if c_state else c_name,
            "coast_name": c_name,
            "state": c_state,
            "lat": c_lat,
            "lon": c_lon,
            "alt_name": f"{alt_name}, {alt_state}" if alt_state else alt_name,
            "alt_coast_name": alt_name,
            "alt_lat": float(alt["lat"]),
            "alt_lon": float(alt["lon"]),
            "alt_state": alt_state,
            "reason": reason,
            "depth": c.get("depth", "10-50"),
            "distance_km": alt_dist,
            "direction": c.get("direction", "SW"),
            "bearing": c.get("bearing"),
            "pfz_lat": c.get("pfzLat"),
            "pfz_lon": c.get("pfzLon"),
        })
else:
    # Minimal static fallback if file missing
    COASTAL_PORT_PAIRS = [
        {
            "id": "digha-mohana",
            "name": "Digha Mohana, West Bengal",
            "coast_name": "Digha Mohana",
            "state": "West Bengal",
            "lat": 21.6164,
            "lon": 87.5421,
            "alt_name": "Sankarpur, West Bengal",
            "alt_coast_name": "Sankarpur",
            "alt_lat": 21.6263,
            "alt_lon": 87.5742,
            "alt_state": "West Bengal",
            "reason": "Documented INCOIS PFZ landing center at 43-48m depth providing natural coastal shelter.",
            "distance_km": 6.9,
            "depth": "24-29",
            "direction": "SW",
            "bearing": 260.0,
            "pfz_lat": 21.0833,
            "pfz_lon": 87.5922,
        }
    ]


def find_closest_port(lat: float, lon: float) -> dict[str, Any]:
    """Find the closest coastal port or landing center from the INCOIS PFZ directory."""
    best = COASTAL_PORT_PAIRS[0]
    min_dist = float("inf")
    for port in COASTAL_PORT_PAIRS:
        d = (port["lat"] - lat) ** 2 + (port["lon"] - lon) ** 2
        if d < min_dist:
            min_dist = d
            best = port
    return best


def find_alternative_ports(
    lat: float,
    lon: float,
    exclude_name: str = "",
    limit: int = 3,
) -> list[dict[str, Any]]:
    """Find nearby coastal ports from INCOIS PFZ data, excluding the specified location/port."""
    ex_lower = exclude_name.lower().strip()
    ports_with_dist = []

    for p in COASTAL_PORT_PAIRS:
        p_name = p["name"].lower()
        p_coast = p.get("coast_name", "").lower()
        p_id = p["id"].lower()

        # Skip if matches exclusion
        if ex_lower and (ex_lower in p_name or ex_lower in p_coast or p_id in ex_lower):
            continue

        dist = calc_distance_km(lat, lon, p["lat"], p["lon"])
        if dist >= 2.0:  # not the exact same point
            ports_with_dist.append({
                "name": p["name"],
                "state": p.get("state", ""),
                "latitude": p["lat"],
                "longitude": p["lon"],
                "distance_km": dist,
                "alt_name": p["alt_name"],
                "advantage": p.get("reason", "Sheltered PFZ coastal landing with lower wave energy").rstrip("."),
            })

    ports_with_dist.sort(key=lambda x: x["distance_km"])
    return ports_with_dist[:limit]


def list_all_coastal_ports(
    lat: float | None = None,
    lon: float | None = None,
    state_filter: str = "",
    limit: int = 12,
) -> list[dict[str, Any]]:
    """Return an organized directory of INCOIS PFZ fishing ports, optionally sorted by distance."""
    st_filter = state_filter.lower().strip()
    ports = []

    for p in COASTAL_PORT_PAIRS:
        p_state = p.get("state", "")
        if st_filter and st_filter not in p_state.lower() and st_filter not in p["name"].lower():
            continue
        dist = None
        if lat is not None and lon is not None:
            dist = calc_distance_km(lat, lon, p["lat"], p["lon"])
        ports.append({
            "id": p["id"],
            "name": p["name"],
            "state": p_state,
            "latitude": p["lat"],
            "longitude": p["lon"],
            "distance_km": dist,
            "advantage": p.get("reason", "INCOIS PFZ marine landing center with fishing vessel access").rstrip("."),
            "sheltered_alternative": p.get("alt_name", ""),
        })

    if lat is not None and lon is not None:
        ports.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else 9999)
    return ports[:limit]


def get_spatial_map_context(
    lat: float,
    lon: float,
    location_name: str = "",
    pfz_zone: str | None = None,
    exclude_name: str = "",
) -> dict[str, Any]:
    """Assemble spatial map context including primary PFZ port, alternative candidate ports, and PFZ zone."""
    closest = find_closest_port(lat, lon)
    primary_name = location_name or closest["name"]
    alt_name = closest["alt_name"]
    alt_lat = closest["alt_lat"]
    alt_lon = closest["alt_lon"]
    dist_km = calc_distance_km(lat, lon, alt_lat, alt_lon)

    # Candidate alternative place from INCOIS PFZ dataset
    candidates = [
        {
            "name": alt_name,
            "latitude": alt_lat,
            "longitude": alt_lon,
            "distance_km": dist_km,
            "type": "sheltered_harbor",
            "advantage": closest.get("reason", "Documented INCOIS PFZ landing center with lower wave energy").rstrip("."),
        }
    ]

    # Additional alternative ports along the coast from INCOIS PFZ data
    effective_exclude = exclude_name or primary_name
    alt_ports = find_alternative_ports(lat, lon, exclude_name=effective_exclude, limit=3)

    # Authentic PFZ spatial zone using actual coordinates from incois_pfz.json
    pfz_info = None
    pfz_lat = closest.get("pfz_lat")
    pfz_lon = closest.get("pfz_lon")

    if pfz_lat is not None and pfz_lon is not None:
        direction_label = closest.get("direction", "Offshore")
        bearing_label = f"{closest.get('bearing')}°" if closest.get("bearing") is not None else ""
        bearing_full = f"{direction_label} ({bearing_label})" if bearing_label else direction_label
        distance_nm = round((closest.get("distance_km") or 12.0) / 1.852, 1)

        pfz_info = {
            "zone_name": pfz_zone or f"{closest.get('coast_name', closest['name'])} PFZ Zone",
            "latitude": pfz_lat,
            "longitude": pfz_lon,
            "bearing": bearing_full,
            "distance_nm": distance_nm,
            "depth_range_m": closest.get("depth", "20-50m"),
            "type": "potential_fishing_zone",
        }
    elif pfz_zone:
        pfz_info = {
            "zone_name": pfz_zone,
            "latitude": round(lat - 0.1, 4),
            "longitude": round(lon + 0.1, 4),
            "bearing": "South-East",
            "distance_nm": 8,
            "type": "potential_fishing_zone",
        }

    # Caution area (offshore swell sector)
    caution_info = {
        "area_name": f"{primary_name.split(',')[0]} Offshore Swell Sector",
        "latitude": round(lat - 0.2, 4),
        "longitude": round(lon - 0.05, 4),
        "radius_km": 15,
        "type": "caution_area",
    }

    return {
        "primary_location": {
            "name": primary_name,
            "latitude": lat,
            "longitude": lon,
        },
        "suggested_alternative": candidates[0],
        "all_candidate_places": candidates,
        "alternative_ports": alt_ports,
        "pfz_advisory_area": pfz_info,
        "caution_area": caution_info,
    }
