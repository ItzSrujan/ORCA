import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react';
import type { LocationAssessment, SuggestedLocation } from '../types';
import {
  translateLocationName,
  translateTideStatus,
  translateUnit,
} from '../utils/locationTranslations';

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
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  if (!isOpen) return null;

  const currentCond = currentLocation.conditions;
  const suggestedCond = suggestedLocation.conditions;

  const rows = [
    {
      label: t('conditions.wind'),
      current: `${currentCond.windSpeedKmH} ${translateUnit('km/h', currentLang)}`,
      suggested: `${suggestedCond.windSpeedKmH} ${translateUnit('km/h', currentLang)}`,
      better: suggestedCond.windSpeedKmH < currentCond.windSpeedKmH,
    },
    {
      label: t('conditions.waves'),
      current: `${currentCond.waveHeightM} ${translateUnit('m', currentLang)}`,
      suggested: `${suggestedCond.waveHeightM} ${translateUnit('m', currentLang)}`,
      better: suggestedCond.waveHeightM < currentCond.waveHeightM,
    },
    {
      label: t('conditions.current'),
      current: `${currentCond.currentSpeedMs} ${translateUnit('m/s', currentLang)}`,
      suggested: `${suggestedCond.currentSpeedMs} ${translateUnit('m/s', currentLang)}`,
      better: suggestedCond.currentSpeedMs <= currentCond.currentSpeedMs,
    },
    {
      label: t('conditions.seaTemp'),
      current: `${currentCond.seaTemperatureC}°C`,
      suggested: `${suggestedCond.seaTemperatureC}°C`,
      better: false,
    },
    {
      label: t('conditions.tide'),
      current: translateTideStatus(currentCond.tideStatus, currentLang),
      suggested: translateTideStatus(suggestedCond.tideStatus, currentLang),
      better: false,
    },
    {
      label: t('conditions.fishingAdvisory'),
      current: currentCond.fishingAdvisoryAvailable ? t('conditions.advisoryAvailable') : t('conditions.advisoryUnavailable'),
      suggested: suggestedCond.fishingAdvisoryAvailable ? t('conditions.advisoryAvailable') : t('conditions.advisoryUnavailable'),
      better: suggestedCond.fishingAdvisoryAvailable,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040810]/85 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0B1322] w-full max-w-3xl rounded-xl shadow-2xl border border-slate-700/80 max-h-[90vh] flex flex-col my-auto text-left text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#070D18] rounded-t-xl">
          <div>
            <span className="text-2xs font-mono font-bold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded">
              {t('comparison.title')}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1.5 tracking-tight">
              {translateLocationName(currentLocation.name.split(',')[0], currentLang)}{' '}
              <span className="text-slate-500 font-normal">vs</span>{' '}
              {translateLocationName(suggestedLocation.name, currentLang)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            aria-label={t('comparison.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 font-sans text-xs">
          {/* Why is suggested location better banner */}
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-3.5 space-y-1">
            <div className="text-emerald-400 font-mono font-bold text-2xs uppercase tracking-wider">
              {t('comparison.whyBetterTitle')}
            </div>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed font-normal">
              "{suggestedLocation.reasonForSuggestion}"
            </p>
          </div>

          {/* Location Cards Header */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
            <div className="p-3 rounded-lg bg-[#060B14] border border-slate-800">
              <span className="text-2xs font-mono uppercase tracking-wider text-slate-400 block">
                {t('comparison.current')}
              </span>
              <span className="text-sm sm:text-base font-bold text-white truncate block mt-0.5">
                {currentLocation.name.split(',')[0]}
              </span>
              <span className="text-2xs font-mono text-amber-400 mt-1 block">
                {currentLocation.riskLevel}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-600/60">
              <span className="text-2xs font-mono uppercase tracking-wider text-emerald-400 block">
                {t('comparison.suggested')}
              </span>
              <span className="text-sm sm:text-base font-bold text-white truncate block mt-0.5">
                {suggestedLocation.name}
              </span>
              <span className="text-2xs font-mono text-emerald-300 font-semibold mt-1 block">
                {t('suggested.badge')} ({suggestedLocation.distanceKm} km)
              </span>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800/80 bg-[#060B14]">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-3 p-2.5 sm:p-3 text-xs items-center ${
                  row.highlight ? 'bg-[#0B1322] font-semibold text-white' : 'hover:bg-[#0A101C]'
                }`}
              >
                <div className="text-slate-300 font-medium">
                  {row.label}
                </div>

                <div className="text-center text-slate-400 font-mono">
                  {row.current}
                </div>

                <div className="text-center font-mono flex items-center justify-center gap-1.5">
                  <span className={row.better ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                    {row.suggested}
                  </span>
                  {row.better && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-[#070D18] shrink-0 flex items-center justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            {t('comparison.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
