import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
} from 'lucide-react';
import type { LocationConditions } from '../types';
import {
  translateLocationName,
  translateUnit,
  translateTelemetryStatus,
  translateTideStatus,
} from '../utils/locationTranslations';

interface ConditionsGridProps {
  conditions: LocationConditions;
}

export const ConditionsGrid: React.FC<ConditionsGridProps> = ({ conditions }) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMetricId(null);
      }
    };
    if (selectedMetricId) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMetricId]);

  const tideLabel =
    conditions.tideStatus === 'Rising'
      ? t('conditions.tideRising', 'Rising')
      : conditions.tideStatus === 'Falling'
      ? t('conditions.tideFalling', 'Falling')
      : conditions.tideStatus && conditions.tideStatus !== 'Unavailable'
      ? translateTideStatus(conditions.tideStatus, currentLang)
      : t('conditions.tideUnavailable', 'Unavailable');

  const rawSafestPortName = conditions.safestPortName
    ? conditions.safestPortName.split('(')[0].trim()
    : conditions.nearestPortName
    ? conditions.nearestPortName.split(',')[0].trim()
    : conditions.fishingAdvisoryZone
    ? conditions.fishingAdvisoryZone.replace(/^Safe Port:\s*/i, '').split('(')[0].trim()
    : t('conditions.advisoryAvailable', 'Sheltered Harbor');

  const safestPortDisplay = translateLocationName(rawSafestPortName, currentLang);

  const rawNearestPortName = conditions.nearestPortName
    ? conditions.nearestPortName.split(',')[0].trim()
    : 'Local Port';
  const nearestPortDisplay = translateLocationName(rawNearestPortName, currentLang);

  const portDistanceDisplay = conditions.safestPortDistanceKm != null
    ? `${conditions.safestPortDistanceKm} ${translateUnit('km', currentLang)}`
    : conditions.nearestPortDistanceKm != null
    ? `${conditions.nearestPortDistanceKm} ${translateUnit('km', currentLang)}`
    : translateTelemetryStatus('Sheltered', currentLang);

  const translateStatus = (status?: string): string => {
    if (!status) return '';
    return translateTelemetryStatus(status, currentLang);
  };

  // Visual Gauge calculations
  const windPct = Math.min(100, Math.round((conditions.windSpeedKmH / 40) * 100));
  const wavePct = Math.min(100, Math.round((conditions.waveHeightM / 3.0) * 100));
  const currentPct = Math.min(100, Math.round((conditions.currentSpeedMs / 1.5) * 100));

  const cards = [
    {
      id: 'wind',
      title: t('conditions.wind', 'WIND'),
      modalTitle: 'Wind Velocity & Atmospheric Conditions',
      value: `${conditions.windSpeedKmH} ${translateUnit('km/h', currentLang)}`,
      status: translateStatus(conditions.windStatus || (conditions.windSpeedKmH > 25 ? 'High wind' : 'Moderate')),
      detail: conditions.windDirection ? `Dir: ${conditions.windDirection}` : undefined,
      badgeClass: conditions.windSpeedKmH > 25 ? 'text-amber-400 bg-amber-950/60 border-amber-700/50' : 'text-slate-300 bg-slate-900 border-slate-700',
      gaugePct: windPct,
      gaugeColor: conditions.windSpeedKmH > 25 ? 'bg-amber-500' : 'bg-sky-500',
      subtext: conditions.windSpeedKmH > 25 ? 'Caution: Strong gusts' : 'Calm breeze',
      description: `Wind velocity is currently measured at ${conditions.windSpeedKmH} km/h${
        conditions.windDirection ? ` from direction ${conditions.windDirection}` : ''
      }. ${
        conditions.windSpeedKmH > 28
          ? 'Strong wind alert: whitecaps and choppy sea state likely. Small fishing crafts and non-motorized boats should avoid venturing beyond sheltered harbor perimeters.'
          : conditions.windSpeedKmH > 18
          ? 'Moderate coastal breeze: moderate surface chop present. Maintain steady throttle, secure loose gear on deck, and keep VHF marine radio active.'
          : 'Gentle to light breeze: favorable coastal sailing and fishing conditions across all boat classes.'
      }`,
      operationalTip:
        conditions.windSpeedKmH > 25
          ? 'Maintain sheltered routes along leeward headlands; secure loose rigging and deck cargo.'
          : 'Normal engine power and standard sea transit parameters apply.',
      source: 'Open-Meteo Marine Atmospheric Model & Coastal Telemetry',
    },
    {
      id: 'waves',
      title: t('conditions.waves', 'WAVES'),
      modalTitle: 'Wave Dynamics & Swell State',
      value: `${conditions.waveHeightM} ${translateUnit('m', currentLang)}`,
      status: translateStatus(conditions.waveStatus || (conditions.waveHeightM > 1.5 ? 'Rough seas' : 'Moderate')),
      detail: conditions.wavePeriodS ? `${conditions.wavePeriodS}s` : undefined,
      badgeClass: conditions.waveHeightM > 1.5 ? 'text-amber-400 bg-amber-950/60 border-amber-700/50' : 'text-sky-300 bg-sky-950/60 border-sky-700/50',
      gaugePct: wavePct,
      gaugeColor: conditions.waveHeightM > 1.5 ? 'bg-amber-500' : 'bg-sky-500',
      subtext: conditions.waveHeightM <= 1.0 ? 'Calm for small crafts' : conditions.waveHeightM <= 1.8 ? 'Moderate swell' : 'High swell caution',
      description: `Significant wave height is recorded at ${conditions.waveHeightM} meters${
        conditions.wavePeriodS ? ` with a dominant swell period of ${conditions.wavePeriodS} seconds` : ''
      }. ${
        conditions.waveHeightM > 2.0
          ? 'High swell warning: breaking surf at harbor entrances and shallow sandbars. High capsizing hazard for vessels under 12 meters.'
          : conditions.waveHeightM > 1.2
          ? 'Moderate sea swell: noticeable roll and pitch. Ensure nets, fuel drums, and catch crates are tightly lashed to deck cleats.'
          : 'Calm sea surface: smooth navigation and easy net casting across nearshore and offshore grounds.'
      }`,
      operationalTip:
        conditions.waveHeightM > 1.5
          ? 'Mandatory PFD life jackets on open decks; navigate oncoming swells at a 45-degree angle.'
          : 'Low risk of swell-induced instability in open coastal waters.',
      source: 'Open-Meteo High-Resolution Marine Wave Model',
    },
    {
      id: 'current',
      title: t('conditions.current', 'CURRENT'),
      modalTitle: 'Oceanic Current Dynamics & Drift',
      value: `${conditions.currentSpeedMs} ${translateUnit('m/s', currentLang)}`,
      status: translateStatus(conditions.currentStatus || 'Normal flow'),
      detail: currentLang === 'mr' ? 'पृष्ठभाग प्रवाह' : currentLang === 'hi' ? 'सतही बहाव' : 'Surface Drift',
      badgeClass: 'text-slate-300 bg-slate-900 border-slate-700',
      gaugePct: currentPct,
      gaugeColor: conditions.currentSpeedMs > 0.8 ? 'bg-amber-500' : 'bg-sky-500',
      subtext: conditions.currentSpeedMs > 0.7 ? 'Moderate coastal drift' : 'Normal flow rate',
      description: `Surface current velocity is estimated at ${conditions.currentSpeedMs} m/s (${(
        conditions.currentSpeedMs * 1.944
      ).toFixed(1)} knots). Current vectors influence fuel efficiency, drift trajectories during drift-netting, and anchoring holding capacity.`,
      operationalTip:
        conditions.currentSpeedMs > 0.7
          ? 'Compensate leeway angle when charting transit course; inspect anchor scope.'
          : 'Standard anchor scope (3:1) sufficient for soft holding ground.',
      source: 'Copernicus Marine In-Situ Near-Real-Time Observations',
    },
    {
      id: 'seaTemp',
      title: t('conditions.seaTemp', 'SEA TEMP'),
      modalTitle: 'Sea Surface Temperature (SST)',
      value: `${conditions.seaTemperatureC}°C`,
      status: `${(conditions.seaTemperatureC * 1.8 + 32).toFixed(1)}°F`,
      detail: currentLang === 'mr' ? 'पृष्ठभाग थर' : currentLang === 'hi' ? 'सतह स्तर' : 'Surface Layer',
      badgeClass: 'text-slate-300 bg-slate-900 border-slate-700',
      gaugePct: Math.min(100, Math.round(((conditions.seaTemperatureC - 20) / 15) * 100)),
      gaugeColor: 'bg-emerald-500',
      subtext: 'Optimal pelagic zone',
      description: `Sea surface temperature is currently ${conditions.seaTemperatureC}°C. In Indian coastal waters, temperatures between 27°C and 30°C align with high pelagic productivity, supporting sardine, mackerel, and anchovy feeding grounds.`,
      operationalTip:
        'Target temperature gradient boundaries (thermal fronts) visible on satellite imagery for optimal pelagic catch density.',
      source: 'Satellite Infrared Sea Surface Radiometer & Open-Meteo',
    },
    {
      id: 'tide',
      title: t('conditions.tide', 'TIDE'),
      modalTitle: 'Tidal Telemetry & Estuarine Water Level',
      value: tideLabel,
      status: translateStatus(conditions.tideNote || 'Normal cycle'),
      detail: translateTideStatus(conditions.tideStatus, currentLang),
      badgeClass: conditions.tideStatus === 'Rising' ? 'text-emerald-400 bg-emerald-950/60 border-emerald-700/50' : 'text-slate-300 bg-slate-900 border-slate-700',
      gaugePct: conditions.tideStatus === 'Rising' ? 75 : conditions.tideStatus === 'Falling' ? 25 : 50,
      gaugeColor: conditions.tideStatus === 'Rising' ? 'bg-emerald-500' : 'bg-slate-500',
      subtext: conditions.tideStatus === 'Rising' ? 'Flood tide: increasing depth' : 'Ebb tide: shallow shoals caution',
      description: `Tidal cycle status: ${tideLabel}. ${conditions.tideNote || 'Standard semidiurnal tidal oscillation.'} ${
        conditions.tideStatus === 'Rising'
          ? 'Rising tide offers favorable draft clearance over shallow harbor sandbars and estuary inlets.'
          : conditions.tideStatus === 'Falling'
          ? 'Falling tide exposes sandbars and shallow reefs. Vessels drawing greater than 1.5m should exercise caution in estuary approaches.'
          : 'Real-time tide gauge telemetry is unavailable for this specific GPS sector; consult local nautical tide tables.'
      }`,
      operationalTip:
        conditions.tideStatus === 'Falling'
          ? 'Verify minimum under-keel clearance before traversing river mouths and sandbars.'
          : 'Favorable draft window for harbor departure and docking operations.',
      source: 'WorldTides Global Coastal Harmonic Gauges & Hydrographic Surveys',
    },
    {
      id: 'fishingAdvisory',
      title: t('conditions.safestPort', 'SAFEST PORT'),
      modalTitle: 'Safe Harbor Recommendation & Coastal Telemetry',
      value: safestPortDisplay,
      status: `${portDistanceDisplay} ${currentLang === 'mr' ? 'अंतरावर' : currentLang === 'hi' ? 'दूर' : 'away'}`,
      detail: conditions.safestPortName ? translateTelemetryStatus('Sheltered', currentLang) : nearestPortDisplay,
      badgeClass: 'text-sky-300 bg-sky-950/60 border-sky-700/50',
      gaugePct: 90,
      gaugeColor: 'bg-sky-500',
      subtext: conditions.safestPortReason ? 'Natural sheltered bay' : 'INCOIS PFZ Port Directory',
      description: `Nearest port from current coordinates is ${nearestPortDisplay}${
        conditions.nearestPortDistanceKm != null ? ` (${conditions.nearestPortDistanceKm} km away)` : ''
      }. The safest sheltered port recommendation is ${safestPortDisplay}${
        conditions.safestPortDistanceKm != null ? ` (${conditions.safestPortDistanceKm} km away)` : ''
      }. ${
        conditions.safestPortReason
          ? `Navigation rationale: ${conditions.safestPortReason}`
          : 'Documented INCOIS PFZ landing harbor providing breakwater protection and calmer docking conditions.'
      }`,
      operationalTip:
        'If sea state deteriorates or offshore winds freshen, steer towards the sheltered harbor coordinates indicated on the chart.',
      source: 'INCOIS Marine Fishing Harbors & Coastal Bathymetry Directory',
    },
  ];

  const activeModalIndex = cards.findIndex((c) => c.id === selectedMetricId);
  const activeModalCard = activeModalIndex >= 0 ? cards[activeModalIndex] : null;

  const handleNextMetric = () => {
    if (activeModalIndex >= 0) {
      const nextIndex = (activeModalIndex + 1) % cards.length;
      setSelectedMetricId(cards[nextIndex].id);
    }
  };

  const handlePrevMetric = () => {
    if (activeModalIndex >= 0) {
      const prevIndex = (activeModalIndex - 1 + cards.length) % cards.length;
      setSelectedMetricId(cards[prevIndex].id);
    }
  };

  return (
    <div className="bg-[#0A111E] rounded-xl p-4 sm:p-5 border border-slate-800 space-y-3.5 transition-colors">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-300">
            {t('conditions.title', 'REAL-TIME COASTAL TELEMETRY')}
          </h2>
        </div>
        <span className="text-xs font-mono uppercase text-slate-500 hidden sm:inline">
          In-Situ Sensors & Satellite Observations
        </span>
      </div>

      {/* Grid of 6 Sleek Uniform Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {cards.map((c) => {
          return (
            <div
              key={c.id}
              className="bg-[#060B14] hover:bg-[#0C1424] border border-slate-800 hover:border-slate-700 rounded-lg p-3 sm:p-3.5 flex flex-col justify-between transition-colors relative overflow-hidden group"
            >
              {/* Top indicator gauge bar */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-800">
                <div
                  className={`h-full ${c.gaugeColor} transition-all duration-300`}
                  style={{ width: `${c.gaugePct}%` }}
                />
              </div>

              <div>
                {/* Metric Label */}
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-400">
                    {c.title}
                  </span>
                  {c.detail && (
                    <span className="text-xs font-mono text-slate-400 truncate max-w-[80px]" title={c.detail}>
                      {c.detail}
                    </span>
                  )}
                </div>

                {/* Primary Metric Value */}
                <div className="mt-2.5">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight leading-tight truncate">
                    {c.value}
                  </div>

                  {/* Status Pill */}
                  <div className="mt-2">
                    <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded border max-w-full truncate ${c.badgeClass}`} title={c.status}>
                      {c.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom bar with Subtext & Clean Read More button */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex flex-col gap-1.5">
                <div className="text-xs font-mono text-slate-400 truncate" title={c.subtext}>
                  {c.subtext}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMetricId(c.id)}
                  className="w-full flex items-center justify-between text-xs sm:text-sm font-medium text-sky-400 hover:text-sky-300 py-0.5 rounded transition-colors cursor-pointer group/btn"
                >
                  <span>{t('common.readMore', 'Analysis')}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal Dialog */}
      {activeModalCard && (
        <div
          className="fixed inset-0 z-50 bg-[#040810]/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedMetricId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="bg-[#0B1322] rounded-xl shadow-2xl border border-slate-700/80 max-w-xl w-full p-5 sm:p-6 relative overflow-hidden my-auto text-left text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Indicator Color Strip */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${activeModalCard.gaugeColor}`} />

            {/* Navigation Tabs between metrics */}
            <div className="flex items-center justify-between gap-1 pb-3 mb-4 border-b border-slate-800 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1">
                {cards.map((card) => {
                  const isCurrent = card.id === activeModalCard.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setSelectedMetricId(card.id)}
                      className={`px-2 py-1 rounded text-2xs font-mono font-medium transition-colors shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {card.title}
                    </button>
                  );
                })}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedMetricId(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-2 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Live Value */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 id="modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {activeModalCard.modalTitle}
                </h3>
                <span className="text-2xs font-mono text-slate-400">
                  Parameter: {activeModalCard.title}
                </span>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xl sm:text-2xl font-mono font-bold text-white">
                  {activeModalCard.value}
                </div>
                <span className={`inline-block text-2xs font-mono px-2 py-0.5 rounded border mt-1 ${activeModalCard.badgeClass}`}>
                  {activeModalCard.status}
                </span>
              </div>
            </div>

            {/* Deep Analysis Text */}
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed bg-[#060B14] p-3.5 rounded border border-slate-800">
              <p>{activeModalCard.description}</p>

              {/* Operational Guidance */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-2xs font-mono uppercase text-sky-400 font-semibold mb-1">
                  Tactical Navigation Directive:
                </div>
                <p className="text-slate-300">
                  {activeModalCard.operationalTip}
                </p>
              </div>
            </div>

            {/* Telemetry Source Information */}
            <div className="mt-3 flex items-center justify-between text-3xs font-mono text-slate-500 border-t border-slate-800/80 pt-3">
              <span>SOURCE: {activeModalCard.source}</span>
              <span className="text-emerald-400 font-medium">LIVE TELEMETRY</span>
            </div>

            {/* Modal Bottom Prev / Next Nav */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevMetric}
                className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleNextMetric}
                className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
