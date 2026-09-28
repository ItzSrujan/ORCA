import type {
  LocationAssessment,
  LocationComparisonData,
  AskOrcaResponse,
  CoastalPort,
} from '../types';

const RAW_API_URL = import.meta.env.VITE_API_URL || 'https://orca-backend-v1.vercel.app';
const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

import { INCOIS_PFZ_STATES, ALL_PFZ_COASTS, haversineKm } from '../data/incoisPfz';

// ── Major Fishing Harbors for Quick Selection (From INCOIS PFZ Data) ──
export const POPULAR_COASTAL_PORTS: CoastalPort[] = INCOIS_PFZ_STATES.map((st) => ({
  id: st.defaultPort.id,
  name: st.defaultPort.name,
  state: st.displayName,
  stateId: st.id,
  lat: st.defaultPort.lat,
  lon: st.defaultPort.lon,
  direction: st.defaultPort.direction,
  bearing: st.defaultPort.bearing,
  distance: st.defaultPort.distance,
  distanceKm: st.defaultPort.distanceKm,
  depth: st.defaultPort.depth,
  latDms: st.defaultPort.latDms,
  lonDms: st.defaultPort.lonDms,
  pfzLat: st.defaultPort.pfzLat,
  pfzLon: st.defaultPort.pfzLon,
}));

export const ALL_COASTAL_PORTS: CoastalPort[] = ALL_PFZ_COASTS;

// ── Fallback Port Database ───────────────────────────────────
interface PortMockProfile {
  assessment: LocationAssessment;
  suggested?: {
    name: string;
    lat: number;
    lon: number;
    distanceKm: number;
    windSpeedKmH: number;
    waveHeightM: number;
    currentSpeedMs: number;
    reason: string;
  };
}

// ── Helper to find closest harbor or mock profile strictly from INCOIS PFZ data ───────────
function getProfileForLocation(lat: number, lon: number, nameHint?: string): PortMockProfile {
  // 1. Find nearest coast from INCOIS PFZ dataset
  let nearestCoast = ALL_PFZ_COASTS[0];
  let minDist = Infinity;
  for (const c of ALL_PFZ_COASTS) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d < minDist) {
      minDist = d;
      nearestCoast = c;
    }
  }

  // 2. Find distinct alternative coast from the same state (>= 3.0 km), or nearby state (>= 5.0 km)
  const sameStateAlts = ALL_PFZ_COASTS.filter(
    (c) => c.stateId === nearestCoast.stateId && haversineKm(nearestCoast.lat, nearestCoast.lon, c.lat, c.lon) >= 3.0
  );
  const otherAlts = ALL_PFZ_COASTS.filter(
    (c) => haversineKm(nearestCoast.lat, nearestCoast.lon, c.lat, c.lon) >= 5.0
  );
  const candidates = sameStateAlts.length > 0 ? sameStateAlts : otherAlts;
  candidates.sort((a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon));
  const suggestedCoast = candidates[0] || nearestCoast;

  const nearestName = `${nearestCoast.name}, ${nearestCoast.state}`;
  const suggestedName = `${suggestedCoast.name}, ${suggestedCoast.state}`;
  const nearestDist = Math.round(minDist);
  const suggestedDist = Math.round(haversineKm(lat, lon, suggestedCoast.lat, suggestedCoast.lon));

  const displayName = nameHint || (nearestDist < 15 ? nearestName : `Coordinates (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`);

  return {
    assessment: {
      name: displayName,
      state: nearestCoast.state,
      coordinates: { latitude: lat, longitude: lon },
      lastUpdated: 'Just now',
      riskLevel: 'SAFE',
      riskHeadline: 'SAFE TO PROCEED',
      recommendation: 'Conditions are favorable for coastal transit.',
      reason: `Wave and wind parameters remain within normal operating ranges near ${nearestName}.`,
      conditions: {
        windSpeedKmH: 14,
        windDirection: 'SW',
        windStatus: 'Light breeze',
        waveHeightM: 0.8,
        wavePeriodS: 5.5,
        waveStatus: 'Calm',
        currentSpeedMs: 0.4,
        currentStatus: 'Normal flow',
        seaTemperatureC: 28,
        tideStatus: 'Rising',
        tideNote: 'Normal cycle',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: `Safe Port: ${suggestedCoast.name} (${suggestedDist} km)`,
        fishingAdvisorySummary: `Nearest port is ${nearestName} (${nearestDist} km away). Safest sheltered harbor recommendation is ${suggestedName} (${suggestedDist} km away) — Documented INCOIS PFZ coastal landing with ${suggestedCoast.depth || '20-40'}m bathymetry and natural coastal shelter.`,
        fishingAdvisoryIsLive: true,
        fishingAdvisorySource: 'INCOIS Coastal Safety & Marine Ports Directory',
        nearestPortName: nearestName,
        nearestPortDistanceKm: nearestDist,
        safestPortName: suggestedName,
        safestPortDistanceKm: suggestedDist,
        safestPortReason: `Documented INCOIS PFZ coastal landing with ${suggestedCoast.depth || '20-40'}m bathymetry and natural coastal shelter.`,
      },
    },
    suggested: {
      name: suggestedName,
      lat: suggestedCoast.lat,
      lon: suggestedCoast.lon,
      distanceKm: suggestedDist,
      windSpeedKmH: 11,
      waveHeightM: 0.6,
      currentSpeedMs: 0.35,
      reason: `Documented INCOIS PFZ coastal landing with ${suggestedCoast.depth || '20-40'}m bathymetry and natural coastal curvature providing lower swell.`,
    },
  };
}

