import React from 'react';
import { useTranslation } from 'react-i18next';
import { Anchor, MapPin, Globe } from 'lucide-react';
import type { CoastalPort } from '../types';

interface MarineTopBarProps {
  currentLocationName: string;
  onOpenLocationPicker: () => void;
  ports: CoastalPort[];
  selectedPortId?: string;
  onSelectPort: (port: CoastalPort) => void;
}

export const MarineTopBar: React.FC<MarineTopBarProps> = ({
  currentLocationName,
  onOpenLocationPicker,
  ports,
  selectedPortId,
  onSelectPort,
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

  return (
    <header className="sticky top-0 z-30 bg-navy-950 text-white shadow-lg w-full">
      {/* Primary row: Logo, location, language */}
      <div className="w-full px-3 sm:px-5 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left: Logo & Name */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-marine-500/20 border border-marine-400/30 flex items-center justify-center text-marine-300 shadow-xs shrink-0">
            <Anchor className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="font-bold text-base sm:text-lg tracking-wider text-white">ORCA</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-marine-900/80 border border-marine-500/30 text-marine-300 uppercase tracking-wider hidden xs:inline-block">
                Marine
              </span>
            </div>
            <p className="text-xs text-surface-400 hidden md:block leading-tight">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Center: Harbor pills (desktop only, scrollable) */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 mx-4 py-0.5">
          <MapPin className="w-3.5 h-3.5 text-marine-400 shrink-0" />
          {ports.map((port) => {
            const isSelected = selectedPortId === port.id;
            return (
              <button
                key={port.id}
                onClick={() => onSelectPort(port)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap font-medium text-xs shrink-0 ${
                  isSelected
                    ? 'bg-marine-600 text-white font-semibold shadow-sm'
                    : 'bg-navy-800/80 hover:bg-navy-700 text-surface-300 hover:text-white border border-navy-700/50'
                }`}
              >
                {port.name}
              </button>
            );
          })}
        </div>

        {/* Right: Location pill & Language switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink min-w-0">
          {/* Quick Location Button */}
          <button
            onClick={onOpenLocationPicker}
            className="flex items-center gap-1 sm:gap-1.5 text-xs bg-navy-900 hover:bg-navy-800 text-surface-200 hover:text-white px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-navy-700/60 transition-colors max-w-[95px] xs:max-w-[125px] sm:max-w-[180px] shrink min-w-0"
            title={t('nav.changeLocation')}
            aria-label={t('nav.changeLocation')}
          >
            <MapPin className="w-3.5 h-3.5 text-marine-400 shrink-0" />
            <span className="truncate font-medium text-2xs sm:text-xs">{currentLocationName}</span>
          </button>

          {/* Responsive Language Selector */}
          <div className="relative flex items-center bg-navy-900 border border-navy-700/60 rounded-lg p-0.5 shrink-0">
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
    </header>
  );
};
