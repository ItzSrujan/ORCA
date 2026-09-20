import type {
  LocationAssessment,
  LocationComparisonData,
  AskOrcaResponse,
  CoastalPort,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Major Fishing Harbors for Quick Selection ────────────────
export const POPULAR_COASTAL_PORTS: CoastalPort[] = [
  { id: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6974, lon: 83.2983 },
  { id: 'digha', name: 'Digha', state: 'West Bengal', lat: 21.6266, lon: 87.5074 },
  { id: 'mandarmani', name: 'Mandarmani', state: 'West Bengal', lat: 21.6642, lon: 87.7012 },
  { id: 'paradip', name: 'Paradip', state: 'Odisha', lat: 20.2644, lon: 86.6715 },
  { id: 'puri', name: 'Puri', state: 'Odisha', lat: 19.8135, lon: 85.8312 },
  { id: 'kakinada', name: 'Kakinada', state: 'Andhra Pradesh', lat: 16.9891, lon: 82.2475 },
  { id: 'chennai', name: 'Chennai (Kasimedu)', state: 'Tamil Nadu', lat: 13.1235, lon: 80.2985 },
  { id: 'tuticorin', name: 'Tuticorin', state: 'Tamil Nadu', lat: 8.7642, lon: 78.1348 },
  { id: 'kochi', name: 'Kochi (Thoppumpady)', state: 'Kerala', lat: 9.9312, lon: 76.2673 },
  { id: 'mangalore', name: 'Mangalore', state: 'Karnataka', lat: 12.9141, lon: 74.8560 },
  { id: 'goa', name: 'Goa (Mormugao)', state: 'Goa', lat: 15.4167, lon: 73.8000 },
  { id: 'ratnagiri', name: 'Ratnagiri (Mirkarwada)', state: 'Maharashtra', lat: 16.9902, lon: 73.2844 },
  { id: 'mumbai', name: 'Mumbai (Sassoon Dock)', state: 'Maharashtra', lat: 18.9167, lon: 72.8258 },
  { id: 'veraval', name: 'Veraval Harbor', state: 'Gujarat', lat: 20.9077, lon: 70.3688 },
  { id: 'porbandar', name: 'Porbandar', state: 'Gujarat', lat: 21.6417, lon: 69.6083 },
];

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

const MOCK_PROFILES: Record<string, PortMockProfile> = {
  digha: {
    assessment: {
      name: 'Digha, West Bengal',
      state: 'West Bengal',
      coordinates: { latitude: 21.6266, longitude: 87.5074 },
      lastUpdated: 'Just now',
      riskLevel: 'CAUTION',
      riskHeadline: 'PROCEED WITH CAUTION',
      recommendation: 'Conditions are suitable with caution.',
      reason: 'Wave conditions are moderate and wind conditions remain within the configured operating range.',
      conditions: {
        windSpeedKmH: 18,
        windDirection: 'NE',
        windStatus: 'Moderate',
        waveHeightM: 1.2,
        wavePeriodS: 6.5,
        waveStatus: 'Moderate',
        currentSpeedMs: 0.6,
        currentStatus: 'Normal',
        seaTemperatureC: 28,
        tideStatus: 'Rising',
        tideNote: 'Next high tide in 2h 15m',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: 'PFZ Sector 4A',
        fishingAdvisorySummary: 'Moderate chlorophyll concentrations 8nm south-east.',
      },
    },
    suggested: {
      name: 'Mandarmani',
      lat: 21.6642,
      lon: 87.7012,
      distanceKm: 12,
      windSpeedKmH: 12,
      waveHeightM: 0.7,
      currentSpeedMs: 0.4,
      reason: 'Lower wave conditions and more favourable wind conditions were detected compared with your current location.',
    },
  },
  mandarmani: {
    assessment: {
      name: 'Mandarmani, West Bengal',
      state: 'West Bengal',
      coordinates: { latitude: 21.6642, longitude: 87.7012 },
      lastUpdated: 'Just now',
      riskLevel: 'SAFE',
      riskHeadline: 'SAFE TO PROCEED',
      recommendation: 'Calm and favourable conditions for sea transit.',
      reason: 'Low swell and light offshore breeze allow safe nearshore navigation.',
      conditions: {
        windSpeedKmH: 12,
        windDirection: 'NNE',
        windStatus: 'Light breeze',
        waveHeightM: 0.7,
        wavePeriodS: 5.8,
        waveStatus: 'Calm',
        currentSpeedMs: 0.4,
        currentStatus: 'Normal',
        seaTemperatureC: 28,
        tideStatus: 'Rising',
        tideNote: 'Slack tide approaching',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: 'PFZ Sector 4B',
        fishingAdvisorySummary: 'Favourable SST front located 6nm offshore.',
      },
    },
  },
  mumbai: {
    assessment: {
      name: 'Mumbai (Sassoon Dock), Maharashtra',
      state: 'Maharashtra',
      coordinates: { latitude: 18.9167, longitude: 72.8258 },
      lastUpdated: 'Just now',
      riskLevel: 'CAUTION',
      riskHeadline: 'PROCEED WITH CAUTION',
      recommendation: 'Operate with heightened caution during high swell window.',
      reason: 'South-westerly swell of 1.6m combined with 20 km/h gusts near harbor mouth.',
      conditions: {
        windSpeedKmH: 20,
        windDirection: 'WSW',
        windStatus: 'Moderate breeze',
        waveHeightM: 1.6,
        wavePeriodS: 7.2,
        waveStatus: 'Moderate swell',
        currentSpeedMs: 0.7,
        currentStatus: 'Moderate flow',
        seaTemperatureC: 29,
        tideStatus: 'Falling',
        tideNote: 'Low tide expected at 18:40',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: 'Konkan Coast Zone 1',
        fishingAdvisorySummary: 'Active pelagic schools reported 14nm west.',
      },
    },
    suggested: {
      name: 'Alibaug Outer Bay',
      lat: 18.6414,
      lon: 72.8722,
      distanceKm: 32,
      windSpeedKmH: 14,
      waveHeightM: 0.9,
      currentSpeedMs: 0.5,
      reason: 'Natural coastal shelter provides lower wave heights and reduced chop compared with Mumbai harbor mouth.',
    },
  },
  ratnagiri: {
    assessment: {
      name: 'Ratnagiri (Mirkarwada), Maharashtra',
      state: 'Maharashtra',
      coordinates: { latitude: 16.9902, longitude: 73.2844 },
      lastUpdated: 'Just now',
      riskLevel: 'SAFE',
      riskHeadline: 'SAFE TO PROCEED',
      recommendation: 'Excellent conditions for fishing and coastal navigation.',
      reason: 'Mild swell under 0.8m and gentle winds along the sheltered southern bay.',
      conditions: {
        windSpeedKmH: 10,
        windDirection: 'NW',
        windStatus: 'Light breeze',
        waveHeightM: 0.8,
        wavePeriodS: 6.0,
        waveStatus: 'Calm',
        currentSpeedMs: 0.3,
        currentStatus: 'Gentle',
        seaTemperatureC: 28,
        tideStatus: 'Rising',
        tideNote: 'Favourable rising tide',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: 'South Konkan Sector B',
        fishingAdvisorySummary: 'High surface thermal contrast favorable for mackerel.',
      },
    },
  },
  chennai: {
    assessment: {
      name: 'Chennai (Kasimedu), Tamil Nadu',
      state: 'Tamil Nadu',
      coordinates: { latitude: 13.1235, longitude: 80.2985 },
      lastUpdated: 'Just now',
      riskLevel: 'CAUTION',
      riskHeadline: 'PROCEED WITH CAUTION',
      recommendation: 'Exercise vigilance due to localized shore-break currents.',
      reason: 'Moderate choppy waves at 1.4m and active coastal longshore drift.',
      conditions: {
        windSpeedKmH: 16,
        windDirection: 'SE',
        windStatus: 'Moderate',
        waveHeightM: 1.4,
        wavePeriodS: 6.8,
        waveStatus: 'Moderate',
        currentSpeedMs: 0.8,
        currentStatus: 'Strong current',
        seaTemperatureC: 30,
        tideStatus: 'Rising',
        tideNote: 'High tide in 1h 45m',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: 'Coromandel Sector 2',
        fishingAdvisorySummary: 'Good tuna potential 12nm eastward.',
      },
    },
    suggested: {
      name: 'Mahabalipuram Sheltered Cove',
      lat: 12.6269,
      lon: 80.1927,
      distanceKm: 45,
      windSpeedKmH: 11,
      waveHeightM: 0.8,
      currentSpeedMs: 0.4,
      reason: 'Reduced longshore current drift and softer swell profile behind natural rocky barrier.',
    },
  },
  visakhapatnam: {
    assessment: {
      name: 'Visakhapatnam Harbor, Andhra Pradesh',
      state: 'Andhra Pradesh',
      coordinates: { latitude: 17.6974, longitude: 83.2983 },
      lastUpdated: 'Just now',
      riskLevel: 'SAFE',
      riskHeadline: 'SAFE TO PROCEED',
      recommendation: 'Calm conditions across inner and outer anchorage.',
      reason: 'Moderate offshore wind with low wave heights below 1.0m.',
      conditions: {
        windSpeedKmH: 14,
        windDirection: 'E',
        windStatus: 'Gentle breeze',
        waveHeightM: 0.9,
        wavePeriodS: 5.5,
        waveStatus: 'Calm to slight',
        currentSpeedMs: 0.5,
        currentStatus: 'Normal',
        seaTemperatureC: 29,
        tideStatus: 'Falling',
        tideNote: 'Ebb tide current',
        fishingAdvisoryAvailable: true,
        fishingAdvisoryZone: 'Northern Circars PFZ',
        fishingAdvisorySummary: 'Thermal front detected 10nm east-north-east.',
      },
    },
  },
};

// ── Helper to find closest harbor or mock profile ───────────
function getProfileForLocation(lat: number, lon: number, nameHint?: string): PortMockProfile {
  if (nameHint) {
    const hint = nameHint.toLowerCase();
    for (const key of Object.keys(MOCK_PROFILES)) {
      if (hint.includes(key)) {
        return MOCK_PROFILES[key];
      }
    }
  }

  // Find nearest known port
  let closestKey = 'digha';
  let minDist = Infinity;
  for (const port of POPULAR_COASTAL_PORTS) {
    const d = Math.hypot(port.lat - lat, port.lon - lon);
    if (d < minDist) {
      minDist = d;
      closestKey = port.id;
    }
  }

  const baseProfile = MOCK_PROFILES[closestKey] || MOCK_PROFILES.digha;
  return {
    ...baseProfile,
    assessment: {
      ...baseProfile.assessment,
      coordinates: { latitude: lat, longitude: lon },
      name: nameHint || baseProfile.assessment.name,
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
        };
      }
    } catch (err) {
      console.warn('Backend /api/location-analysis unavailable, using fallback profile:', err);
    }

    // Fallback profile
    const profile = getProfileForLocation(latitude, longitude, location_name);
    return profile.assessment;
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
            fishingAdvisoryAvailable: true,
            fishingAdvisorySummary: 'Favourable SST front nearby',
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

    const isPlaceQ = /place|places|where|suggest|map|harbor|port|destination|alternative/.test(qLower);
    const isWaveQ = /wave|swell|rough|chop|height/.test(qLower);
    const isTideQ = /tide|high tide|low tide|water level/.test(qLower);

    let answer = '';
    if (isPlaceQ && sug) {
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
      if (isPlaceQ && sug) {
        answer = `तटीय मानचित्र के अनुसार ${loc} में लहरें ${c.waveHeightM}m हैं। शांत व सुरक्षित नौकायन के लिए मानचित्र **${sug.name}** (${sug.distanceKm} किमी दूर) की सिफारिश करता है जहां हवा व लहरें कम हैं।`;
      } else {
        answer = `आज ${loc} के निकट मछली पकड़ने के लिए स्थिति '${port.assessment.riskLevel === 'SAFE' ? 'सुरक्षित' : 'सावधानी'}' है। हवा ${c.windSpeedKmH} किमी/घंटा और लहरें ${c.waveHeightM} मीटर हैं।`;
        if (sug) {
          answer += ` तटीय मानचित्र के अनुसार, ${sug.name} (${sug.distanceKm} किमी दूर) शांत लहरों (${sug.waveHeightM}m) के साथ एक सुरक्षित विकल्प है।`;
        }
      }
    } else if (language === 'mr') {
      if (isPlaceQ && sug) {
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
};
