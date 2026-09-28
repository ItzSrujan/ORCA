import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wind,
  Waves,
  Navigation2,
  Thermometer,
  Clock,
  Anchor,
  Compass,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Info,
  ShieldCheck,
} from 'lucide-react';
import type { LocationConditions } from '../types';

interface ConditionsGridProps {
  conditions: LocationConditions;
}

export const ConditionsGrid: React.FC<ConditionsGridProps> = ({ conditions }) => {
  const { t } = useTranslation();
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
      ? conditions.tideStatus
      : t('conditions.tideUnavailable', 'Unavailable');

  const safestPortDisplay = conditions.safestPortName
    ? conditions.safestPortName.split('(')[0].trim()
    : conditions.nearestPortName
    ? conditions.nearestPortName.split(',')[0].trim()
    : conditions.fishingAdvisoryZone
    ? conditions.fishingAdvisoryZone.replace(/^Safe Port:\s*/i, '').split('(')[0].trim()
    : t('conditions.advisoryAvailable', 'Sheltered Harbor');

  const nearestPortDisplay = conditions.nearestPortName
    ? conditions.nearestPortName.split(',')[0].trim()
    : 'Local Port';

  const portDistanceDisplay = conditions.safestPortDistanceKm != null
    ? `${conditions.safestPortDistanceKm} km`
    : conditions.nearestPortDistanceKm != null
    ? `${conditions.nearestPortDistanceKm} km`
    : 'Sheltered';

  const translateStatus = (status?: string): string => {
    if (!status) return '';
    const s = status.toLowerCase().trim();
    if (s.includes('light breeze') || s === 'light') return t('conditions.statusLight', 'Light breeze');
    if (s.includes('moderate')) return t('conditions.statusModerate', 'Moderate');
    if (s.includes('rough')) return t('conditions.statusRough', 'Rough seas');
    if (s.includes('strong current') || s === 'strong') return t('conditions.statusStrong', 'Strong current');
    if (s.includes('normal flow') || s === 'normal') return t('conditions.statusNormal', 'Normal flow');
    if (s.includes('calm')) return t('conditions.statusCalm', 'Calm');
    if (s.includes('telemetry missing') || s.includes('missing')) return t('conditions.telemetryMissing', 'Telemetry missing');
    if (s.includes('normal cycle') || s.includes('cycle')) return t('conditions.normalCycle', 'Normal cycle');
    if (s === 'zone active' || s === 'active') return t('conditions.zoneActive', 'Zone Active');
    if (s.includes('no advisory')) return t('conditions.noAdvisory', 'No Advisory');
    return status;
  };

  // Visual Gauge calculations
  const windPct = Math.min(100, Math.round((conditions.windSpeedKmH / 40) * 100));
  const wavePct = Math.min(100, Math.round((conditions.waveHeightM / 3.0) * 100));
  const currentPct = Math.min(100, Math.round((conditions.currentSpeedMs / 1.5) * 100));

  const cards = [
    {
      id: 'wind',
      icon: Wind,
      title: t('conditions.wind', 'WIND'),
      modalTitle: 'Wind Velocity & Atmospheric Conditions',
      value: `${conditions.windSpeedKmH} km/h`,
      status: translateStatus(conditions.windStatus || (conditions.windSpeedKmH > 25 ? 'High wind' : 'Moderate')),
      detail: conditions.windDirection ? `Dir: ${conditions.windDirection}` : undefined,
      color: conditions.windSpeedKmH > 25 ? 'text-amber-500 bg-amber-500/10' : 'text-navy-700 bg-navy-100',
      gaugePct: windPct,
      gaugeColor: conditions.windSpeedKmH > 25 ? 'bg-amber-500' : 'bg-navy-600',
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
      icon: Waves,
      title: t('conditions.waves', 'WAVES'),
      modalTitle: 'Wave Dynamics & Swell State',
      value: `${conditions.waveHeightM} m`,
      status: translateStatus(conditions.waveStatus || (conditions.waveHeightM > 1.5 ? 'Rough seas' : 'Moderate')),
      detail: conditions.wavePeriodS ? `${conditions.wavePeriodS}s period` : undefined,
      color: conditions.waveHeightM > 1.5 ? 'text-amber-500 bg-amber-500/10' : 'text-marine-600 bg-marine-100',
      gaugePct: wavePct,
      gaugeColor: conditions.waveHeightM > 1.5 ? 'bg-amber-500' : 'bg-marine-600',
      subtext: conditions.waveHeightM <= 1.0 ? 'Calm for small boats' : conditions.waveHeightM <= 1.8 ? 'Moderate swell' : 'High swell caution',
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
          : 'Optimal sea state for nearshore gillnetting, longlining, and trawling operations.',
      source: 'ECMWF & NOAA Ocean Wave Spectral Forecasts',
    },
    {
      id: 'current',
      icon: Navigation2,
      title: t('conditions.current', 'CURRENT'),
      modalTitle: 'Ocean Drift & Hydrodynamic Currents',
      value: `${conditions.currentSpeedMs} m/s`,
      status: translateStatus(conditions.currentStatus || 'Normal flow'),
      detail: `${(conditions.currentSpeedMs * 1.944).toFixed(1)} kts`,
      color: conditions.currentSpeedMs > 1.0 ? 'text-amber-500 bg-amber-500/10' : 'text-teal-600 bg-teal-100',
      gaugePct: currentPct,
      gaugeColor: conditions.currentSpeedMs > 1.0 ? 'bg-amber-500' : 'bg-teal-600',
      subtext: conditions.currentSpeedMs < 0.8 ? 'Low drift driftage' : 'Moderate drift current',
      description: `Ocean surface drift speed is measured at ${conditions.currentSpeedMs} m/s (~${(
        conditions.currentSpeedMs * 1.944
      ).toFixed(1)} knots). ${
        conditions.currentSpeedMs > 1.0
          ? 'Strong oceanic current: significant vessel leeway drift. Factor in continuous counter-rudder and increased fuel consumption when steaming upstream against current.'
          : conditions.currentSpeedMs > 0.5
          ? 'Moderate current: steady tidal stream. Fishing nets will drift parallel to coastal contour lines; standard navigational allowance recommended.'
          : 'Low current: gentle hydrodynamic flow, ideal for stationary anchoring and bottom longlines.'
      }`,
      operationalTip:
        conditions.currentSpeedMs > 0.9
          ? 'Check GPS track regularly to counter unintended offshore drift while nets are deployed.'
          : 'Minimal drift effect on stationary set nets and crab/lobster traps.',
      source: 'Copernicus Marine Environment Monitoring Service (CMEMS)',
    },
    {
      id: 'seaTemp',
      icon: Thermometer,
      title: t('conditions.seaTemp', 'SEA TEMP'),
      modalTitle: 'Sea Surface Temperature & Marine Ecology',
      value: `${conditions.seaTemperatureC}°C`,
      status: t('conditions.statusWarm', 'Warm waters'),
      detail: 'SST Front',
      color: 'text-amber-600 bg-amber-100',
      gaugePct: Math.min(100, Math.round(((conditions.seaTemperatureC - 20) / 15) * 100)),
      gaugeColor: 'bg-amber-500',
      subtext: conditions.seaTemperatureC >= 28 ? 'Pelagic fish aggregation' : 'Standard coastal temp',
      description: `Sea Surface Temperature (SST) is currently ${conditions.seaTemperatureC}°C. ${
        conditions.seaTemperatureC >= 28
          ? 'Warm surface layer: thermal gradients and chlorophyll fronts promote pelagic fish concentration (such as mackerel, sardines, tuna, and seer fish) near thermal boundary zones.'
          : 'Temperate coastal waters: stable thermocline supporting mixed demersal feeding grounds and benthic species across continental shelf zones.'
      }`,
      operationalTip: 'Track thermal edges on the nautical map for higher baitfish and commercial school density.',
      source: 'INCOIS Satellite SST & MODIS Thermal Remote Sensing',
    },
    {
      id: 'tide',
      icon: Clock,
      title: t('conditions.tide', 'TIDE'),
      modalTitle: 'Tidal Cycle & Navigational Draft Clearance',
      value: tideLabel,
      status: translateStatus(conditions.tideNote || (conditions.tideStatus === 'Unavailable' ? 'Telemetry missing' : 'Normal cycle')),
      detail: undefined,
      color: conditions.tideStatus === 'Unavailable' ? 'text-surface-400 bg-surface-100' : 'text-indigo-600 bg-indigo-100',
      gaugePct: conditions.tideStatus === 'Rising' ? 75 : conditions.tideStatus === 'Falling' ? 35 : 50,
      gaugeColor: 'bg-indigo-600',
      subtext: conditions.tideStatus === 'Rising' ? 'Favorable navigational draft' : conditions.tideStatus === 'Falling' ? 'Shallow draft warning' : 'Normal cycle',
      description: `Tidal cycle status is currently "${tideLabel}"${
        conditions.tideNote ? ` with coastal observation: "${conditions.tideNote}"` : ''
      }. ${
        conditions.tideStatus === 'Rising'
          ? 'Rising (Flood) tide: water depth is progressively increasing across harbor basins, giving deeper keel clearance for departing and loaded returning crafts.'
          : conditions.tideStatus === 'Falling'
          ? 'Falling (Ebb) tide: water level is receding. Beware of submerged sandbars, shallow harbor entrance channels, and reduced under-keel clearance.'
          : 'Tidal cycle is within normal coastal parameters. Consult local tide tables for precise high/low water epoch timestamps.'
      }`,
      operationalTip:
        conditions.tideStatus === 'Falling'
          ? 'Exercise extreme caution over river bar mouths and shallow mooring jetties.'
          : 'Optimal navigational window for entering or leaving harbor with full catch load.',
      source: 'Survey of India Coastal Tide Gauges & Hydrographic Predictions',
    },
    {
      id: 'advisory',
      icon: Anchor,
      title: t('conditions.fishingAdvisory', 'PORT ADVISORY'),
      modalTitle: 'Port Advisory — Safest & Nearest Coastal Harbors',
      value: safestPortDisplay,
      status: `Nearest: ${nearestPortDisplay}`,
      detail: portDistanceDisplay,
      color: 'text-emerald-700 bg-emerald-100',
      gaugePct: 90,
      gaugeColor: 'bg-emerald-600',
      subtext: `🛡️ Safest: ${safestPortDisplay}`,
      description:
        conditions.fishingAdvisorySummary ||
        `Nearest coastal port is ${conditions.nearestPortName || nearestPortDisplay}${
          conditions.nearestPortDistanceKm != null ? ` (${conditions.nearestPortDistanceKm} km away)` : ''
        }. Safest sheltered harbor recommendation is ${conditions.safestPortName || safestPortDisplay}${
          conditions.safestPortDistanceKm != null ? ` (${conditions.safestPortDistanceKm} km away)` : ''
        }: ${
          conditions.safestPortReason ||
          'Natural coastal curvature provides lower swell and gentler wave breaking during adverse sea conditions.'
        }`,
      operationalTip:
        'In case of worsening swell or wind gusts, navigate towards the designated sheltered harbor coordinates.',
      source: conditions.fishingAdvisorySource || 'INCOIS Coastal Safety & Marine Ports Directory',
    },
  ];

  // Active modal card index & navigation
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
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xs font-extrabold uppercase tracking-wider text-navy-800 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-marine-600" />
          {t('conditions.title', 'REAL-TIME COASTAL TELEMETRY')}
        </h2>
        <span className="text-[11px] text-surface-400 font-medium hidden sm:inline">
          Continuous In-Situ & Satellite Marine Feeds
        </span>
      </div>

      {/* Grid of 6 Sleek Uniform Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
        {cards.map((c) => {
          const Icon = c.icon;

          return (
            <div
              key={c.id}
              className="orca-card bg-white border border-surface-200/90 hover:border-marine-400/50 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden group hover:shadow-md"
            >
              {/* Top indicator gauge bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-surface-100 group-hover:bg-marine-500/20 transition-colors">
                <div
                  className={`h-full ${c.gaugeColor} transition-all duration-500`}
                  style={{ width: `${c.gaugePct}%` }}
                />
              </div>

              <div>
                {/* Header with Title and Icon */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] sm:text-2xs font-bold uppercase tracking-wider text-surface-500">
                    {c.title}
                  </span>
                  <div className={`p-1.5 rounded-xl shrink-0 ${c.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Primary Metric Value */}
                <div className="mt-2.5">
                  <div className="text-lg sm:text-2xl font-extrabold text-navy-950 tracking-tight leading-none truncate">
                    {c.value}
                  </div>

                  {/* Status & Detail Badges */}
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-navy-800 truncate" title={c.status}>
                      {c.status}
                    </span>
                    {c.detail && (
                      <span className="text-[10px] text-surface-500 shrink-0 font-mono bg-surface-100 px-1 py-0.5 rounded border border-surface-200">
                        {c.detail}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom bar with Subtext & Clean Read More button */}
              <div className="mt-2.5 pt-2 border-t border-surface-100 flex flex-col gap-1.5">
                <div className="text-[10px] text-surface-400 font-medium truncate" title={c.subtext}>
                  {c.subtext}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMetricId(c.id)}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-marine-600 hover:text-marine-700 hover:bg-marine-50/70 py-1 px-1.5 rounded transition-colors group/btn"
                >
                  <span>{t('common.readMore', 'Read more')}</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal Dialog */}
      {activeModalCard && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setSelectedMetricId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-surface-200 max-w-xl w-full p-5 sm:p-6 relative overflow-hidden my-auto text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Gauge Color Strip */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${activeModalCard.gaugeColor}`} />

            {/* Navigation Tabs between metrics */}
            <div className="flex items-center justify-between gap-1 pb-3.5 mb-4 border-b border-surface-100 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1">
                {cards.map((card) => {
                  const isCurrent = card.id === activeModalCard.id;
                  const TabIcon = card.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setSelectedMetricId(card.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                        isCurrent
                          ? 'bg-navy-900 text-white shadow-xs'
                          : 'text-surface-600 hover:bg-surface-100 hover:text-navy-900'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      <span>{card.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedMetricId(null)}
                className="p-1.5 text-surface-400 hover:text-navy-900 rounded-lg hover:bg-surface-100 transition-colors ml-2"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${activeModalCard.color}`}>
                  <activeModalCard.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="modal-title" className="text-base sm:text-lg font-bold text-navy-950 leading-tight">
                    {activeModalCard.modalTitle}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-surface-600">
                      Status: <span className="text-navy-900 font-bold">{activeModalCard.status}</span>
                    </span>
                    {activeModalCard.detail && (
                      <span className="text-2xs font-mono bg-surface-100 text-surface-700 px-1.5 py-0.5 rounded border border-surface-200">
                        {activeModalCard.detail}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Reading Badge */}
              <div className="text-right shrink-0">
                <div className="text-2xl sm:text-3xl font-black text-navy-950 tracking-tight">
                  {activeModalCard.value}
                </div>
                <div className="text-[11px] font-medium text-surface-400 mt-0.5">
                  Live Reading
                </div>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="mt-5 space-y-4">
              {/* In-depth Analysis Section */}
              <div className="bg-surface-50/80 rounded-xl p-3.5 sm:p-4 border border-surface-100">
                <h4 className="text-2xs font-extrabold uppercase tracking-wider text-surface-500 flex items-center gap-1.5 mb-1.5">
                  <Info className="w-3.5 h-3.5 text-marine-600" />
                  DETAILED MARINE ANALYSIS
                </h4>
                <p className="text-xs sm:text-sm text-navy-900 leading-relaxed font-normal">
                  {activeModalCard.description}
                </p>
              </div>

              {/* Operational Advisory Callout */}
              <div className="bg-marine-50/70 border border-marine-200/80 rounded-xl p-3.5 sm:p-4">
                <h4 className="text-2xs font-extrabold uppercase tracking-wider text-marine-800 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-marine-700" />
                  OPERATIONAL SAFETY RECOMMENDATION
                </h4>
                <p className="text-xs sm:text-sm text-marine-950 font-medium leading-relaxed">
                  {activeModalCard.operationalTip}
                </p>
              </div>

              {/* Telemetry Provenance */}
              <div className="text-[11px] text-surface-400 flex items-center justify-between pt-1">
                <span>Source: {activeModalCard.source}</span>
                <span className="font-medium text-emerald-600">● Live Satellite & In-Situ Feeds</span>
              </div>
            </div>

            {/* Modal Footer with Previous / Next / Close */}
            <div className="mt-6 pt-4 border-t border-surface-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMetric}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-surface-200 text-navy-800 hover:bg-surface-50 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextMetric}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-surface-200 text-navy-800 hover:bg-surface-50 flex items-center gap-1 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMetricId(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-navy-900 text-white hover:bg-navy-800 transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

