import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MarineTopBar } from './components/MarineTopBar';
import { LocationSection } from './components/LocationSection';
import { RiskStatusBanner } from './components/RiskStatusBanner';
import { RecommendationCard } from './components/RecommendationCard';
import { ConditionsGrid } from './components/ConditionsGrid';
import { LocationSearchModal } from './components/LocationSearchModal';
import { SimpleMap } from './components/SimpleMap';
import { apiService, POPULAR_COASTAL_PORTS } from './services/api';
import type { LocationAssessment, CoastalPort } from './types';

// Default initial state (Digha, West Bengal)
const DEFAULT_ASSESSMENT: LocationAssessment = {
  name: 'Digha, West Bengal',
  state: 'West Bengal',
  coordinates: { latitude: 21.6266, longitude: 87.5074 },
  lastUpdated: 'Just now',
  riskLevel: 'CAUTION',
  riskHeadline: 'PROCEED WITH CAUTION',
  recommendation: 'Conditions are suitable with caution.',
  reason: 'Wave conditions are moderate and wind conditions remain within the configured operating range.',
  conditions: {
    windSpeedKmH: 18,
    windDirection: 'NE',
    windStatus: 'Moderate',
    waveHeightM: 1.2,
    wavePeriodS: 6.5,
    waveStatus: 'Moderate',
    currentSpeedMs: 0.6,
    currentStatus: 'Normal',
    seaTemperatureC: 28,
    tideStatus: 'Rising',
    tideNote: 'Next high tide in 2h 15m',
    fishingAdvisoryAvailable: true,
    fishingAdvisoryZone: 'PFZ Sector 4A',
    fishingAdvisorySummary: 'Moderate chlorophyll concentrations 8nm south-east.',
  },
};

// Responsive desktop detection hook
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

