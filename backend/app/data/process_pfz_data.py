import os
import re
import math
import json
from pathlib import Path
import pandas as pd

def parse_dms(s):
    if not isinstance(s, str):
        return None
    s = s.strip()
    parts = re.findall(r'(\d+(?:\.\d+)?|[NSEWnsew])', s)
    if len(parts) >= 3:
        deg = float(parts[0])
        minute = float(parts[1])
        sec = float(parts[2])
        direction = parts[3].upper() if len(parts) > 3 else 'N'
        val = deg + minute / 60.0 + sec / 3600.0
        if direction in ['S', 'W']:
            val = -val
        return val
    return None

def parse_dist(s):
    if pd.isna(s):
        return None
    m = re.findall(r'\d+(?:\.\d+)?', str(s))
    if len(m) >= 2:
        return (float(m[0]) + float(m[1])) / 2.0
    elif len(m) == 1:
        return float(m[0])
    return None

def parse_bearing(s):
    if pd.isna(s):
        return None
    m = re.findall(r'\d+(?:\.\d+)?', str(s))
    return float(m[0]) if m else None

def get_coast_coords(pfz_lat, pfz_lon, bearing_deg, dist_km):
    if pfz_lat is None or pfz_lon is None or bearing_deg is None or dist_km is None:
        return None, None
    R = 6371.0
    d = dist_km / R
    brng = math.radians((bearing_deg + 180) % 360)
    lat1 = math.radians(pfz_lat)
    lon1 = math.radians(pfz_lon)
    lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brng))
    lon2 = lon1 + math.atan2(math.sin(brng) * math.sin(d) * math.cos(lat1), math.cos(d) - math.sin(lat1) * math.sin(lat2))
    return round(math.degrees(lat2), 4), round(math.degrees(lon2), 4)

STATE_META = [
    {'file': 'PfzForecast_GOA.xls', 'id': 'goa', 'name': 'Goa', 'displayName': 'Goa'},
    {'file': 'PfzForecast_GUJARAT.xls', 'id': 'gujarat', 'name': 'Gujarat', 'displayName': 'Gujarat'},
    {'file': 'PfzForecast_KARNATAKA.xls', 'id': 'karnataka', 'name': 'Karnataka', 'displayName': 'Karnataka'},
    {'file': 'PfzForecast_MAHARASHTRA.xls', 'id': 'maharashtra', 'name': 'Maharashtra', 'displayName': 'Maharashtra'},
    {'file': 'PfzForecast_NORTH ANDHRAPRADESH.xls', 'id': 'north_andhrapradesh', 'name': 'North Andhra Pradesh', 'displayName': 'North Andhra Pradesh'},
    {'file': 'PfzForecast_SOUTH ANDHRAPRADESH.xls', 'id': 'south_andhrapradesh', 'name': 'South Andhra Pradesh', 'displayName': 'South Andhra Pradesh'},
    {'file': 'PfzForecast_NORTH TAMILNADU.xls', 'id': 'north_tamilnadu', 'name': 'North Tamil Nadu', 'displayName': 'North Tamil Nadu'},
    {'file': 'PfzForecast_ODISHA.xls', 'id': 'odisha', 'name': 'Odisha', 'displayName': 'Odisha'},
    {'file': 'PfzForecast_WEST BENGAL.xls', 'id': 'west_bengal', 'name': 'West Bengal', 'displayName': 'West Bengal'},
]

