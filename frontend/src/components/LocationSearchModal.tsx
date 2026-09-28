import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Navigation, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { INCOIS_PFZ_STATES, ALL_PFZ_COASTS } from '../data/incoisPfz';
import type { CoastalPort } from '../types';
import { translateLocationName, translateStateName } from '../utils/locationTranslations';

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPort: (port: CoastalPort) => void;
  onRequestGeolocation: () => void;
}

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectPort,
  onRequestGeolocation,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStateId, setSelectedStateId] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const stateTabsRef = useRef<HTMLDivElement>(null);

  const scrollStateTabs = (direction: 'left' | 'right') => {
    if (stateTabsRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      stateTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const filteredCoasts = useMemo(() => {
    let list = ALL_PFZ_COASTS;

    if (selectedStateId !== 'all') {
      list = list.filter((c) => c.stateId === selectedStateId);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.direction.toLowerCase().includes(q)
      );
    }

    return list;
  }, [selectedStateId, searchTerm]);

  if (!isOpen) return null;

  const handleCustomSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    setSearchError(null);

    // 1. Check if user typed coordinates (e.g., "17.697, 83.298" or "17.697 83.298")
    const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        onSelectPort({
          id: `coord-${lat.toFixed(3)}-${lon.toFixed(3)}`,
          name: `Coordinates (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
          state: 'Custom Target',
          lat,
          lon,
        });
        onClose();
        return;
      }
    }

    // 2. Check if query matches a known coast directly
    const foundCoast = ALL_PFZ_COASTS.find(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase() === query.toLowerCase()
    );
    if (foundCoast) {
      onSelectPort(foundCoast);
      onClose();
      return;
    }

    // 3. Fallback to Open-Meteo free geocoding API
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const item = data.results[0];
          onSelectPort({
            id: `geo-${item.id || item.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}`,
            state: item.country || 'Coastal Zone',
            lat: item.latitude,
            lon: item.longitude,
          });
          onClose();
          return;
        }
      }
      setSearchError(`No location found for "${query}". Try coast name or state.`);
    } catch (err) {
      console.warn('Geocoding error:', err);
      setSearchError('Search failed. Please enter coordinates or select a coast below.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040810]/85 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0B1322] w-full max-w-2xl rounded-xl shadow-2xl border border-slate-700/80 max-h-[88vh] flex flex-col my-auto text-left text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#070D18] rounded-t-xl">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {t('location.chooseLocation', 'Select Coastal Harbor')}
            </h2>
            <p className="text-2xs font-mono text-slate-400 mt-0.5">
              INCOIS Potential Fishing Zones (PFZ) Coastal Directory
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            aria-label={t('location.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* GPS Quick Action */}
          <button
            type="button"
            onClick={() => {
              onRequestGeolocation();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>Use Current GPS Location</span>
          </button>

          {/* Search Input Bar */}
          <div className="space-y-1.5">
            <form onSubmit={handleCustomSearch} className="relative">
              {isSearching ? (
                <Loader2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 animate-spin" />
              ) : (
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              )}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                placeholder="Search coast, port, coordinates (e.g. Karwar, Digha, 18.91, 72.82)..."
                className="w-full pl-9 pr-14 py-2 rounded-lg border border-slate-700/80 focus:border-sky-500 text-xs sm:text-sm text-slate-100 bg-[#060B14] placeholder:text-slate-500 focus:outline-none font-sans"
              />
              {searchTerm && (
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSearching ? '...' : 'Go'}
                </button>
              )}
            </form>
            {searchError && (
              <p className="text-2xs text-rose-400 font-mono px-1">{searchError}</p>
            )}
          </div>

          {/* State Filter Tabs */}
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-2 font-semibold">
              Filter by State ({INCOIS_PFZ_STATES.length}):
            </span>

            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollStateTabs('left')}
                className="p-1.5 rounded bg-[#060B14] hover:bg-[#121E33] text-slate-400 hover:text-white transition-colors shrink-0 border border-slate-800 cursor-pointer"
                aria-label="Slide left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={stateTabsRef}
                className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth flex-1 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setSelectedStateId('all')}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedStateId === 'all'
                      ? 'bg-sky-600 text-white font-semibold shadow-xs'
                      : 'bg-[#060B14] hover:bg-[#121E33] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {currentLang === 'mr' ? 'सर्व' : currentLang === 'hi' ? 'सभी' : 'All'} ({ALL_PFZ_COASTS.length})
                </button>

                {INCOIS_PFZ_STATES.map((st) => {
                  const translatedSt = translateStateName(st.displayName, currentLang);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStateId(st.id)}
                      className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedStateId === st.id
                          ? 'bg-sky-600 text-white font-semibold shadow-xs'
                          : 'bg-[#060B14] hover:bg-[#121E33] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {translatedSt} ({st.coastCount})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollStateTabs('right')}
                className="p-1.5 rounded bg-[#060B14] hover:bg-[#121E33] text-slate-400 hover:text-white transition-colors shrink-0 border border-slate-800 cursor-pointer"
                aria-label="Slide right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Coasts Grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Landing Centers & Ports ({filteredCoasts.length})
              </span>
              {selectedStateId !== 'all' && (
                <span className="text-xs font-mono font-medium text-sky-400">
                  {translateStateName(INCOIS_PFZ_STATES.find((s) => s.id === selectedStateId)?.displayName || '', currentLang)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredCoasts.slice(0, 150).map((coast) => {
                const translatedCoastName = translateLocationName(coast.name, currentLang);
                const translatedCoastState = translateStateName(coast.state, currentLang);
                return (
                  <button
                    key={coast.id}
                    onClick={() => {
                      onSelectPort(coast);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[#060B14] hover:bg-[#0E1726] border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-sm sm:text-base font-semibold text-slate-100 group-hover:text-sky-300 truncate">
                        {translatedCoastName}
                      </div>
                      <div className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-1 font-mono">
                        <span className="text-slate-300">{translatedCoastState}</span>
                        <span>•</span>
                        <span className="text-sky-400">PFZ: {coast.distance} km</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono text-slate-300 bg-[#0B1322] px-2 py-0.5 rounded border border-slate-800">
                        {coast.direction} ({coast.bearing}°)
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-1">
                        {coast.depth}m depth
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredCoasts.length === 0 && (
                <div className="col-span-full text-center py-8 text-slate-500 text-xs sm:text-sm font-mono">
                  No landing centers match "{searchTerm}". Try another query.
                </div>
              )}
            </div>

            {filteredCoasts.length > 150 && (
              <p className="text-xs font-mono text-slate-500 text-center mt-2">
                Showing top 150 records. Type in search bar to narrow results.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
