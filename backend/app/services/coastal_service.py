"""Coastal harbors and spatial map telemetry service."""

from __future__ import annotations

import math
from typing import Any

# Comprehensive coastal ports & sheltered harbor pairings across the Indian coastline
COASTAL_PORT_PAIRS = [
    {
        "id": "digha",
        "name": "Digha, West Bengal",
        "state": "West Bengal",
        "lat": 21.6266,
        "lon": 87.5074,
        "alt_name": "Mandarmani (Sheltered Bay)",
        "alt_lat": 21.6642,
        "alt_lon": 87.7012,
        "reason": "Natural sandbar curvature provides lower swell and gentler wave breaking than Digha outer shore.",
    },
    {
        "id": "mandarmani",
        "name": "Mandarmani, West Bengal",
        "state": "West Bengal",
        "lat": 21.6642,
        "lon": 87.7012,
        "alt_name": "Sagar Island Anchorage",
        "alt_lat": 21.6500,
        "alt_lon": 88.0500,
        "reason": "Estuarine lee protection provides calm holding grounds during open sea chop.",
    },
    {
        "id": "mumbai",
        "name": "Mumbai (Sassoon Dock)",
        "state": "Maharashtra",
        "lat": 18.9167,
        "lon": 72.8258,
        "alt_name": "Alibaug Outer Bay",
        "alt_lat": 18.6414,
        "alt_lon": 72.8722,
        "reason": "Natural coastal shelter provides lower wave heights and reduced chop compared with Mumbai harbor mouth.",
    },
    {
        "id": "alibaug",
        "name": "Alibaug Outer Bay",
        "state": "Maharashtra",
        "lat": 18.6414,
        "lon": 72.8722,
        "alt_name": "Murud-Janjira Anchorage",
        "alt_lat": 18.3000,
        "alt_lon": 72.9600,
        "reason": "Natural coastal bay provides sheltered calm holding grounds protected from Arabian Sea chop.",
    },
    {
        "id": "jaigad",
        "name": "Jaigad Harbor",
        "state": "Maharashtra",
        "lat": 17.3000,
        "lon": 73.2100,
        "alt_name": "Ganpatipule Cove",
        "alt_lat": 17.1500,
        "alt_lon": 73.2600,
        "reason": "Protected deep estuarine inlet shielded from heavy south-westerly swell.",
    },
    {
        "id": "ratnagiri",
        "name": "Ratnagiri (Mirkarwada)",
        "state": "Maharashtra",
        "lat": 16.9902,
        "lon": 73.2844,
        "alt_name": "Jaigad Sheltered Harbor",
        "alt_lat": 17.3000,
        "alt_lon": 73.2000,
        "reason": "Deep estuarine inlet with natural rocky headland deflecting southerly swells.",
    },
    {
        "id": "chennai",
        "name": "Chennai (Kasimedu)",
        "state": "Tamil Nadu",
        "lat": 13.1235,
        "lon": 80.2985,
        "alt_name": "Mahabalipuram Cove",
        "alt_lat": 12.6269,
        "alt_lon": 80.1927,
        "reason": "Rocky promontory softens shoreward swells and longshore current drift.",
    },
    {
        "id": "visakhapatnam",
        "name": "Visakhapatnam Harbor",
        "state": "Andhra Pradesh",
        "lat": 17.6974,
        "lon": 83.2983,
        "alt_name": "Bheemunipatnam Shore",
        "alt_lat": 17.8900,
        "alt_lon": 83.4500,
        "reason": "Gosthani river mouth spit reduces open ocean wave energy.",
    },
    {
        "id": "kochi",
        "name": "Kochi (Thoppumpady)",
        "state": "Kerala",
        "lat": 9.9312,
        "lon": 76.2673,
        "alt_name": "Munambam Harbor",
        "alt_lat": 10.1800,
        "alt_lon": 76.1700,
        "reason": "Protected breakwater entrance with reduced cross-current chop.",
    },
    {
        "id": "veraval",
        "name": "Veraval Harbor",
        "state": "Gujarat",
        "lat": 20.9077,
        "lon": 70.3688,
        "alt_name": "Mangrol Coastal Anchorage",
        "alt_lat": 21.1200,
        "alt_lon": 70.1200,
        "reason": "Shallow reef barrier dampens Arabian Sea swell energy.",
    },
    {
        "id": "porbandar",
        "name": "Porbandar Port",
        "state": "Gujarat",
        "lat": 21.6422,
        "lon": 69.6093,
        "alt_name": "Navibandar Estuary",
        "alt_lat": 21.4500,
        "alt_lon": 69.7800,
        "reason": "Bhadar river estuary provides natural silted basin sheltered from south-west winds.",
    },
    {
        "id": "dahanu",
        "name": "Dahanu Harbor",
        "state": "Maharashtra",
        "lat": 19.9700,
        "lon": 72.7300,
        "alt_name": "Tarapur Sheltered Cove",
        "alt_lat": 19.8600,
        "alt_lon": 72.6800,
        "reason": "Coastal creek headland offers sheltered berthing away from outer shoals.",
    },
    {
        "id": "goa",
        "name": "Goa (Mormugao / Panaji)",
        "state": "Goa",
        "lat": 15.4000,
        "lon": 73.8000,
        "alt_name": "Chapora Bay",
        "alt_lat": 15.6000,
        "alt_lon": 73.7400,
        "reason": "Zuari river natural bay deflects high monsoon swells.",
    },
    {
        "id": "karwar",
        "name": "Karwar (Baithkol)",
        "state": "Karnataka",
        "lat": 14.8000,
        "lon": 74.1300,
        "alt_name": "Devbagh Estuary",
        "alt_lat": 14.8500,
        "alt_lon": 74.1100,
        "reason": "Kali river delta provides calm holding grounds during heavy sea swell.",
    },
    {
        "id": "mangalore",
        "name": "Mangalore (Malpe / Old Port)",
        "state": "Karnataka",
        "lat": 13.3500,
        "lon": 74.7000,
        "alt_name": "Gangolli Estuary",
        "alt_lat": 13.6300,
        "alt_lon": 74.6700,
        "reason": "Protected river confluence with stone breakwaters attenuating wave energy.",
    },
    {
        "id": "puri",
        "name": "Puri Coastal Harbor",
        "state": "Odisha",
        "lat": 19.8135,
        "lon": 85.8312,
        "alt_name": "Chilika Mouth Anchorage",
        "alt_lat": 19.6800,
        "alt_lon": 85.5200,
        "reason": "Protected lagoon opening offers sheltered waters from Bay of Bengal breakers.",
    },
    {
        "id": "paradip",
        "name": "Paradip Fishing Harbor",
        "state": "Odisha",
        "lat": 20.3160,
        "lon": 86.6110,
        "alt_name": "Mahanadi River Basin",
        "alt_lat": 20.2800,
        "alt_lon": 86.6800,
        "reason": "Deep estuarine creek with breakwater protection against strong littoral drift.",
    },
]


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
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 1)