def main():
    root = Path(__file__).resolve().parent.parent.parent.parent
    pfz_dir = root / 'pfz_data'
    
    states_data = []
    all_coasts = []
    
    for item in STATE_META:
        filepath = pfz_dir / item['file']
        if not filepath.exists():
            print(f"Skipping missing {filepath}")
            continue
            
        df = pd.read_excel(filepath)
        h_idx = None
        validity = ""
        for i, row in df.iterrows():
            row_str = " ".join([str(v) for v in row.values if pd.notna(v)])
            if 'FORECAST VALIDITY' in row_str:
                validity = row_str.strip()
            if any('From the coast of' in str(v) for v in row.values):
                h_idx = i
                break
                
        if h_idx is None:
            continue
            
        sub = df.iloc[h_idx + 1:].copy()
        sub.columns = [str(c).strip() for c in df.iloc[h_idx].values]
        sub = sub.dropna(subset=['From the coast of'])
        sub = sub[~sub['From the coast of'].astype(str).str.contains('ABBREVIATION|NOTE|Source', case=False, na=False)]
        
        coast_list = []
        for _, r in sub.iterrows():
            coast_name = str(r['From the coast of']).strip()
            direction = str(r.get('Direction', '')).strip()
            bearing = parse_bearing(r.get('Bearing (deg)'))
            dist_str = str(r.get('Distance (km) From-To', '')).strip()
            dist_avg = parse_dist(dist_str)
            depth_str = str(r.get('Depth (mtr) From-To', '')).strip()
            lat_str = str(r.get('Latitude (dms)', '')).strip()
            lon_str = str(r.get('Longitude (dms)', '')).strip()
            lat = parse_dms(lat_str)
            lon = parse_dms(lon_str)
            c_lat, c_lon = get_coast_coords(lat, lon, bearing, dist_avg)
            
            clean_name = re.sub(r'[^a-zA-Z0-9]+', '-', f"{item['id']}-{coast_name}").lower().strip('-')
            
            coast_obj = {
                'id': clean_name,
                'name': coast_name,
                'state': item['name'],
                'stateId': item['id'],
                'lat': c_lat if c_lat else lat,
                'lon': c_lon if c_lon else lon,
                'direction': direction,
                'bearing': bearing,
                'distance': dist_str,
                'distanceKm': dist_avg,
                'depth': depth_str,
                'latDms': lat_str,
                'lonDms': lon_str,
                'pfzLat': round(lat, 4) if lat else None,
                'pfzLon': round(lon, 4) if lon else None,
            }
            coast_list.append(coast_obj)
            all_coasts.append(coast_obj)
            
        avg_lat = sum(c['lat'] for c in coast_list) / len(coast_list) if coast_list else 0
        avg_lon = sum(c['lon'] for c in coast_list) / len(coast_list) if coast_list else 0
        
        # Pick primary coast for state default
        primary_coast = coast_list[0] if coast_list else None
        
        state_obj = {
            'id': item['id'],
            'name': item['name'],
            'displayName': item['displayName'],
            'validity': validity,
            'centerLat': round(avg_lat, 4),
            'centerLon': round(avg_lon, 4),
            'coastCount': len(coast_list),
            'defaultPort': primary_coast,
            'coasts': coast_list,
        }
        states_data.append(state_obj)
        print(f"Loaded {item['name']}: {len(coast_list)} coasts")

    # Output to frontend/src/data/incois_pfz.json
    fe_target = root / 'frontend' / 'src' / 'data' / 'incois_pfz.json'
    fe_target.parent.mkdir(parents=True, exist_ok=True)
    with open(fe_target, 'w', encoding='utf-8') as f:
        json.dump({'states': states_data, 'coasts': all_coasts}, f, indent=2, ensure_ascii=False)
    print(f"Saved frontend JSON to {fe_target}")
    
    # Output to backend app/data/incois_pfz.json
    be_target = root / 'backend' / 'app' / 'data' / 'incois_pfz.json'
    be_target.parent.mkdir(parents=True, exist_ok=True)
    with open(be_target, 'w', encoding='utf-8') as f:
        json.dump({'states': states_data, 'coasts': all_coasts}, f, indent=2, ensure_ascii=False)
    print(f"Saved backend JSON to {be_target}")

    # Generate fallback_pfz.json for backward compatibility and backend tools
    fallback_entries = []
    for c in all_coasts:
        fallback_entries.append({
            "zone": f"{c['name']} PFZ Zone ({c['state']})",
            "latitude": c['pfzLat'] if c['pfzLat'] else c['lat'],
            "longitude": c['pfzLon'] if c['pfzLon'] else c['lon'],
            "coast_latitude": c['lat'],
            "coast_longitude": c['lon'],
            "coast_name": c['name'],
            "state": c['state'],
            "state_id": c['stateId'],
            "direction": c['direction'],
            "bearing": c['bearing'],
            "distance_km": c['distance'],
            "depth_range_m": c['depth'],
            "summary": f"INCOIS Potential Fishing Zone (PFZ) advisory off {c['name']}, {c['state']}. Bearing {c['bearing']}° ({c['direction']}), Distance {c['distance']} km, Depth {c['depth']} m.",
            "issued_at": "2026-09-27T06:00:00Z",
            "species_likely": ["Mackerel", "Sardine", "Tuna", "Pomfret", "Ribbonfish"]
        })
    fallback_path = root / 'backend' / 'app' / 'data' / 'fallback_pfz.json'
    with open(fallback_path, 'w', encoding='utf-8') as f:
        json.dump(fallback_entries, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(fallback_entries)} entries to {fallback_path}")

if __name__ == '__main__':
    main()
