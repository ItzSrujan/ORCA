import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { SuggestedLocation } from '../types';

interface SuggestedLocationCardProps {
  suggested: SuggestedLocation;
  onOpenComparison: () => void;
}

export const SuggestedLocationCard: React.FC<SuggestedLocationCardProps> = ({
  suggested,
  onOpenComparison,
}) => {
  const { t } = useTranslation();

  if (!suggested.available) {
    return (
      <div className="bg-surface-50 border border-surface-200 rounded-2xl p-4 text-center">
        <p className="text-xs text-surface-500">
          {t('suggested.noBetterFound')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300/60">
            {t('suggested.title')}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 bg-emerald-700 text-white text-2xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          {t('suggested.badge')}
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-navy-950 tracking-tight">
              {suggested.name}
            </h3>
            <span className="text-xs text-emerald-800 font-medium flex items-center gap-1">
              <Navigation className="w-3 h-3 text-emerald-600" />
              {t('suggested.distance', { distance: suggested.distanceKm })}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-navy-800 mt-1 leading-relaxed">
            "{suggested.reasonForSuggestion}"
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-emerald-900 font-medium">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Waves: {suggested.conditions.waveHeightM}m (vs current)
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Wind: {suggested.conditions.windSpeedKmH} km/h
            </span>
          </div>
        </div>

        <button
          onClick={onOpenComparison}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
        >
          <span>{t('suggested.viewComparison')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