def find_closest_port(lat: float, lon: float) -> dict[str, Any]:
    """Find the closest coastal port or harbor pair from the registered directory."""
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
    """Find nearby coastal ports excluding the specified location/port."""
    ex_lower = exclude_name.lower().strip()
    ports_with_dist = []
    for p in COASTAL_PORT_PAIRS:
        p_name = p["name"].lower()
        p_id = p["id"].lower()
        p_alt = p["alt_name"].lower()
        # Skip if matches exclusion
        if ex_lower and (ex_lower in p_name or p_id in ex_lower or ex_lower in p_alt):
            continue
        dist = calc_distance_km(lat, lon, p["lat"], p["lon"])
        if dist > 1.0:  # not the exact same point
            ports_with_dist.append({
                "name": p["name"],
                "state": p.get("state", ""),
                "latitude": p["lat"],
                "longitude": p["lon"],
                "distance_km": dist,
                "alt_name": p["alt_name"],
                "advantage": p.get("reason", "Sheltered coastal waters with lower wave energy").rstrip("."),
            })
    ports_with_dist.sort(key=lambda x: x["distance_km"])
    return ports_with_dist[:limit]


def list_all_coastal_ports(
    lat: float | None = None,
    lon: float | None = None,
    state_filter: str = "",
    limit: int = 12,
) -> list[dict[str, Any]]:
    """Return an organized directory of coastal fishing ports and harbors, optionally sorted by distance."""
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
            "advantage": p.get("reason", "Sheltered marine harbor with fishing vessel berthing").rstrip("."),
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
    """Assemble spatial map context including primary harbor, alternative places, and PFZ."""
    closest = find_closest_port(lat, lon)
    primary_name = location_name or closest["name"]
    alt_name = closest["alt_name"]
    alt_lat = closest["alt_lat"]
    alt_lon = closest["alt_lon"]
    dist_km = calc_distance_km(lat, lon, alt_lat, alt_lon)

    # Nearby candidate places to suggest
    candidates = [
        {
            "name": alt_name,
            "latitude": alt_lat,
            "longitude": alt_lon,
            "distance_km": dist_km,
            "type": "sheltered_harbor",
            "advantage": closest.get("reason", "Sheltered coastal waters with lower wave energy").rstrip("."),
        }
    ]

    # Additional alternative ports along the coast excluding the current or requested port
    effective_exclude = exclude_name or primary_name
    alt_ports = find_alternative_ports(lat, lon, exclude_name=effective_exclude, limit=3)

    # PFZ spatial zone
    pfz_info = None
    if pfz_zone:
        pfz_info = {
            "zone_name": pfz_zone,
            "latitude": round(lat - 0.1, 4),
            "longitude": round(lon + 0.1, 4),
            "bearing": "South-East",
            "distance_nm": 8,
            "type": "potential_fishing_zone",
        }

    # Caution area (e.g. offshore swell or shallow shoals)
    caution_info = {
        "area_name": f"{primary_name} Offshore Swell Sector",
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
