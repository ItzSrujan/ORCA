import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Navigation, RotateCw, ChevronDown } from 'lucide-react';
import type { CoastalPort } from '../types';
import { INCOIS_PFZ_STATES } from '../data/incoisPfz';
import { translateLocationName, translateStateName } from '../utils/locationTranslations';

interface MarineTopBarProps {
  currentLocationName?: string;
  onOpenLocationPicker: () => void;
  ports?: CoastalPort[];
  selectedPortId?: string;
  onSelectPort?: (port: CoastalPort) => void;
  selectedStateId?: string;
  onSelectState?: (stateId: string) => void;
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
  selectedStateId,
  onSelectState,
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

  // Detect active state ID from selectedStateId, selectedPortId, or currentLocationName
  const activeStateId = useMemo(() => {
    if (selectedStateId && selectedStateId !== 'all') {
      return selectedStateId;
    }
    if (selectedPortId) {
      const port = ports.find((p) => p.id === selectedPortId);
      if (port?.stateId) return port.stateId;
    }
    if (currentLocationName) {
      const loc = currentLocationName.toLowerCase();
      const st = INCOIS_PFZ_STATES.find(
        (s) =>
          loc.includes(s.name.toLowerCase()) ||
          loc.includes(s.displayName.toLowerCase()) ||
          s.coasts.some((c) => loc.includes(c.name.toLowerCase()))
      );
      if (st) return st.id;
    }
    return '';
  }, [selectedStateId, selectedPortId, currentLocationName, ports]);

  const handleStateChange = (newStId: string) => {
    if (onSelectState) {
      onSelectState(newStId);
    } else if (onSelectPort) {
      const stateObj = INCOIS_PFZ_STATES.find((s) => s.id === newStId);
      if (stateObj?.defaultPort) {
        onSelectPort(stateObj.defaultPort);
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#070D18]/95 backdrop-blur-md text-slate-100 border-b border-slate-800/90 w-full transition-colors">
      {/* Primary Command Bar */}
      <div className="w-full px-3 sm:px-5 lg:px-8 py-2.5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sky-950/90 border border-sky-800/70 flex items-center justify-center font-mono font-black text-sky-400 text-sm tracking-wider select-none shrink-0 shadow-xs">
            OR
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight text-white font-mono">
              ORCA
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hidden xl:inline-block border-l border-slate-700/80 pl-2">
              Marine Telemetry
            </span>
          </div>
        </div>

        {/* Center: Location Controls (State Selector + Harbor Picker) - Visible on md+ */}
        <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 justify-center max-w-xl mx-2">
          {/* State Selector Dropdown */}
          <div className="flex items-center bg-[#0B1320] border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors shrink-0">
            <label htmlFor="topbar-state-select" className="text-2xs font-mono uppercase tracking-wider text-slate-400 mr-1.5 select-none font-medium shrink-0">
              State:
            </label>
            <select
              id="topbar-state-select"
              value={activeStateId}
              onChange={(e) => {
                const newStId = e.target.value;
                if (newStId) {
                  handleStateChange(newStId);
                }
              }}
              className="bg-transparent text-slate-200 text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer max-w-[130px] lg:max-w-[160px] truncate"
              aria-label="Select Coastal State"
            >
              <option value="" disabled className="bg-[#0B1322] text-slate-400">
                {currentLang === 'mr' ? 'राज्य निवडा' : currentLang === 'hi' ? 'राज्य चुनें' : 'Select State'}
              </option>
              {INCOIS_PFZ_STATES.map((st) => (
                <option key={st.id} value={st.id} className="bg-[#0B1322] text-slate-200">
                  {translateStateName(st.displayName, currentLang)}
                </option>
              ))}
            </select>
          </div>

          {/* Harbor / Landing Center Picker Pill */}
          <button
            onClick={onOpenLocationPicker}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-[#0B1320] hover:bg-[#111C2E] text-slate-100 px-3 py-1.5 sm:py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors shrink-0 cursor-pointer min-w-0"
            title={t('location.chooseLocation', 'Choose Landing Center')}
            aria-label={t('location.chooseLocation', 'Choose Landing Center')}
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-semibold whitespace-nowrap max-w-[120px] lg:max-w-[180px] truncate">
              {currentLocationName
                ? translateLocationName(currentLocationName, currentLang)
                : t('location.chooseLocation', 'Choose Harbor')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>
        </div>

        {/* Right: GPS, Quick Refresh & Language Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live GPS Quick Locate */}
          {onRequestGeolocation && (
            <button
              onClick={onRequestGeolocation}
              disabled={isRefreshing}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer font-medium shrink-0 ${
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
              className="p-1.5 text-slate-400 hover:text-white bg-[#0B1320] hover:bg-[#111C2E] border border-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
              title={t('nav.refresh', 'Refresh')}
              aria-label={t('nav.refresh', 'Refresh')}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}

          {/* Language Switcher */}
          <div className="flex items-center bg-[#0B1320] border border-slate-800 rounded-lg p-0.5 shrink-0 font-mono text-xs">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
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
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
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
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
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

      {/* Mobile Location Row (< md): Dedicated full-width State + Harbor selectors */}
      <div className="md:hidden w-full bg-[#050A12] border-t border-slate-800/80 px-3 py-1.5 flex items-center gap-2">
        {/* State Selector */}
        <div className="flex items-center bg-[#0B1320] border border-slate-800 rounded-lg px-2 py-1 flex-1 min-w-0">
          <label htmlFor="topbar-state-select-mobile" className="text-3xs font-mono uppercase tracking-wider text-slate-400 mr-1 select-none font-medium shrink-0">
            State:
          </label>
          <select
            id="topbar-state-select-mobile"
            value={activeStateId}
            onChange={(e) => {
              const newStId = e.target.value;
              if (newStId) {
                handleStateChange(newStId);
              }
            }}
            className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer w-full truncate"
            aria-label="Select Coastal State"
          >
            <option value="" disabled className="bg-[#0B1322] text-slate-400">
              {currentLang === 'mr' ? 'राज्य' : currentLang === 'hi' ? 'राज्य' : 'State'}
            </option>
            {INCOIS_PFZ_STATES.map((st) => (
              <option key={st.id} value={st.id} className="bg-[#0B1322] text-slate-200">
                {translateStateName(st.displayName, currentLang)}
              </option>
            ))}
          </select>
        </div>

        {/* Harbor Picker */}
        <button
          onClick={onOpenLocationPicker}
          className="flex items-center justify-between gap-1 text-xs bg-[#0B1320] hover:bg-[#111C2E] text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-800 flex-1 min-w-0 cursor-pointer"
          title={t('location.chooseLocation', 'Choose Landing Center')}
          aria-label={t('location.chooseLocation', 'Choose Landing Center')}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-semibold truncate">
              {currentLocationName
                ? translateLocationName(currentLocationName, currentLang)
                : t('location.chooseLocation', 'Choose Harbor')}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
        </button>
      </div>
    </header>
  );
};
