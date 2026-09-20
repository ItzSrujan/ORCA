import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Database, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import type { LocationAssessment } from '../types';

interface DataSourcesTransparencyProps {
  assessment: LocationAssessment;
}

export const DataSourcesTransparency: React.FC<DataSourcesTransparencyProps> = ({
  assessment,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const sources = [
    {
      category: t('provenance.weather'),
      source: 'IMD (India Meteorological Dept) & Open-Meteo',
      status: 'LIVE DATA',
      statusType: 'live' as const,
      detail: 'Official coastal station telemetry & atmospheric observations',
    },
    {
      category: t('provenance.marine'),
      source: 'Open-Meteo Marine & ECMWF wave models',
      status: 'LIVE DATA',
      statusType: 'live' as const,
      detail: 'Real-time wave height & current telemetry',
    },
    {
      category: t('provenance.tide'),
      source: 'WorldTides (FES2022) & Port Stations',
      status: assessment.conditions.tideStatus === 'Unavailable' ? 'UNAVAILABLE DATA' : 'LIVE DATA',
      statusType: assessment.conditions.tideStatus === 'Unavailable' ? ('unavailable' as const) : ('live' as const),
      detail: assessment.conditions.tideStatus === 'Unavailable' ? 'Direct sensor offline for this harbor' : 'WorldTides live tidal forecast & extremes',
    },
    {
      category: t('provenance.fishingAdvisory'),
      source: 'INCOIS PFZ Prototype Feed',
      status: assessment.conditions.fishingAdvisoryAvailable ? 'FALLBACK DATA' : 'UNAVAILABLE DATA',
      statusType: assessment.conditions.fishingAdvisoryAvailable ? ('fallback' as const) : ('unavailable' as const),
      detail: 'INCOIS satellite chlorophyll reference dataset',
    },
  ];

  const getStatusBadge = (type: 'live' | 'fallback' | 'unavailable', label: string) => {
    switch (type) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {label}
          </span>
        );
      case 'fallback':
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            {label}
          </span>
        );
      case 'unavailable':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded bg-surface-200 text-surface-600 border border-surface-300">
            <HelpCircle className="w-3 h-3 text-surface-500" />
            {label}
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-surface-300 rounded-2xl overflow-hidden shadow-2xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-surface-200 flex items-center justify-center text-navy-700">
            <Database className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-navy-900">
            {t('provenance.title')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-surface-500 font-medium">
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-1 border-t border-surface-200 bg-surface-50/50 space-y-2.5 animate-in fade-in duration-150">
          <div className="divide-y divide-surface-200">
            {sources.map((src, i) => (
              <div key={i} className="py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-navy-900">
                    {src.category}
                  </div>
                  <div className="text-2xs text-surface-500">
                    {src.source} • {src.detail}
                  </div>
                </div>
                <div className="shrink-0">
                  {getStatusBadge(src.statusType, src.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
