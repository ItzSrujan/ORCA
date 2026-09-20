// ── ORCA Marine Decision Support Types ─────────────────────────

export type RiskLevel = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'INSUFFICIENT_DATA';

export type TideStatus = 'Rising' | 'Falling' | 'Unavailable';

export type ProvenanceStatus = 'live' | 'fallback' | 'unavailable';

export interface MarineCoordinates {
  latitude: number;
  longitude: number;
}

export interface ConditionMetric {
  value: number | string;
  unit?: string;
  label: string;
  statusText: string;
  statusType?: 'good' | 'moderate' | 'warning' | 'neutral';
}

export interface LocationConditions {
  windSpeedKmH: number;
  windDirection: string;
  windStatus: string;
  waveHeightM: number;
  wavePeriodS?: number;
  waveStatus: string;
  currentSpeedMs: number;
  currentStatus: string;
  seaTemperatureC: number;
  tideStatus: TideStatus;
  tideNote?: string;
  fishingAdvisoryAvailable: boolean;
  fishingAdvisoryZone?: string;
  fishingAdvisorySummary?: string;
}

export interface LocationAssessment {
  name: string;
  state?: string;
  coordinates: MarineCoordinates;
  lastUpdated: string;
  riskLevel: RiskLevel;
  riskHeadline: string;
  recommendation: string;
  reason: string;
  conditions: LocationConditions;
  isMissingData?: boolean;
}

export interface SuggestedLocation {
  available: boolean;
  name: string;
  coordinates: MarineCoordinates;
  distanceKm: number;
  riskLevel: RiskLevel;
  recommendation: string;
  reasonForSuggestion: string;
  conditions: LocationConditions;
}

export interface LocationComparisonData {
  current_location: LocationAssessment;
  suggested_location: SuggestedLocation;
}

export interface AnalysisChecklist {
  weatherChecked: boolean;
  marineChecked: boolean;
  tideChecked: boolean;
  advisoryChecked: boolean;
  riskCompleted: boolean;
}

export interface DataProvenanceItem {
  nameKey: string;
  category: string;
  source: string;
  status: ProvenanceStatus;
  updatedAt: string;
}

export interface AskOrcaQueryRequest {
  query: string;
  latitude?: number;
  longitude?: number;
  language?: string;
}

export interface AskOrcaResponse {
  query: string;
  answer: string;
  riskLevel?: RiskLevel;
  evidenceUsed: string[];
  recommendation?: string;
  errors?: string[];
  llmProvider?: string;
  llmModel?: string;
  isLlmActive?: boolean;
}

export interface CoastalPort {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}