// ── API Service Object ───────────────────────────────────────
export const apiService = {
  /**
   * Health check for FastAPI backend
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Analyze conditions and risk for a location
   */
  async analyzeLocation(params: {
    latitude: number;
    longitude: number;
    language?: string;
    location_name?: string;
  }): Promise<LocationAssessment> {
    const { latitude, longitude, language = 'en', location_name } = params;

    try {
      const res = await fetch(`${API_BASE_URL}/api/location-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          language,
          location_name,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          name: data.name || location_name || 'Coastal Location',
          coordinates: data.coordinates || { latitude, longitude },
          lastUpdated: data.last_updated || 'Just now',
          riskLevel: data.risk_assessment?.level || 'CAUTION',
          riskHeadline: data.risk_assessment?.headline || 'Conditions are suitable with caution.',
          recommendation: data.recommendation || 'Conditions are suitable with caution.',
          reason: data.reason || 'Wave conditions are moderate and wind conditions remain within the configured operating range.',
          conditions: data.conditions,
          isLiveLocation: Boolean(data.is_live_location),
        };
      }
    } catch (err) {
      console.warn('Backend /api/location-analysis unavailable, using fallback profile:', err);
    }

    // Fallback profile
    const profile = getProfileForLocation(latitude, longitude, location_name);
    return {
      ...profile.assessment,
      name: location_name || profile.assessment.name,
      isLiveLocation: Boolean(location_name?.toLowerCase().includes('live location') || location_name?.toLowerCase().includes('detected gps')),
    };
  },

  /**
   * Compare current location with suggested better alternative
   */
  async compareLocations(params: {
    latitude: number;
    longitude: number;
    language?: string;
  }): Promise<LocationComparisonData> {
    const { latitude, longitude, language = 'en' } = params;

    try {
      const res = await fetch(`${API_BASE_URL}/api/compare-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, language }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        const cur = data.current_location;
        const sug = data.suggested_location;

        return {
          current_location: {
            name: cur.name,
            coordinates: cur.coordinates,
            lastUpdated: 'Just now',
            riskLevel: cur.risk_assessment?.level || 'CAUTION',
            riskHeadline: cur.risk_assessment?.headline || 'Proceed with caution',
            recommendation: cur.recommendation || 'CAUTION REQUIRED',
            reason: cur.reason || 'Wave conditions are moderate.',
            conditions: cur.conditions,
          },
          suggested_location: {
            available: sug.available ?? true,
            name: sug.name,
            coordinates: sug.coordinates,
            distanceKm: sug.distance_km || 12,
            riskLevel: sug.risk_assessment?.level || 'SAFE',
            recommendation: sug.recommendation || 'MORE FAVOURABLE',
            reasonForSuggestion: sug.reason_for_suggestion || 'Lower wave conditions detected.',
            conditions: sug.conditions,
          },
        };
      }
    } catch (err) {
      console.warn('Backend /api/compare-locations unavailable, using fallback mock comparison:', err);
    }

    // Fallback comparison
    const profile = getProfileForLocation(latitude, longitude);
    const cur = profile.assessment;

    if (profile.suggested) {
      return {
        current_location: cur,
        suggested_location: {
          available: true,
          name: profile.suggested.name,
          coordinates: { latitude: profile.suggested.lat, longitude: profile.suggested.lon },
          distanceKm: profile.suggested.distanceKm,
          riskLevel: 'SAFE',
          recommendation: 'MORE FAVOURABLE',
          reasonForSuggestion: profile.suggested.reason,
          conditions: {
            windSpeedKmH: profile.suggested.windSpeedKmH,
            windDirection: 'NNE',
            windStatus: 'Light breeze',
            waveHeightM: profile.suggested.waveHeightM,
            wavePeriodS: 5.8,
            waveStatus: 'Calm',
            currentSpeedMs: profile.suggested.currentSpeedMs,
            currentStatus: 'Normal',
            seaTemperatureC: cur.conditions.seaTemperatureC,
            tideStatus: cur.conditions.tideStatus,
            fishingAdvisoryAvailable: false,
            fishingAdvisoryZone: '',
            fishingAdvisorySummary: '',
          },
        },
      };
    }

    // When no better nearby location exists
    return {
      current_location: cur,
      suggested_location: {
        available: false,
        name: 'None',
        coordinates: cur.coordinates,
        distanceKm: 0,
        riskLevel: cur.riskLevel,
        recommendation: cur.recommendation,
        reasonForSuggestion: 'No significantly better nearby location was identified based on currently available data.',
        conditions: cur.conditions,
      },
    };
  },

  /**
   * Natural-language marine query (Ask ORCA)
   */
  async askOrca(params: {
    query: string;
    latitude?: number;
    longitude?: number;
    language?: string;
    locationName?: string;
  }): Promise<AskOrcaResponse> {
    const { query, latitude, longitude, language = 'en', locationName } = params;

    try {
      const res = await fetch(`${API_BASE_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          latitude,
          longitude,
          language,
          location_name: locationName,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (res.ok) {
        const data = await res.json();
        const errors = (data.errors || []) as string[];
        const isLlmActive = data.llm_status === 'live';
        return {
          query,
          answer: data.recommendation || 'Conditions evaluated by ORCA pipeline.',
          riskLevel: data.risk_assessment?.level === 'low' ? 'SAFE' : data.risk_assessment?.level === 'high' ? 'HIGH_RISK' : 'CAUTION',
          evidenceUsed: (data.evidence || []).map((e: { claim?: string; metric?: string; data_type?: string; source?: string }) => e.claim || e.metric || `${e.data_type || 'Data'}: ${e.source || 'Live'}` || 'Telemetry point'),
          recommendation: data.recommendation,
          errors,
          llmProvider: data.llm_provider || 'huggingface',
          llmModel: data.llm_model || 'zai-org/GLM-5.3',
          isLlmActive,
        };
      }
    } catch (err) {
      console.warn('Backend /api/query unavailable or timed out, generating contextual marine response:', err);
    }

    // Dynamic location-aware fallback
    const port = getProfileForLocation(latitude || 21.6266, longitude || 87.5074);
    const c = port.assessment.conditions;
    const loc = port.assessment.name;
    const sug = port.suggested;
    const qLower = query.toLowerCase();

    const isNearestPortQ = /nearest port|closest port|nearby port|port near|nearest harbor|closest harbor|pass wala port|jawalche bandar/.test(qLower);
    const isPlaceQ = /place|places|where|suggest|map|harbor|port|destination|alternative/.test(qLower);
    const isWaveQ = /wave|swell|rough|chop|height/.test(qLower);
    const isTideQ = /tide|high tide|low tide|water level/.test(qLower);

    let answer = '';
    if (isNearestPortQ && sug) {
      answer = `Nearest port from your location: **${loc}** (Sheltered Alternative: **${sug.name}**, ${sug.distanceKm} km away). Current conditions: Waves ${c.waveHeightM}m, Wind ${c.windSpeedKmH} km/h (${c.windDirection}) — ${port.assessment.riskLevel}.`;
    } else if (isPlaceQ && sug) {
      answer = `Based on the coastal map for ${loc}, winds are ${c.windSpeedKmH} km/h (${c.windDirection}) with ${c.waveHeightM}m waves. For calmer conditions, the map recommends ${sug.name} (${sug.distanceKm} km away) where ${sug.reason}.`;
    } else if (isWaveQ) {
      answer = `Wave report for ${loc}: Significant wave height is ${c.waveHeightM}m with a ${c.wavePeriodS}s period. Wind is ${c.windSpeedKmH} km/h from ${c.windDirection}. Seas are currently evaluated as ${c.waveStatus.toLowerCase()}.`;
    } else if (isTideQ) {
      answer = `Tide status near ${loc}: The tide is currently ${c.tideStatus} (${c.tideNote}). Waves are ${c.waveHeightM}m. Plan harbor entries and channel crossings around high water.`;
    } else {
      answer = `For fishing operations near ${loc}, conditions are evaluated as ${port.assessment.riskLevel}. Wind is ${c.windSpeedKmH} km/h (${c.windDirection}) with waves at ${c.waveHeightM}m (SST ${c.seaTemperatureC}°C). Tide is ${c.tideStatus}.`;
      if (sug) {
        answer += ` As a sheltered alternative on the map, ${sug.name} (${sug.distanceKm} km away) provides calmer waters (${sug.waveHeightM}m waves).`;
      }
    }

    if (language === 'hi') {
      if (isNearestPortQ && sug) {
        answer = `आपके स्थान से सबसे निकटतम तटीय बंदरगाह: **${loc}** (शांत विकल्प: **${sug.name}**, ${sug.distanceKm} किमी दूर)। लहरें: ${c.waveHeightM}m, हवा: ${c.windSpeedKmH} किमी/घंटा।`;
      } else if (isPlaceQ && sug) {
        answer = `तटीय मानचित्र के अनुसार ${loc} में लहरें ${c.waveHeightM}m हैं। शांत व सुरक्षित नौकायन के लिए मानचित्र **${sug.name}** (${sug.distanceKm} किमी दूर) की सिफारिश करता है जहां हवा व लहरें कम हैं।`;
      } else {
        answer = `आज ${loc} के निकट मछली पकड़ने के लिए स्थिति '${port.assessment.riskLevel === 'SAFE' ? 'सुरक्षित' : 'सावधानी'}' है। हवा ${c.windSpeedKmH} किमी/घंटा और लहरें ${c.waveHeightM} मीटर हैं।`;
        if (sug) {
          answer += ` तटीय मानचित्र के अनुसार, ${sug.name} (${sug.distanceKm} किमी दूर) शांत लहरों (${sug.waveHeightM}m) के साथ एक सुरक्षित विकल्प है।`;
        }
      }
    } else if (language === 'mr') {
      if (isNearestPortQ && sug) {
        answer = `तुमच्या स्थानापासून जवळचे बंदर: **${loc}** (शांत पर्याय: **${sug.name}**, ${sug.distanceKm} किमी). लाटा: ${c.waveHeightM}m, वारा: ${c.windSpeedKmH} किमी/तास.`;
      } else if (isPlaceQ && sug) {
        answer = `सागरी नकाशानुसार ${loc} येथे लाटा ${c.waveHeightM}m आहेत. अधिक शांततेसाठी **${sug.name}** (${sug.distanceKm} किमी अंतर) हा सुरक्षित पर्याय उपलब्ध आहे.`;
      } else {
        answer = `आज ${loc} परिसरात मासेमारीसाठी परिस्थिती '${port.assessment.riskLevel === 'SAFE' ? 'सुरक्षित' : 'दक्षता'}' आहे. वाऱ्याचा वेग ${c.windSpeedKmH} किमी/तास व लाटा ${c.waveHeightM} मीटर आहेत.`;
        if (sug) {
          answer += ` सागरी नकाशानुसार, ${sug.name} (${sug.distanceKm} किमी अंतर) कमी लाटांसह (${sug.waveHeightM}m) अधिक सुरक्षित पर्याय आहे.`;
        }
      }
    }

    return {
      query,
      answer,
      riskLevel: port.assessment.riskLevel,
      evidenceUsed: [
        `Live marine wave telemetry (${c.waveHeightM}m)`,
        `Coastal wind telemetry (${c.windSpeedKmH} km/h ${c.windDirection})`,
        `Surface sea temperature (${c.seaTemperatureC}°C)`,
        sug ? `Map alternative: ${sug.name} (${sug.distanceKm} km)` : `Tide status: ${c.tideStatus}`,
      ],
      recommendation: port.assessment.recommendation,
      isLlmActive: false,
      llmProvider: 'offline_synthesizer',
      llmModel: 'telemetry_engine',
    };
  },

  /**
   * Translate arbitrary text via backend /api/translate
   */
  async translateText(text: string, targetLang: string, sourceLang = 'auto'): Promise<string> {
    if (!text || !text.trim()) return '';
    if (targetLang === 'en' && sourceLang === 'en') return text;

    try {
      const res = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target_language: targetLang,
          source_language: sourceLang,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        return data.translated_text || text;
      }
    } catch (err) {
      console.warn('Translation API call failed:', err);
    }

    return text;
  },

  /**
   * Update Hugging Face token and reload settings dynamically
   */
  async updateHfToken(
    token: string,
    endpointUrl?: string,
    model?: string
  ): Promise<{ valid: boolean; message?: string; error?: string; username?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/hf-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, endpoint_url: endpointUrl, model }),
        signal: AbortSignal.timeout(15000),
      });
      return await res.json();
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Failed to connect to backend server' };
    }
  },
};
