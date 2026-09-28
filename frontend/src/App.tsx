import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MarineTopBar } from './components/MarineTopBar';
import { LocationSection } from './components/LocationSection';
import { RecommendationCard } from './components/RecommendationCard';
import { ConditionsGrid } from './components/ConditionsGrid';
import { SimpleMap } from './components/SimpleMap';
import { LocationComparisonModal } from './components/LocationComparisonModal';
import { LocationSearchModal } from './components/LocationSearchModal';
import { apiService, POPULAR_COASTAL_PORTS } from './services/api';
import type { LocationAssessment, LocationComparisonData, CoastalPort } from './types';

// Initial placeholder state while live telemetry connects
const DEFAULT_ASSESSMENT: LocationAssessment = {
  name: 'Kochi (Thoppumpady)',
  state: 'Kerala',
  coordinates: { latitude: 9.9312, longitude: 76.2673 },
  lastUpdated: 'Connecting to live telemetry...',
  riskLevel: 'CAUTION',
  riskHeadline: 'INITIALIZING MARINE TELEMETRY...',
  recommendation: 'Loading live atmospheric, oceanographic, and port telemetry...',
  reason: 'Connecting to real-time marine observation feeds...',
  conditions: {
    windSpeedKmH: 0,
    windDirection: '--',
    windStatus: 'Connecting...',
    waveHeightM: 0,
    wavePeriodS: 0,
    waveStatus: 'Connecting...',
    currentSpeedMs: 0,
    currentStatus: 'Connecting...',
    seaTemperatureC: 0,
    tideStatus: 'Unavailable',
    tideNote: 'Connecting...',
    fishingAdvisoryAvailable: false,
    fishingAdvisoryZone: '',
    fishingAdvisorySummary: '',
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
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

export type ViewMode = 'cockpit' | 'chat' | 'conditions' | 'map' | 'all';

export default function App() {
  const { t, i18n } = useTranslation();
  const isDesktop = useIsDesktop();
  const [assessment, setAssessment] = useState<LocationAssessment>(DEFAULT_ASSESSMENT);
  const [comparisonData, setComparisonData] = useState<LocationComparisonData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState<boolean>(false);
  const [isLiveLocation, setIsLiveLocation] = useState<boolean>(false);
  const [selectedPortId, setSelectedPortId] = useState<string>('kochi');
  const [activeView, setActiveView] = useState<ViewMode>(isDesktop ? 'cockpit' : 'all');

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
  const currentLangRef = useRef(currentLang);
  useEffect(() => {
    currentLangRef.current = currentLang;
  }, [currentLang]);

  // Load location data using stable callback
  const loadLocationData = useCallback(
    async (lat: number, lon: number, nameHint?: string, isLive?: boolean) => {
      setIsRefreshing(true);
      try {
        const assessmentRes = await apiService.analyzeLocation({
          latitude: lat,
          longitude: lon,
          language: currentLangRef.current,
          location_name: nameHint,
        });

        if (typeof isLive === 'boolean') {
          setIsLiveLocation(isLive);
        } else if (typeof assessmentRes.isLiveLocation === 'boolean') {
          setIsLiveLocation(assessmentRes.isLiveLocation);
        }
        setAssessment(assessmentRes);

        // Fetch comparative sheltered location in background
        apiService
          .compareLocations({
            latitude: lat,
            longitude: lon,
            language: currentLangRef.current,
          })
          .then((comp) => setComparisonData(comp))
          .catch(() => {});
      } catch (err) {
        console.error('Error loading location data:', err);
      } finally {
        setIsRefreshing(false);
      }
    },
    []
  );

  // Request browser geolocation or immediately load default harbor live data
  const requestGeolocation = useCallback(() => {
    const defaultPort = POPULAR_COASTAL_PORTS.find((p) => p.id === 'kochi') || POPULAR_COASTAL_PORTS[0];

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
        setSelectedPortId('');
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

  // Initial visit: immediately fetch live data ONCE on mount
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      requestGeolocation();
    }
  }, [requestGeolocation]);

  // Language switch reload
  const activeAssessmentRef = useRef(assessment);
  const isLiveLocationRef = useRef(isLiveLocation);
  useEffect(() => {
    activeAssessmentRef.current = assessment;
    isLiveLocationRef.current = isLiveLocation;
  });

  const prevLangRef = useRef(currentLang);
  useEffect(() => {
    if (prevLangRef.current !== currentLang) {
      prevLangRef.current = currentLang;
      const currentLoc = activeAssessmentRef.current;
      if (currentLoc.coordinates.latitude && currentLoc.coordinates.longitude) {
        loadLocationData(
          currentLoc.coordinates.latitude,
          currentLoc.coordinates.longitude,
          isLiveLocationRef.current ? 'Live Location' : currentLoc.name,
          isLiveLocationRef.current
        );
      }
    }
  }, [currentLang, loadLocationData]);

  // Refresh current location
  const handleRefresh = () => {
    loadLocationData(
      assessment.coordinates.latitude,
      assessment.coordinates.longitude,
      isLiveLocation ? 'Live Location' : assessment.name,
      isLiveLocation
    );
  };

  // Select port from modal or quick top bar strip
  const handleSelectPort = (port: CoastalPort) => {
    setIsLiveLocation(false);
    setSelectedPortId(port.id);
    loadLocationData(port.lat, port.lon, `${port.name}, ${port.state}`, false);
  };

  // Select custom coordinates clicked on map
  const handleSelectCoordinates = (lat: number, lon: number, nameHint?: string) => {
    setIsLiveLocation(false);
    setSelectedPortId('');
    loadLocationData(lat, lon, nameHint || `Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`, false);
  };

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#060B13] text-slate-100 flex flex-col antialiased">
      {/* 1. TOP COMMAND BAR */}
      <MarineTopBar
        currentLocationName={isLiveLocation ? t('location.chooseLocation', 'Choose Location') : assessment.name.split(',')[0]}
        onOpenLocationPicker={() => setIsSearchOpen(true)}
        ports={POPULAR_COASTAL_PORTS}
        selectedPortId={selectedPortId}
        onSelectPort={handleSelectPort}
        onRequestGeolocation={requestGeolocation}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isLiveLocation={isLiveLocation}
      />

      {/* 2. DYNAMIC WORKSPACE VIEW SWITCHER */}
      <nav aria-label="Dashboard Views" className="bg-[#070D18]/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-5 lg:px-8 py-2 sticky top-[57px] z-20">
        <div className="w-full flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          {/* View Modes Switcher */}
          <div className="flex items-center gap-1 bg-[#050912] p-1 rounded-lg border border-slate-800/90 shrink-0 font-mono text-xs sm:text-sm">
            <button
              onClick={() => setActiveView('cockpit')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                activeView === 'cockpit'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('nav.tacticalCockpit', 'Tactical Cockpit')}
            </button>

            <button
              onClick={() => setActiveView('chat')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                activeView === 'chat'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('nav.advisoryConsole', 'Ask ORCA')}
            </button>

            <button
              onClick={() => setActiveView('conditions')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                activeView === 'conditions'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('nav.telemetryMatrix', 'Telemetry Matrix')}
            </button>

            <button
              onClick={() => setActiveView('map')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                activeView === 'map'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('nav.nauticalMap', 'Satellite Chart')}
            </button>

            <button
              onClick={() => setActiveView('all')}
              className={`px-2.5 py-1.5 rounded transition-colors cursor-pointer sm:hidden ${
                activeView === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('nav.allView', 'All')}
            </button>
          </div>

          {/* Right Status Readout */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-slate-300">TELEMETRY:</span>
            <span className="text-emerald-400">ACTIVE</span>
            <span className="text-slate-600">|</span>
            <span>INCOIS PFZ</span>
          </div>
        </div>
      </nav>

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 w-full px-3 sm:px-5 lg:px-8 py-4 space-y-4">
        {/* Row 1: High-Impact Location & Risk Command Bar */}
        <LocationSection
          assessment={assessment}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onOpenSearch={() => setIsSearchOpen(true)}
          permissionDenied={permissionDenied}
          onAllowLocation={requestGeolocation}
          isLiveLocation={isLiveLocation}
        />

        {/* Dynamic View Mode Content */}
        {activeView === 'cockpit' ? (
          /* ── COCKPIT (DUAL-PANEL TACTICAL VIEW) ──────────────── */
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 items-start">
              {/* Left Column (7 cols): AI Advisory & Telemetry Cards */}
              <div className="col-span-12 lg:col-span-7 space-y-4">
                <RecommendationCard
                  recommendation={assessment.recommendation}
                  reason={assessment.reason}
                  isMissingData={assessment.isMissingData}
                  currentLocation={assessment}
                />

                <ConditionsGrid conditions={assessment.conditions} />
              </div>

              {/* Right Column (5 cols, sticky): Nautical Map */}
              <div className="col-span-12 lg:col-span-5 space-y-4 lg:sticky lg:top-32">
                <SimpleMap
                  currentLocation={assessment}
                  suggestedLocation={comparisonData?.suggested_location}
                  isLiveLocation={isLiveLocation}
                  onSelectLocation={handleSelectCoordinates}
                  onRequestGeolocation={requestGeolocation}
                  isLocating={isRefreshing}
                  heightClass="h-[320px] sm:h-[360px] lg:h-[400px]"
                />
              </div>
            </div>
          </div>
        ) : activeView === 'chat' ? (
          /* ── FOCUSED AI ADVISORY CONSOLE ───────────────────────── */
          <div className="max-w-4xl mx-auto space-y-4">
            <RecommendationCard
              recommendation={assessment.recommendation}
              reason={assessment.reason}
              isMissingData={assessment.isMissingData}
              currentLocation={assessment}
            />
            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        ) : activeView === 'conditions' ? (
          /* ── FULL TELEMETRY MATRIX ─────────────────────── */
          <div className="space-y-4">
            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        ) : activeView === 'map' ? (
          /* ── EXPANDED SATELLITE OCEAN CHART ─────────────────────── */
          <div className="space-y-4">
            <SimpleMap
              currentLocation={assessment}
              suggestedLocation={comparisonData?.suggested_location}
              isLiveLocation={isLiveLocation}
              onSelectLocation={handleSelectCoordinates}
              onRequestGeolocation={requestGeolocation}
              isLocating={isRefreshing}
              heightClass="h-[460px] sm:h-[560px] lg:h-[640px]"
            />
          </div>
        ) : (
          /* ── ALL IN ONE (SEQUENTIAL CONTINUOUS FLOW) ───────────── */
          <div className="w-full space-y-4">
            <RecommendationCard
              recommendation={assessment.recommendation}
              reason={assessment.reason}
              isMissingData={assessment.isMissingData}
              currentLocation={assessment}
            />

            <SimpleMap
              currentLocation={assessment}
              suggestedLocation={comparisonData?.suggested_location}
              isLiveLocation={isLiveLocation}
              onSelectLocation={handleSelectCoordinates}
              onRequestGeolocation={requestGeolocation}
              isLocating={isRefreshing}
              heightClass="h-[320px] sm:h-[380px]"
            />

            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        )}
      </main>

      {/* 4. FOOTER */}
      <footer className="py-3.5 text-xs font-mono text-slate-500 border-t border-slate-800 bg-[#070D18] mt-auto">
        <div className="w-full px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-2">
          <p>ORCA Marine Decision Support System</p>
        </div>
      </footer>

      {/* 5. MODALS */}
      <LocationSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPort={handleSelectPort}
        onRequestGeolocation={requestGeolocation}
      />

      {comparisonData?.suggested_location && (
        <LocationComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          currentLocation={assessment}
          suggestedLocation={comparisonData.suggested_location}
        />
      )}
    </div>
  );
}