export default function App() {
  const { i18n } = useTranslation();
  const isDesktop = useIsDesktop();
  const [assessment, setAssessment] = useState<LocationAssessment>(DEFAULT_ASSESSMENT);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isLiveLocation, setIsLiveLocation] = useState<boolean>(false);

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  // Derive selected port ID from current assessment name
  const selectedPortId = isLiveLocation
    ? undefined
    : POPULAR_COASTAL_PORTS.find((p) =>
        assessment.name.toLowerCase().includes(p.id)
      )?.id;

  // Load location data
  const loadLocationData = useCallback(
    async (lat: number, lon: number, nameHint?: string, isLive?: boolean) => {
      setIsRefreshing(true);
      try {
        const assessmentRes = await apiService.analyzeLocation({
          latitude: lat,
          longitude: lon,
          language: currentLang,
          location_name: nameHint,
        });
        if (typeof isLive === 'boolean') {
          setIsLiveLocation(isLive);
        } else if (typeof assessmentRes.isLiveLocation === 'boolean') {
          setIsLiveLocation(assessmentRes.isLiveLocation);
        }
        setAssessment(assessmentRes);
      } catch (err) {
        console.error('Error loading location data:', err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [currentLang]
  );

  // Request browser geolocation or immediately load default harbor live data
  const requestGeolocation = useCallback(() => {
    const defaultPort = POPULAR_COASTAL_PORTS[0];

    if (!navigator.geolocation) {
      setPermissionDenied(true);
      setIsLiveLocation(false);
      loadLocationData(defaultPort.lat, defaultPort.lon, `${defaultPort.name}, ${defaultPort.state}`, false);
      return;
    }

    setIsRefreshing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermissionDenied(false);
        setIsLiveLocation(true);
        const { latitude, longitude } = pos.coords;
        loadLocationData(latitude, longitude, 'Live Location', true);
      },
      (err) => {
        console.warn('Geolocation denied or unavailable:', err.message);
        setPermissionDenied(true);
        setIsLiveLocation(false);
        loadLocationData(defaultPort.lat, defaultPort.lon, `${defaultPort.name}, ${defaultPort.state}`, false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [loadLocationData]);

  // Initial visit: immediately fetch live data
  useEffect(() => {
    requestGeolocation();
  }, [requestGeolocation]);

  // When language switches, reload location data in the newly selected language
  useEffect(() => {
    if (assessment.coordinates.latitude && assessment.coordinates.longitude) {
      loadLocationData(
        assessment.coordinates.latitude,
        assessment.coordinates.longitude,
        isLiveLocation ? 'Live Location' : assessment.name,
        isLiveLocation
      );
    }
  }, [currentLang]);

  // Refresh current location
  const handleRefresh = () => {
    loadLocationData(
      assessment.coordinates.latitude,
      assessment.coordinates.longitude,
      isLiveLocation ? 'Live Location' : assessment.name,
      isLiveLocation
    );
  };

  // Select port from modal, shortcuts, or top bar
  const handleSelectPort = (port: CoastalPort) => {
    setIsLiveLocation(false);
    loadLocationData(port.lat, port.lon, `${port.name}, ${port.state}`, false);
  };

  // Select custom coordinates clicked on map or searched
  const handleSelectCoordinates = (lat: number, lon: number, nameHint?: string) => {
    setIsLiveLocation(false);
    loadLocationData(lat, lon, nameHint || `Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`, false);
  };

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-surface-100 text-navy-900 flex flex-col antialiased selection:bg-marine-200">
      {/* 1. TOP BAR (with integrated harbor pills) */}
      <MarineTopBar
        currentLocationName={isLiveLocation ? 'Live Location' : assessment.name.split(',')[0]}
        onOpenLocationPicker={() => setIsSearchOpen(true)}
        ports={POPULAR_COASTAL_PORTS}
        selectedPortId={selectedPortId}
        onSelectPort={handleSelectPort}
      />

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full px-3 sm:px-5 lg:px-8 xl:px-10 py-4 sm:py-5 lg:py-6">
        {isDesktop ? (
          /* ── DESKTOP DASHBOARD LAYOUT (>= 1024px) ──────────────── */
          <div className="space-y-5">
            {/* Row 1: Location + Risk (full width) */}
            <LocationSection
              assessment={assessment}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              onOpenSearch={() => setIsSearchOpen(true)}
              permissionDenied={permissionDenied}
              onAllowLocation={requestGeolocation}
              isLiveLocation={isLiveLocation}
            />

            {/* Row 2: Recommendation + Map (2-column) */}
            <div className="grid grid-cols-12 gap-5 items-start">
              {/* Left: Recommendation + Ask ORCA (8 cols) */}
              <div className="col-span-12 lg:col-span-8 space-y-5">
                <RecommendationCard
                  recommendation={assessment.recommendation}
                  reason={assessment.reason}
                  isMissingData={assessment.isMissingData}
                  currentLocation={assessment}
                />
              </div>

              {/* Right: Map (4 cols, sticky) */}
              <div className="col-span-12 lg:col-span-4 sticky top-16">
                <SimpleMap
                  currentLocation={assessment}
                  isLiveLocation={isLiveLocation}
                  onSelectLocation={handleSelectCoordinates}
                  onRequestGeolocation={requestGeolocation}
                  isLocating={isRefreshing}
                />
              </div>
            </div>

            {/* Row 3: Conditions Grid (full width, 6-column) */}
            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        ) : (
          /* ── MOBILE / TABLET SEQUENTIAL LAYOUT (< 1024px) ──────── */
          <div className="w-full space-y-4">
            {/* 1. Location + Risk */}
            <LocationSection
              assessment={assessment}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              onOpenSearch={() => setIsSearchOpen(true)}
              permissionDenied={permissionDenied}
              onAllowLocation={requestGeolocation}
              isLiveLocation={isLiveLocation}
            />

            {/* 2. Recommendation + Ask ORCA (Chatbox in place of map) */}
            <RecommendationCard
              recommendation={assessment.recommendation}
              reason={assessment.reason}
              isMissingData={assessment.isMissingData}
              currentLocation={assessment}
            />

            {/* 3. Risk Banner (detailed, mobile-only) */}
            <RiskStatusBanner riskLevel={assessment.riskLevel} />

            {/* 4. Map */}
            <SimpleMap
              currentLocation={assessment}
              isLiveLocation={isLiveLocation}
              onSelectLocation={handleSelectCoordinates}
              onRequestGeolocation={requestGeolocation}
              isLocating={isRefreshing}
            />

            {/* 5. Conditions Grid */}
            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-4 text-center text-2xs text-surface-500 border-t border-surface-200 bg-surface-50 mt-auto">
        <div className="w-full px-4 sm:px-5 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>ORCA Marine Decision Support • Designed for Coastal Navigation & Fishing Safety</p>
          <p className="text-surface-400">Open-Meteo • ECMWF • INCOIS PFZ Prototype Feeds</p>
        </div>
      </footer>

      {/* MODALS */}
      <LocationSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPort={handleSelectPort}
        onRequestGeolocation={requestGeolocation}
      />
    </div>
  );
}
