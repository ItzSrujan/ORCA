import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  RotateCw,
  Navigation,
  Search,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Wind,
  Waves,
  Clock,
  Anchor,
} from 'lucide-react';
import type { LocationAssessment } from '../types';

interface LocationSectionProps {
  assessment: LocationAssessment;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenSearch: () => void;
  permissionDenied: boolean;
  onAllowLocation: () => void;
  isLiveLocation?: boolean;
}

export const LocationSection: React.FC<LocationSectionProps> = ({
  assessment,
  isRefreshing,
  onRefresh,
  onOpenSearch,
  permissionDenied,
  onAllowLocation,
  isLiveLocation = false,
}) => {
  const { t } = useTranslation();

  const getRiskConfig = (level: string) => {
    switch (level) {
      case 'SAFE':
        return {
          label: t('risk.safe', 'SAFE TO PROCEED'),
          icon: ShieldCheck,
          badgeBg: 'bg-emerald-600 text-white shadow-emerald-500/20',
          pulseColor: 'bg-emerald-300',
          borderAccent: 'border-emerald-500/40',
          headlineColor: 'text-emerald-900',
        };
      case 'HIGH_RISK':
        return {
          label: t('risk.highRisk', 'HIGH RISK — STAY ASHORE'),
          icon: AlertOctagon,
          badgeBg: 'bg-rose-600 text-white shadow-rose-500/20',
          pulseColor: 'bg-rose-300',
          borderAccent: 'border-rose-500/40',
          headlineColor: 'text-rose-900',
        };
      case 'INSUFFICIENT_DATA':
        return {
          label: t('risk.insufficientData', 'INSUFFICIENT DATA'),
          icon: HelpCircle,
          badgeBg: 'bg-slate-600 text-white shadow-slate-500/20',
          pulseColor: 'bg-slate-300',
          borderAccent: 'border-slate-500/40',
          headlineColor: 'text-slate-900',
        };
      case 'CAUTION':
      default:
        return {
          label: t('risk.caution', 'PROCEED WITH CAUTION'),
          icon: AlertTriangle,
          badgeBg: 'bg-amber-500 text-white shadow-amber-500/20',
          pulseColor: 'bg-amber-200',
          borderAccent: 'border-amber-500/40',
          headlineColor: 'text-amber-900',
        };
    }
  };

  const risk = getRiskConfig(assessment.riskLevel);
  const RiskIcon = risk.icon;

  const lastUpdatedDisplay =
    assessment.lastUpdated?.toLowerCase().includes('just now')
      ? t('location.justNow', 'Just now')
      : assessment.lastUpdated;

  return (
    <div className="space-y-3">
      {/* Geolocation Notice if permission was denied */}
      {permissionDenied && (
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <Navigation className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <p className="text-xs text-amber-900 leading-snug">
              {t('location.permissionPrompt')}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onAllowLocation}
              className="flex-1 sm:flex-initial text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              {t('location.allowAccess')}
            </button>
            <button
              onClick={onOpenSearch}
              className="flex-1 sm:flex-initial text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              {t('location.searchLocation')}
            </button>
          </div>
        </div>
      )}

      {/* Modern Oceanic Command Hero Bar */}
      <div className="orca-glass-panel rounded-2xl p-3.5 sm:p-5 shadow-sm border border-surface-300/80 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Harbor Identity & Coordinates */}
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border ${
              isLiveLocation
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-700'
                : 'bg-marine-500/15 border-marine-400/40 text-marine-700'
            }`}>
              {isLiveLocation ? (
                <Navigation className="w-5 h-5 animate-pulse text-emerald-600" />
              ) : (
                <MapPin className="w-5 h-5 text-marine-600" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-extrabold text-navy-950 tracking-tight leading-tight truncate">
                  {assessment.name}
                </h1>
                {isLiveLocation && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/70 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t('location.liveGps', 'Live GPS')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 text-xs text-surface-500 mt-0.5 flex-wrap">
                <span className="font-mono bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200 text-navy-700 text-2xs">
                  {assessment.coordinates.latitude.toFixed(4)}° N, {assessment.coordinates.longitude.toFixed(4)}° E
                </span>
                <span className="flex items-center gap-1 text-2xs text-surface-400">
                  <Clock className="w-3 h-3 text-surface-400" />
                  {lastUpdatedDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Safety Sentinel Headline */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-surface-50/80 border border-surface-200/90 rounded-xl p-2.5 sm:px-4 sm:py-2.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase whitespace-nowrap shadow-xs ${risk.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${risk.pulseColor} animate-pulse`} />
              <RiskIcon className="w-4 h-4 shrink-0" />
              {risk.label}
            </span>

            <div className="min-w-0">
              <p className={`text-xs font-bold ${risk.headlineColor} truncate`}>
                {assessment.riskHeadline}
              </p>
              <p className="text-2xs text-navy-700 line-clamp-1">
                {assessment.reason}
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
            {/* Search Port Button */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-navy-900 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-navy-600" />
              <span>{t('location.searchLocation', 'Search Port')}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-navy-800 hover:text-navy-950 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title={t('nav.refresh')}
              aria-label={t('nav.refresh')}
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-marine-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Quick Telemetry Summary Bar */}
        <div className="mt-3.5 pt-3 border-t border-surface-200/70 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 border border-surface-200/60">
            <Wind className="w-3.5 h-3.5 text-navy-700 shrink-0" />
            <span className="text-2xs text-surface-500 font-medium">Wind:</span>
            <span className="font-bold text-navy-950">{assessment.conditions.windSpeedKmH} km/h</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 border border-surface-200/60">
            <Waves className="w-3.5 h-3.5 text-marine-600 shrink-0" />
            <span className="text-2xs text-surface-500 font-medium">Waves:</span>
            <span className="font-bold text-navy-950">{assessment.conditions.waveHeightM} m</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 border border-surface-200/60">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-2xs text-surface-500 font-medium">Tide:</span>
            <span className="font-bold text-navy-950 truncate">{assessment.conditions.tideStatus}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-50 border border-surface-200/60">
            <Anchor className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-2xs text-surface-500 font-medium">Safe Port:</span>
            <span className="font-bold text-navy-950 truncate max-w-[140px]" title={assessment.conditions.safestPortName || assessment.name}>
              {assessment.conditions.safestPortName
                ? assessment.conditions.safestPortName.split('(')[0].trim()
                : (assessment.conditions.nearestPortName ? assessment.conditions.nearestPortName.split(',')[0].trim() : assessment.name.split(',')[0].trim())}
            </span>
          </div>

          <div className="hidden md:flex items-center justify-end text-2xs text-surface-400 font-mono">
            <span>SST {assessment.conditions.seaTemperatureC}°C</span>
          </div>
        </div>
      </div>
    </div>
  );
};
