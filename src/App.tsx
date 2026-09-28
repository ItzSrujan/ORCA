import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  MessageSquare,
  BarChart3,
  Map as MapIcon,
  Layers,
  Anchor,
} from 'lucide-react';
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
  recommendation: 'Loading live atmospheric, oceanographic, and AIS fleet telemetry...',
  reason: 'Fetching real-time sensor observations...',
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
    setIsDesktop(mediaQuery.matches);
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
          .catch(() => { });
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
    <div className="min-h-screen max-w-full overflow-x-hidden bg-surface-100 text-navy-900 flex flex-col antialiased selection:bg-marine-200">
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
      <nav aria-label="Dashboard Views" className="bg-white/85 backdrop-blur-md border-b border-surface-200 px-3 sm:px-5 lg:px-8 py-2 sticky top-[57px] z-20 shadow-2xs">
        <div className="w-full flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* View Modes Switcher */}
          <div className="flex items-center gap-1 bg-surface-100/90 p-1 rounded-xl border border-surface-200/90 shrink-0">
            <button
              onClick={() => setActiveView('cockpit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'cockpit'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-surface-500 hover:text-navy-950 hover:bg-surface-200/60'
                }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t('nav.tacticalCockpit', 'Tactical Cockpit')}</span>
            </button>

            <button
              onClick={() => setActiveView('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'chat'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-surface-500 hover:text-navy-950 hover:bg-surface-200/60'
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('nav.advisoryConsole', 'Ask ORCA AI')}</span>
            </button>

            <button
              onClick={() => setActiveView('conditions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'conditions'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-surface-500 hover:text-navy-950 hover:bg-surface-200/60'
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{t('nav.telemetryMatrix', 'Live Telemetry')}</span>
            </button>

            <button
              onClick={() => setActiveView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeView === 'map'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-surface-500 hover:text-navy-950 hover:bg-surface-200/60'
                }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>{t('nav.nauticalMap', 'Ocean Chart')}</span>
            </button>

            {/* Mobile "All-in-One" View Option */}
            <button
              onClick={() => setActiveView('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer sm:hidden ${activeView === 'all'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-surface-500 hover:text-navy-950 hover:bg-surface-200/60'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('nav.allView', 'All')}</span>
            </button>
          </div>

          {/* Right Status Badge */}
          <div className="hidden md:flex items-center gap-2 text-2xs text-surface-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 orca-live-beacon" />
              <span>AIS Satellite Sync: <strong>Live</strong></span>
            </span>
            <span>•</span>
            <span>Open-Meteo High-Res</span>
          </div>
        </div>
      </nav>

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 w-full px-3 sm:px-5 lg:px-8 xl:px-10 py-4 sm:py-5 lg:py-6 space-y-5">
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
          <div className="space-y-5">
            <div className="grid grid-cols-12 gap-5 items-start">
              {/* Left Column (7 cols): AI Intelligence & Telemetry Cards */}
              <div className="col-span-12 lg:col-span-7 space-y-5">
                <RecommendationCard
                  recommendation={assessment.recommendation}
                  reason={assessment.reason}
                  isMissingData={assessment.isMissingData}
                  currentLocation={assessment}
                />

                <ConditionsGrid conditions={assessment.conditions} />
              </div>

              {/* Right Column (5 cols, sticky): Nautical Map & Sheltered Ports */}
              <div className="col-span-12 lg:col-span-5 space-y-4 lg:sticky lg:top-36">
                <SimpleMap
                  currentLocation={assessment}
                  suggestedLocation={comparisonData?.suggested_location}
                  isLiveLocation={isLiveLocation}
                  onSelectLocation={handleSelectCoordinates}
                  onRequestGeolocation={requestGeolocation}
                  isLocating={isRefreshing}
                  heightClass="h-[300px] sm:h-[340px] lg:h-[380px]"
                />
              </div>
            </div>
          </div>
        ) : activeView === 'chat' ? (
          /* ── FOCUSED AI ADVISORY CONSOLE ───────────────────────── */
          <div className="max-w-4xl mx-auto space-y-5">
            <RecommendationCard
              recommendation={assessment.recommendation}
              reason={assessment.reason}
              isMissingData={assessment.isMissingData}
              currentLocation={assessment}
            />
            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        ) : activeView === 'conditions' ? (
          /* ── FULL TELEMETRY & FLEET MATRIX ─────────────────────── */
          <div className="space-y-5">
            <ConditionsGrid conditions={assessment.conditions} />
          </div>
        ) : activeView === 'map' ? (
          /* ── EXPANDED NAUTICAL OCEAN CHART ─────────────────────── */
          <div className="space-y-4">
            <SimpleMap
              currentLocation={assessment}
              suggestedLocation={comparisonData?.suggested_location}
              isLiveLocation={isLiveLocation}
              onSelectLocation={handleSelectCoordinates}
              onRequestGeolocation={requestGeolocation}
              isLocating={isRefreshing}
              heightClass="h-[450px] sm:h-[550px] lg:h-[620px]"
            />
          </div>
        ) : (
          /* ── ALL IN ONE (SEQUENTIAL CONTINUOUS FLOW) ───────────── */
          <div className="w-full space-y-5">
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
      <footer className="py-4 text-center text-2xs text-surface-500 border-t border-surface-200 bg-surface-50 mt-auto">
        <div className="w-full px-4 sm:px-5 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Anchor className="w-3.5 h-3.5 text-marine-600" />
            <p>ORCA Marine Decision Support • Designed for Coastal Navigation & Fishing Safety</p>
          </div>
          <p className="text-surface-400">Open-Meteo • ECMWF • Global Fishing Watch • INCOIS Feeds</p>
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
