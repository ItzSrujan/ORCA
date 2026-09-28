import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Navigation, RotateCw, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import type { CoastalPort } from '../types';
import { translateLocationName, translateStateName } from '../utils/locationTranslations';

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
      const scrollAmount = direction === 'left' ? -220 : 220;
      statesStripRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#070D18]/95 backdrop-blur-md text-slate-100 border-b border-slate-800/90 w-full transition-colors">
      {/* 1. Primary Command Bar */}
      <div className="w-full px-3 sm:px-5 lg:px-8 py-2.5 flex items-center justify-between gap-3 min-w-0">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center font-mono font-black text-sky-400 text-sm tracking-wider select-none shrink-0 shadow-xs">
            OR
          </div>
          <div className="min-w-0 flex items-baseline gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight text-white font-mono">
              ORCA
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hidden xs:inline-block border-l border-slate-700/80 pl-2">
              Marine Telemetry
            </span>
          </div>
        </div>

        {/* Right: GPS, Location Selector, Refresh & Language Switcher */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {/* Live GPS Quick Locate */}
          {onRequestGeolocation && (
            <button
              onClick={onRequestGeolocation}
              disabled={isRefreshing}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer font-medium ${
                isLiveLocation
                  ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                  : 'bg-[#0B1320] hover:bg-[#111C2E] border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Use current GPS coordinates"
              aria-label="Use current GPS coordinates"
            >
              <Navigation className={`w-3.5 h-3.5 ${isLiveLocation ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline font-mono text-2xs">{t('location.liveGps', 'GPS')}</span>
            </button>
          )}

          {/* Quick Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-slate-400 hover:text-white bg-[#0B1320] hover:bg-[#111C2E] border border-slate-800 rounded-md transition-colors cursor-pointer"
              title={t('nav.refresh', 'Refresh')}
              aria-label={t('nav.refresh', 'Refresh')}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}

          {/* Location Selector Pill */}
          <button
            onClick={onOpenLocationPicker}
            className="flex items-center gap-2 text-sm bg-[#0B1320] hover:bg-[#111C2E] text-slate-100 px-3 py-1.5 sm:py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors shrink-0 cursor-pointer"
            title={t('location.chooseLocation', 'Choose Location')}
            aria-label={t('location.chooseLocation', 'Choose Location')}
          >
            <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm whitespace-nowrap max-w-[150px] sm:max-w-[220px] truncate">
              {currentLocationName
                ? translateLocationName(currentLocationName, currentLang)
                : t('location.chooseLocation', 'Choose Location')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>

          {/* Language Switcher */}
          <div className="flex items-center bg-[#0B1320] border border-slate-800 rounded-md p-0.5 shrink-0 font-mono text-xs">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-2.5 py-1 rounded transition-colors ${
                currentLang === 'en'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="English"
              aria-label="English"
            >
              EN
            </button>
            <button
              onClick={() => handleLanguageChange('hi')}
              className={`px-2.5 py-1 rounded transition-colors ${
                currentLang === 'hi'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="हिन्दी"
              aria-label="हिन्दी"
            >
              HI
            </button>
            <button
              onClick={() => handleLanguageChange('mr')}
              className={`px-2.5 py-1 rounded transition-colors ${
                currentLang === 'mr'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="मराठी"
              aria-label="मराठी"
            >
              MR
            </button>
          </div>
        </div>
      </div>

      {/* 2. Coastal State Fast Switcher Ribbon */}
      {ports.length > 0 && onSelectPort && (
        <div className="w-full bg-[#050A12] border-t border-slate-800/80 px-2 sm:px-4 lg:px-8 py-2 flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 shrink-0 mr-1 hidden sm:inline">
            COASTS:
          </span>
          <button
            type="button"
            onClick={() => scrollStatesStrip('left')}
            className="p-1 rounded bg-[#0A101C] hover:bg-[#121E33] text-slate-400 hover:text-slate-200 transition-colors shrink-0 border border-slate-800 cursor-pointer"
            aria-label="Slide left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div
            ref={statesStripRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0"
          >
            {ports.map((port) => {
              const isSelected =
                selectedPortId === port.id ||
                (currentLocationName &&
                  (currentLocationName.toLowerCase().includes(port.state.toLowerCase()) ||
                    currentLocationName.toLowerCase().includes(port.name.toLowerCase())));
              const translatedState = translateStateName(port.state, currentLang);
              const translatedPort = translateLocationName(port.name, currentLang);
              return (
                <button
                  key={port.id}
                  onClick={() => onSelectPort(port)}
                  className={`text-xs sm:text-sm px-3 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer shrink-0 font-medium ${
                    isSelected
                      ? 'bg-sky-950 text-sky-300 font-semibold border border-sky-600/70 shadow-xs'
                      : 'bg-[#0A111E] hover:bg-[#101A2D] text-slate-400 hover:text-slate-200 border border-slate-800/90'
                  }`}
                  title={`Switch to ${translatedState} (${translatedPort})`}
                >
                  <span className="font-semibold">{translatedState}</span>
                  <span className="text-xs text-slate-400 font-normal ml-1.5">· {translatedPort}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollStatesStrip('right')}
            className="p-1 rounded bg-[#0A101C] hover:bg-[#121E33] text-slate-400 hover:text-slate-200 transition-colors shrink-0 border border-slate-800 cursor-pointer"
            aria-label="Slide right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
