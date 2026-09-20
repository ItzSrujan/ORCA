import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, RotateCw, Navigation, Search, ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';
import type { LocationAssessment, RiskLevel } from '../types';

interface LocationSectionProps {
  assessment: LocationAssessment;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenSearch: () => void;
  permissionDenied: boolean;
  onAllowLocation: () => void;
}

const riskConfig: Record<string, { label: string; icon: React.ElementType; badgeBg: string; pulseColor: string }> = {
  SAFE: { label: 'SAFE TO PROCEED', icon: ShieldCheck, badgeBg: 'bg-emerald-600 text-white', pulseColor: 'bg-emerald-400' },
  CAUTION: { label: 'PROCEED WITH CAUTION', icon: AlertTriangle, badgeBg: 'bg-amber-500 text-white', pulseColor: 'bg-amber-400' },
  HIGH_RISK: { label: 'HIGH RISK', icon: AlertOctagon, badgeBg: 'bg-red-600 text-white', pulseColor: 'bg-red-400' },
  INSUFFICIENT_DATA: { label: 'INSUFFICIENT DATA', icon: HelpCircle, badgeBg: 'bg-slate-500 text-white', pulseColor: 'bg-slate-400' },
};

export const LocationSection: React.FC<LocationSectionProps> = ({
  assessment,
  isRefreshing,
  onRefresh,
  onOpenSearch,
  permissionDenied,
  onAllowLocation,
}) => {
  const { t } = useTranslation();
  const risk = riskConfig[assessment.riskLevel] || riskConfig.CAUTION;
  const RiskIcon = risk.icon;

  return (
    <div className="space-y-2.5">
      {/* Geolocation Notice if permission was denied */}
      {permissionDenied && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <Navigation className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug">
              {t('location.permissionPrompt')}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onAllowLocation}
              className="flex-1 sm:flex-initial text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              {t('location.allowAccess')}
            </button>
            <button
              onClick={onOpenSearch}
              className="flex-1 sm:flex-initial text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/50 transition-colors"
            >
              {t('location.searchLocation')}
            </button>
          </div>
        </div>
      )}

      {/* Merged Location + Risk Row */}
      <div className="bg-white border border-surface-300 rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Location info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-marine-100 flex items-center justify-center text-marine-600 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-navy-950 tracking-tight leading-tight truncate">
                {assessment.name}
              </h1>
              <p className="text-xs text-surface-500 font-mono">
                {assessment.coordinates.latitude.toFixed(4)}° N, {assessment.coordinates.longitude.toFixed(4)}° E
              </p>
            </div>
          </div>

          {/* Right: Risk badge + actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Inline Risk Badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase whitespace-nowrap ${risk.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${risk.pulseColor} animate-pulse`} />
              <RiskIcon className="w-3.5 h-3.5" />
              {risk.label}
            </span>

            {/* Last updated + Refresh */}
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-surface-500 hidden md:inline whitespace-nowrap">
                {assessment.lastUpdated}
              </span>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1.5 text-navy-700 hover:text-navy-950 hover:bg-surface-200 rounded-lg transition-colors disabled:opacity-50"
                title={t('nav.refresh')}
                aria-label={t('nav.refresh')}
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-marine-600' : ''}`} />
              </button>
            </div>

            {/* Search button */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-navy-800 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded-xl transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('location.searchLocation')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
