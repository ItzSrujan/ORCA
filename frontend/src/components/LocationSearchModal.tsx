import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, MapPin, Navigation, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { INCOIS_PFZ_STATES, ALL_PFZ_COASTS } from '../data/incoisPfz';
import type { CoastalPort } from '../types';

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
  const { t } = useTranslation();
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-xl border border-surface-300 max-h-[88vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-200 flex items-center justify-between shrink-0 bg-surface-50 rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-marine-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-navy-950">
                {t('location.chooseLocation', 'Choose Coastal Location & State')}
              </h2>
              <p className="text-[11px] text-surface-500 font-medium">
                Official INCOIS Potential Fishing Zones (PFZ) Coastal Database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-navy-950 hover:bg-surface-200 rounded-xl transition-colors"
            aria-label={t('location.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* GPS Use Current Location Button */}
          <button
            type="button"
            onClick={() => {
              onRequestGeolocation();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-marine-600 hover:bg-marine-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <Navigation className="w-4 h-4" />
            <span>{t('location.allowAccess')} (Live GPS Location)</span>
          </button>

          {/* Search Bar */}
          <div className="space-y-1.5">
            <form onSubmit={handleCustomSearch} className="relative">
              {isSearching ? (
                <Loader2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-marine-600 animate-spin" />
              ) : (
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
              )}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                placeholder="Search coast, harbor or state (e.g. Chapora, Goa, Karwar, Digha)..."
                className="w-full pl-10 pr-16 py-2.5 rounded-xl border border-surface-300 focus:outline-none focus:ring-2 focus:ring-marine-500 text-sm text-navy-900 bg-surface-50"
              />
              {searchTerm && (
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-marine-600 hover:bg-marine-700 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isSearching ? '...' : 'Go'}
                </button>
              )}
            </form>
            {searchError && (
              <p className="text-2xs text-red-600 font-medium px-1">{searchError}</p>
            )}
          </div>

          {/* State Filter Pills / Tabs */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500 block mb-1.5 px-1">
              Select Coastal State ({INCOIS_PFZ_STATES.length} States):
            </span>

            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollStateTabs('left')}
                className="p-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 hover:text-navy-950 transition-colors shrink-0 shadow-2xs border border-surface-200 cursor-pointer"
                aria-label="Slide states left"
                title="Slide states left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={stateTabsRef}
                className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth flex-1 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setSelectedStateId('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedStateId === 'all'
                      ? 'bg-navy-900 text-white shadow-xs'
                      : 'bg-surface-100 hover:bg-surface-200 text-surface-700'
                  }`}
                >
                  All Coasts ({ALL_PFZ_COASTS.length})
                </button>

                {INCOIS_PFZ_STATES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStateId(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedStateId === st.id
                        ? 'bg-navy-900 text-white shadow-xs'
                        : 'bg-surface-100 hover:bg-surface-200 text-surface-700'
                    }`}
                  >
                    {st.displayName} ({st.coastCount})
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollStateTabs('right')}
                className="p-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 hover:text-navy-950 transition-colors shrink-0 shadow-2xs border border-surface-200 cursor-pointer"
                aria-label="Slide states right"
                title="Slide states right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Coasts Grid / List */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-2xs font-bold uppercase tracking-wider text-surface-500">
                Coastal Landing Centers & Ports ({filteredCoasts.length})
              </span>
              {selectedStateId !== 'all' && (
                <span className="text-[11px] font-semibold text-marine-600">
                  {INCOIS_PFZ_STATES.find((s) => s.id === selectedStateId)?.displayName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredCoasts.slice(0, 150).map((coast) => (
                <button
                  key={coast.id}
                  onClick={() => {
                    onSelectPort(coast);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-marine-50/70 border border-surface-200 hover:border-marine-300 text-left transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-100 group-hover:bg-marine-100 flex items-center justify-center text-surface-600 group-hover:text-marine-700 transition-colors shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-navy-950 group-hover:text-marine-800 truncate">
                        {coast.name}
                      </div>
                      <div className="text-2xs text-surface-500 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-navy-800">{coast.state}</span>
                        <span>•</span>
                        <span className="text-marine-700 font-medium">PFZ: {coast.distance} km</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <div className="text-2xs font-bold text-navy-800 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">
                      {coast.direction} ({coast.bearing}°)
                    </div>
                    <div className="text-[10px] text-surface-400 font-mono mt-0.5">
                      {coast.depth}m depth
                    </div>
                  </div>
                </button>
              ))}

              {filteredCoasts.length === 0 && (
                <div className="col-span-full text-center py-8 text-surface-500 text-xs">
                  No coastal landing centers match "{searchTerm}". Try another state or keyword.
                </div>
              )}
            </div>

            {filteredCoasts.length > 150 && (
              <p className="text-[11px] text-surface-400 text-center mt-2">
                Showing top 150 coasts. Use the search bar above to narrow down.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

