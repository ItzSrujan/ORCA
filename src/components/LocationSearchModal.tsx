import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, MapPin, Navigation, Loader2 } from 'lucide-react';
import { POPULAR_COASTAL_PORTS } from '../services/api';
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredPorts = POPULAR_COASTAL_PORTS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    // 2. Check if query matches a known port directly
    const foundPort = POPULAR_COASTAL_PORTS.find(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.id.toLowerCase() === query.toLowerCase()
    );
    if (foundPort) {
      onSelectPort(foundPort);
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
      setSearchError(`No location found for "${query}". Try port name or lat,lon.`);
    } catch (err) {
      console.warn('Geocoding error:', err);
      setSearchError('Search failed. Please enter coordinates or select a port below.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-xl border border-surface-300 max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-200 flex items-center justify-between shrink-0 bg-surface-50 rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-marine-600" />
            <h2 className="text-base sm:text-lg font-bold text-navy-950">
              {t('location.searchLocation')}
            </h2>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-marine-600 hover:bg-marine-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <Navigation className="w-4 h-4" />
            <span>{t('location.allowAccess')} (GPS)</span>
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
                placeholder={t('location.searchPlaceholder') + ' (e.g. Goa, Puri, or 17.7, 83.3)'}
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

          {/* Major Coastal Ports List */}
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-surface-500 block mb-2 px-1">
              {t('location.popularPorts')}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPorts.map((port) => (
                <button
                  key={port.id}
                  onClick={() => {
                    onSelectPort(port);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-marine-50/70 border border-surface-200 hover:border-marine-300 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-100 group-hover:bg-marine-100 flex items-center justify-center text-surface-600 group-hover:text-marine-700 transition-colors">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-navy-950 group-hover:text-marine-800">
                        {port.name}
                      </div>
                      <div className="text-2xs text-surface-500">
                        {port.state}
                      </div>
                    </div>
                  </div>

                  <span className="text-2xs font-mono text-surface-400">
                    {port.lat.toFixed(2)}°N, {port.lon.toFixed(2)}°E
                  </span>
                </button>
              ))}

              {filteredPorts.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-surface-500">
                    Press Enter to search for "{searchTerm}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
