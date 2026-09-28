import rawPfzData from './incois_pfz.json';

export interface PfzCoast {
  id: string;
  name: string;
  state: string;
  stateId: string;
  lat: number;
  lon: number;
  direction: string;
  bearing: number | null;
  distance: string;
  distanceKm: number | null;
  depth: string;
  latDms: string;
  lonDms: string;
  pfzLat: number | null;
  pfzLon: number | null;
}

export interface PfzState {
  id: string;
  name: string;
  displayName: string;
  validity: string;
  centerLat: number;
  centerLon: number;
  coastCount: number;
  defaultPort: PfzCoast;
  coasts: PfzCoast[];
}

interface IncoisPfzData {
  states: PfzState[];
  coasts: PfzCoast[];
}

const pfzData = rawPfzData as IncoisPfzData;

export const INCOIS_PFZ_STATES: PfzState[] = pfzData.states;
export const ALL_PFZ_COASTS: PfzCoast[] = pfzData.coasts;

// Map states for fast lookup
export const PFZ_STATES_BY_ID: Record<string, PfzState> = {};
INCOIS_PFZ_STATES.forEach((s) => {
  PFZ_STATES_BY_ID[s.id] = s;
});

// Map coasts for fast lookup
export const PFZ_COASTS_BY_ID: Record<string, PfzCoast> = {};
ALL_PFZ_COASTS.forEach((c) => {
  PFZ_COASTS_BY_ID[c.id] = c;
});

// Calculate distance in km
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find closest state based on coordinates or state name match
export function getActiveStateAndCoasts(
  lat: number,
  lon: number,
  locationName?: string
): { state: PfzState; coasts: PfzCoast[]; activeCoast?: PfzCoast } {
  // 1. Try finding by matching state name or coast name in locationName
  if (locationName) {
    const locLower = locationName.toLowerCase();
    for (const st of INCOIS_PFZ_STATES) {
      if (
        locLower.includes(st.name.toLowerCase()) ||
        locLower.includes(st.displayName.toLowerCase()) ||
        locLower.includes(st.id.replace('_', ' '))
      ) {
        // Find closest coast in this state
        let closestCoast = st.coasts[0];
        let minDist = Infinity;
        for (const c of st.coasts) {
          const d = haversineKm(lat, lon, c.lat, c.lon);
          if (d < minDist) {
            minDist = d;
            closestCoast = c;
          }
        }
        return { state: st, coasts: st.coasts, activeCoast: closestCoast };
      }
    }

    // Try finding by coast name
    for (const c of ALL_PFZ_COASTS) {
      if (locLower.includes(c.name.toLowerCase())) {
        const st = PFZ_STATES_BY_ID[c.stateId];
        if (st) {
          return { state: st, coasts: st.coasts, activeCoast: c };
        }
      }
    }
  }

  // 2. Fallback to nearest state by coordinates
  let nearestState = INCOIS_PFZ_STATES[0];
  let minStateDist = Infinity;
  let nearestCoast: PfzCoast | undefined = undefined;

  for (const st of INCOIS_PFZ_STATES) {
    for (const c of st.coasts) {
      const d = haversineKm(lat, lon, c.lat, c.lon);
      if (d < minStateDist) {
        minStateDist = d;
        nearestState = st;
        nearestCoast = c;
      }
    }
  }

  return {
    state: nearestState,
    coasts: nearestState.coasts,
    activeCoast: nearestCoast || nearestState.defaultPort,
  };
}
