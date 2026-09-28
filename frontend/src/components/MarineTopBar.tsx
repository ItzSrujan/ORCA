import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Anchor, MapPin, Globe, ChevronDown, Navigation, RotateCw, Radio, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CoastalPort } from '../types';

interface MarineTopBarProps {
  currentLocationName?: string;
  onOpenLocationPicker: () => void;
  ports?: CoastalPort[];
  selectedPortId?: string;
  onSelectPort?: (port: CoastalPort) => void;
  onRequestGeolocation?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isLiveLocation?: boolean;
}

export const MarineTopBar: React.FC<MarineTopBarProps> = ({
  currentLocationName,
  onOpenLocationPicker,
  ports = [],
  selectedPortId,
  onSelectPort,
  onRequestGeolocation,
  onRefresh,
  isRefreshing = false,
  isLiveLocation = false,
}) => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem('orca_language', lang);
    } catch {
      // ignore
    }
  };

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
  const statesStripRef = useRef<HTMLDivElement>(null);

  const scrollStatesStrip = (direction: 'left' | 'right') => {
    if (statesStripRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      statesStripRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-navy-950/95 backdrop-blur-md text-white border-b border-navy-800/80 shadow-md w-full transition-all">
      {/* 1. Main Navigation Row */}
      <div className="w-full px-3 sm:px-5 lg:px-8 py-2.5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-marine-500/30 to-teal-500/20 border border-marine-400/40 flex items-center justify-center text-marine-300 shadow-inner shrink-0">
            <Anchor className="w-4 h-4 sm:w-5 sm:h-5 text-marine-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full orca-live-beacon" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-wider bg-gradient-to-r from-white via-surface-100 to-marine-200 bg-clip-text text-transparent">
                ORCA
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-marine-950 border border-marine-500/40 text-marine-300 uppercase tracking-widest hidden xs:inline-block shadow-2xs">
                Marine AI
              </span>
            </div>
            <p className="text-[11px] text-surface-400 hidden md:block leading-tight font-medium">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Center: Live Telemetry Indicator (Desktop) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-navy-900/80 border border-navy-700/60 text-2xs text-surface-300">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="font-medium">Live Telemetry Feeds:</span>
          <span className="text-emerald-400 font-semibold">Port Safety • Open-Meteo • INCOIS • ECMWF</span>
        </div>

        {/* Right: Location, GPS, Refresh & Language Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          {/* Live GPS Quick Locate */}
          {onRequestGeolocation && (
            <button
              onClick={onRequestGeolocation}
              disabled={isRefreshing}
              className={`flex items-center gap-1 text-2xs sm:text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                isLiveLocation
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-navy-900 hover:bg-navy-800 border-navy-700/70 text-surface-300 hover:text-white'
              }`}
              title="Use current GPS coordinates"
              aria-label="Use current GPS coordinates"
            >
              <Navigation className={`w-3.5 h-3.5 ${isLiveLocation ? 'text-emerald-400' : 'text-marine-400'}`} />
              <span className="hidden sm:inline">{t('location.liveGps', 'Live GPS')}</span>
            </button>
          )}

          {/* Quick Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-surface-300 hover:text-white bg-navy-900 hover:bg-navy-800 border border-navy-700/70 rounded-lg transition-colors cursor-pointer"
              title={t('nav.refresh', 'Refresh')}
              aria-label={t('nav.refresh', 'Refresh')}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-marine-400' : ''}`} />
            </button>
          )}

          {/* Harbor Selector Pill */}
          <button
            onClick={onOpenLocationPicker}
            className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 text-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-navy-700/80 hover:border-marine-400/60 shadow-xs transition-all shrink-0 cursor-pointer"
            title={t('location.chooseLocation', 'Choose Location')}
            aria-label={t('location.chooseLocation', 'Choose Location')}
          >
            <MapPin className="w-3.5 h-3.5 text-marine-400 shrink-0" />
            <span className="font-semibold text-xs whitespace-nowrap max-w-[130px] sm:max-w-[190px] truncate">
              {currentLocationName || t('location.chooseLocation', 'Choose Location')}
            </span>
            <ChevronDown className="w-3 h-3 text-surface-400 shrink-0" />
          </button>

          {/* Responsive Language Selector */}
          <div className="relative flex items-center bg-navy-900 border border-navy-700/70 rounded-lg p-0.5 shrink-0">
            <Globe className="w-3 h-3 text-surface-400 ml-1.5 mr-0.5 shrink-0 hidden sm:block" />
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-2xs sm:text-xs rounded font-medium transition-colors ${
                currentLang === 'en'
                  ? 'bg-marine-600 text-white shadow-xs font-semibold'
                  : 'text-surface-300 hover:text-white'
              }`}
              title="English"
              aria-label="English"
            >
              <span className="sm:hidden">EN</span>
              <span className="hidden sm:inline">English</span>
            </button>
            <button
              onClick={() => handleLanguageChange('hi')}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-2xs sm:text-xs rounded font-medium transition-colors ${
                currentLang === 'hi'
                  ? 'bg-marine-600 text-white shadow-xs font-semibold'
                  : 'text-surface-300 hover:text-white'
              }`}
              title="हिन्दी"
              aria-label="हिन्दी"
            >
              <span className="sm:hidden">HI</span>
              <span className="hidden sm:inline">हिन्दी</span>
            </button>
            <button
              onClick={() => handleLanguageChange('mr')}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-2xs sm:text-xs rounded font-medium transition-colors ${
                currentLang === 'mr'
                  ? 'bg-marine-600 text-white shadow-xs font-semibold'
                  : 'text-surface-300 hover:text-white'
              }`}
              title="मराठी"
              aria-label="मराठी"
            >
              <span className="sm:hidden">MR</span>
              <span className="hidden sm:inline">मराठी</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick State & Coast Switcher Strip (Horizontal Scrollable with Arrows) */}
      {ports.length > 0 && onSelectPort && (
        <div className="w-full bg-navy-900/60 border-t border-navy-800/60 px-2 sm:px-4 lg:px-8 py-1.5 flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 shrink-0 mr-1 hidden sm:inline">
            PFZ States:
          </span>
          <button
            type="button"
            onClick={() => scrollStatesStrip('left')}
            className="p-1 rounded-md bg-navy-800/80 hover:bg-navy-700 text-surface-300 hover:text-white transition-colors shrink-0 border border-navy-700/60 cursor-pointer shadow-2xs"
            aria-label="Slide states left"
            title="Slide states left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div
            ref={statesStripRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0"
          >
            {ports.map((port) => {
              const isSelected =
                selectedPortId === port.id ||
                (currentLocationName &&
                  (currentLocationName.toLowerCase().includes(port.state.toLowerCase()) ||
                    currentLocationName.toLowerCase().includes(port.name.toLowerCase())));
              return (
                <button
                  key={port.id}
                  onClick={() => onSelectPort(port)}
                  className={`text-2xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer font-medium shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? 'bg-marine-600 text-white font-semibold shadow-xs border border-marine-400/50 ring-1 ring-marine-300/40'
                      : 'bg-navy-800/80 hover:bg-navy-700 text-surface-300 hover:text-white border border-navy-700/50'
                  }`}
                  title={`Switch to ${port.state} (${port.name})`}
                >
                  <span>{port.state}</span>
                  <span className="text-[10px] opacity-75 font-normal">({port.name})</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollStatesStrip('right')}
            className="p-1 rounded-md bg-navy-800/80 hover:bg-navy-700 text-surface-300 hover:text-white transition-colors shrink-0 border border-navy-700/60 cursor-pointer shadow-2xs"
            aria-label="Slide states right"
            title="Slide states right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
