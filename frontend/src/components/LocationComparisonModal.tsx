import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { LocationAssessment, SuggestedLocation } from '../types';

interface LocationComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: LocationAssessment;
  suggestedLocation: SuggestedLocation;
}

export const LocationComparisonModal: React.FC<LocationComparisonModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  suggestedLocation,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const currentCond = currentLocation.conditions;
  const suggestedCond = suggestedLocation.conditions;

  const rows = [
    {
      label: t('conditions.wind'),
      current: `${currentCond.windSpeedKmH} km/h`,
      suggested: `${suggestedCond.windSpeedKmH} km/h`,
      better: suggestedCond.windSpeedKmH < currentCond.windSpeedKmH,
      sublabel: suggestedCond.windStatus,
    },
    {
      label: t('conditions.waves'),
      current: `${currentCond.waveHeightM} m`,
      suggested: `${suggestedCond.waveHeightM} m`,
      better: suggestedCond.waveHeightM < currentCond.waveHeightM,
      sublabel: suggestedCond.waveStatus,
    },
    {
      label: t('conditions.current'),
      current: `${currentCond.currentSpeedMs} m/s`,
      suggested: `${suggestedCond.currentSpeedMs} m/s`,
      better: suggestedCond.currentSpeedMs <= currentCond.currentSpeedMs,
      sublabel: suggestedCond.currentStatus,
    },
    {
      label: t('conditions.seaTemp'),
      current: `${currentCond.seaTemperatureC}°C`,
      suggested: `${suggestedCond.seaTemperatureC}°C`,
      better: false,
      sublabel: 'Warm',
    },
    {
      label: t('conditions.tide'),
      current: currentCond.tideStatus,
      suggested: suggestedCond.tideStatus,
      better: false,
      sublabel: undefined,
    },
    {
      label: t('conditions.fishingAdvisory'),
      current: currentCond.fishingAdvisoryAvailable ? t('conditions.advisoryAvailable') : t('conditions.advisoryUnavailable'),
      suggested: suggestedCond.fishingAdvisoryAvailable ? t('conditions.advisoryAvailable') : t('conditions.advisoryUnavailable'),
      better: suggestedCond.fishingAdvisoryAvailable,
      sublabel: suggestedCond.fishingAdvisorySummary,
    },
    {
      label: t('comparison.overallRisk'),
      current: currentLocation.riskLevel === 'SAFE' ? t('risk.safe') : t('risk.caution'),
      suggested: t('suggested.badge'),
      better: true,
      highlight: true,
    },
    {
      label: t('comparison.recommendation'),
      current: t('comparison.caution'),
      suggested: t('comparison.moreFavourable'),
      better: true,
      highlight: true,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-xl border border-surface-300 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-200 flex items-center justify-between shrink-0 bg-surface-50 rounded-t-3xl sm:rounded-t-2xl">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-marine-700 bg-marine-100 px-2 py-0.5 rounded">
              {t('comparison.title')}
            </span>
            <h2 className="text-lg font-bold text-navy-950 mt-1">
              {currentLocation.name.split(',')[0]} <span className="text-surface-400 font-normal">vs</span> {suggestedLocation.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-navy-950 hover:bg-surface-200 rounded-xl transition-colors"
            aria-label={t('comparison.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Why is suggested location better banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              {t('comparison.whyBetterTitle')}
            </div>
            <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
              "{suggestedLocation.reasonForSuggestion}"
            </p>
          </div>

          {/* Location Cards Header */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
            <div className="p-3 rounded-xl bg-surface-100 border border-surface-200">
              <span className="text-2xs font-bold uppercase tracking-wider text-surface-500 block">
                {t('comparison.current')}
              </span>
              <span className="text-sm sm:text-base font-bold text-navy-950 truncate block mt-0.5">
                {currentLocation.name.split(',')[0]}
              </span>
              <span className="inline-flex items-center gap-1 text-2xs text-amber-700 font-semibold mt-1">
                <AlertTriangle className="w-3 h-3" />
                {currentLocation.riskLevel}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300">
              <span className="text-2xs font-bold uppercase tracking-wider text-emerald-700 block">
                {t('comparison.suggested')}
              </span>
              <span className="text-sm sm:text-base font-bold text-navy-950 truncate block mt-0.5">
                {suggestedLocation.name}
              </span>
              <span className="inline-flex items-center gap-1 text-2xs text-emerald-800 font-bold mt-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {t('suggested.badge')} ({suggestedLocation.distanceKm} km)
              </span>
            </div>
          </div>

          {/* Comparison Table / Rows */}
          <div className="border border-surface-200 rounded-xl overflow-hidden divide-y divide-surface-200">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-3 p-2.5 sm:p-3 text-xs items-center ${row.highlight ? 'bg-surface-50 font-bold' : 'hover:bg-surface-50/50'
                  }`}
              >
                <div className="font-semibold text-navy-800">
                  {row.label}
                </div>

                <div className="text-center text-surface-600 font-mono">
                  {row.current}
                </div>

                <div className="text-center font-mono flex items-center justify-center gap-1">
                  <span className={row.better ? 'text-emerald-700 font-bold' : 'text-navy-900'}>
                    {row.suggested}
                  </span>
                  {row.better && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 inline" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-200 bg-surface-50 shrink-0 flex items-center justify-end rounded-b-3xl sm:rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs sm:text-sm font-semibold transition-colors"
          >
            {t('comparison.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
