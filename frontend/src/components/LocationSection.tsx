import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RotateCw } from 'lucide-react';
import type { LocationAssessment } from '../types';
import {
  translateLocationName,
  translateStateName,
  translateTideStatus,
  translateUnit,
} from '../utils/locationTranslations';

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
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'SAFE':
        return {
          label: t('risk.safe', 'SAFE TO PROCEED'),
          badgeClass: 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300',
          dotClass: 'bg-emerald-400',
        };
      case 'HIGH_RISK':
        return {
          label: t('risk.highRisk', 'HIGH RISK — AVOID SEA'),
          badgeClass: 'bg-rose-950/70 border-rose-500/50 text-rose-300',
          dotClass: 'bg-rose-400',
        };
      case 'INSUFFICIENT_DATA':
        return {
          label: t('risk.insufficientData', 'INSUFFICIENT DATA'),
          badgeClass: 'bg-slate-900 border-slate-700 text-slate-300',
          dotClass: 'bg-slate-400',
        };
      case 'CAUTION':
      default:
        return {
          label: t('risk.caution', 'PROCEED WITH CAUTION'),
          badgeClass: 'bg-amber-950/70 border-amber-500/50 text-amber-300',
          dotClass: 'bg-amber-400',
        };
    }
  };

  const riskBadge = getRiskBadge(assessment.riskLevel);

  const lastUpdatedDisplay =
    assessment.lastUpdated?.toLowerCase().includes('just now')
      ? t('location.justNow', 'Just now')
      : assessment.lastUpdated;

  // Separate Harbor and State if formatted as "Harbor, State"
  const nameParts = assessment.name.split(',');
  const rawHarbor = nameParts[0]?.trim() || assessment.name;
  const rawState = nameParts[1]?.trim() || '';
  const displayHarbor = translateLocationName(rawHarbor, currentLang);
  const displayState = rawState ? translateStateName(rawState, currentLang) : '';

  const rawSafestPort = assessment.conditions.safestPortName
    ? assessment.conditions.safestPortName.split('(')[0].trim()
    : assessment.conditions.nearestPortName
    ? assessment.conditions.nearestPortName.split(',')[0].trim()
    : assessment.name.split(',')[0].trim();
  const translatedSafestPort = translateLocationName(rawSafestPort, currentLang);

  const translatedTide = translateTideStatus(assessment.conditions.tideStatus, currentLang);

  return (
    <div className="space-y-3">
      {/* Geolocation Notice if permission was denied */}
      {permissionDenied && (
        <div className="bg-amber-950/40 border border-amber-700/60 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <p className="text-amber-200 leading-snug">
            {t('location.permissionPrompt')}
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={onAllowLocation}
              className="flex-1 sm:flex-initial text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
            >
              {t('location.allowAccess')}
            </button>
            <button
              onClick={onOpenSearch}
              className="flex-1 sm:flex-initial text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-md bg-[#0A101C] border border-amber-600/60 text-amber-200 hover:bg-[#121E33] transition-colors cursor-pointer"
            >
              {t('location.searchLocation')}
            </button>
          </div>
        </div>
      )}

      {/* Main Operations Command Hero Card */}
      <div className="bg-[#0A111E] rounded-xl p-4 sm:p-5 border border-slate-800/90 transition-colors shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Location Identity & Coordinates */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight truncate">
                {displayHarbor}
              </h1>
              {displayState && (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="inline-flex items-center text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-[#070D18] hover:bg-[#111C2E] border border-slate-700/80 text-sky-300 hover:text-white transition-colors cursor-pointer"
                  title={`State: ${displayState} (Click to switch state)`}
                >
                  {displayState}
                </button>
              )}
              {isLiveLocation && (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {t('location.liveGps', 'LIVE GPS')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-400 mt-1.5 flex-wrap">
              <span className="font-mono bg-[#070D18] px-2.5 py-0.5 rounded border border-slate-800 text-sky-400 font-medium">
                {assessment.coordinates.latitude.toFixed(4)}°N, {assessment.coordinates.longitude.toFixed(4)}°E
              </span>
              <span className="font-mono text-slate-400">
                {lastUpdatedDisplay}
              </span>
            </div>
          </div>

          {/* Center: Operational Risk Status Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#060B14] border border-slate-800/90 rounded-lg p-2.5 sm:px-4 sm:py-2.5">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider uppercase border shrink-0 ${riskBadge.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full ${riskBadge.dotClass}`} />
              {riskBadge.label}
            </span>

            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                {assessment.riskHeadline}
              </p>
              <p className="text-xs text-slate-400 line-clamp-1">
                {assessment.reason}
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 bg-[#0E1726] hover:bg-[#142238] border border-slate-700/80 rounded-md transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span>{t('location.searchLocation', 'Search Port')}</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-300 hover:text-white bg-[#0E1726] hover:bg-[#142238] border border-slate-700/80 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title={t('nav.refresh')}
              aria-label={t('nav.refresh')}
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Quick Telemetry Summary Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3 text-xs">
          {/* Wind Card */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#060B14] border border-slate-800/80 flex flex-col justify-between">
            <div className="text-xs sm:text-sm uppercase font-mono font-semibold tracking-wider text-slate-400">
              {t('conditions.wind', 'Wind')}
            </div>
            <div className="font-mono font-bold text-white text-base sm:text-lg lg:text-xl mt-1 flex items-baseline gap-1">
              <span>{assessment.conditions.windSpeedKmH}</span>
              <span className="text-xs sm:text-sm font-normal text-slate-400 font-sans">
                {translateUnit('km/h', currentLang)}
              </span>
            </div>
          </div>

          {/* Waves Card */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#060B14] border border-slate-800/80 flex flex-col justify-between">
            <div className="text-xs sm:text-sm uppercase font-mono font-semibold tracking-wider text-slate-400">
              {t('conditions.waves', 'Waves')}
            </div>
            <div className="font-mono font-bold text-white text-base sm:text-lg lg:text-xl mt-1 flex items-baseline gap-1">
              <span>{assessment.conditions.waveHeightM}</span>
              <span className="text-xs sm:text-sm font-normal text-slate-400 font-sans">
                {translateUnit('m', currentLang)}
              </span>
            </div>
          </div>

          {/* Tide Card */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#060B14] border border-slate-800/80 flex flex-col justify-between">
            <div className="text-xs sm:text-sm uppercase font-mono font-semibold tracking-wider text-slate-400">
              {t('conditions.tide', 'Tide')}
            </div>
            <div className="font-mono font-bold text-white text-base sm:text-lg lg:text-xl mt-1 truncate">
              {translatedTide}
            </div>
          </div>

          {/* Safest Port Card */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-[#060B14] border border-slate-800/80 flex flex-col justify-between">
            <div className="text-xs sm:text-sm uppercase font-mono font-semibold tracking-wider text-slate-400">
              {t('conditions.safestPort', 'Safest Port')}
            </div>
            <div className="font-semibold text-slate-100 text-sm sm:text-base mt-1 truncate" title={translatedSafestPort}>
              {translatedSafestPort}
            </div>
          </div>

          {/* Sea Temp Card */}
          <div className="hidden md:flex flex-col justify-between p-2.5 sm:p-3 rounded-lg bg-[#060B14] border border-slate-800/80 font-mono">
            <div className="text-xs sm:text-sm uppercase font-semibold tracking-wider text-slate-400">
              {t('conditions.seaTemp', 'Sea Temp')}
            </div>
            <div className="font-mono font-bold text-white text-base sm:text-lg lg:text-xl mt-1">
              {assessment.conditions.seaTemperatureC}°C
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
