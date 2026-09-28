import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, Loader2 } from 'lucide-react';
import L from 'leaflet';
import type { LocationAssessment, SuggestedLocation } from '../types';
import { getActiveStateAndCoasts } from '../data/incoisPfz';
import {
  translateLocationName,
  translatePortName,
  translateStateName,
  translateDirection,
  translateUnit,
} from '../utils/locationTranslations';

interface SimpleMapProps {
  currentLocation: LocationAssessment;
  suggestedLocation?: SuggestedLocation;
  isLiveLocation?: boolean;
  onSelectLocation?: (lat: number, lon: number, nameHint?: string) => void;
  onRequestGeolocation?: () => void;
  isLocating?: boolean;
  heightClass?: string;
}

export const SimpleMap: React.FC<SimpleMapProps> = ({
  currentLocation,
  suggestedLocation,
  isLiveLocation = false,
  onSelectLocation,
  onRequestGeolocation,
  isLocating = false,
  heightClass,
}) => {
  const { t, i18n } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectLocationRef = useRef(onSelectLocation);

  // Keep ref updated to avoid stale closures in Leaflet events
  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);

  const curLat = currentLocation.coordinates.latitude;
  const curLon = currentLocation.coordinates.longitude;
  const isLive =
    isLiveLocation ||
    currentLocation.name.toLowerCase().includes('gps') ||
    currentLocation.name.toLowerCase().includes('detected');

  // Identify active state and all its coastal points from INCOIS PFZ data
  const {
    state: activeState,
    coasts: stateCoasts,
    activeCoast,
  } = getActiveStateAndCoasts(
    curLat,
    curLon,
    currentLocation.name || currentLocation.state
  );

  // Helper to re-fit map bounds including state coast dots and current location
  const updateMapBounds = useCallback(
    (map: L.Map) => {
      try {
        const points: [number, number][] = [[curLat, curLon]];

        // Include coastal points for the state
        if (stateCoasts && stateCoasts.length > 0) {
          stateCoasts.forEach((c) => {
            if (c.lat && c.lon) {
              points.push([c.lat, c.lon]);
            }
          });
        }

        // Include PFZ target point if available
        if (activeCoast?.pfzLat && activeCoast?.pfzLon) {
          points.push([activeCoast.pfzLat, activeCoast.pfzLon]);
        }

        // Include suggested alternative if available
        if (suggestedLocation && suggestedLocation.available) {
          points.push([
            suggestedLocation.coordinates.latitude,
            suggestedLocation.coordinates.longitude,
          ]);
        }

        if (points.length > 1) {
          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 12 });
        } else {
          map.flyTo([curLat, curLon], Math.max(map.getZoom(), 10), {
            duration: 0.8,
            easeLinearity: 0.25,
          });
        }
      } catch (err) {
        console.warn('updateMapBounds error:', err);
      }
    },
    [curLat, curLon, stateCoasts, activeCoast, suggestedLocation]
  );

  // Helper to render all markers & overlays onto the map
  const renderMarkers = useCallback(
    (map: L.Map) => {
      if (!layerGroupRef.current) {
        layerGroupRef.current = L.layerGroup().addTo(map);
      }

      const layerGroup = layerGroupRef.current;
      layerGroup.clearLayers();

      const lang = i18n.language;
      const dispKm = translateUnit('km', lang);
      const dispM = translateUnit('m', lang);
      const bearingLabel = t('map.bearing', 'Bearing');
      const distLabel = t('map.distance', 'Distance');
      const depthLabel = t('map.depth', 'Depth');
      const selectBtnLabel = t('map.setActiveHarbor', 'Set Active Harbor');

      // 1. Render Coasts of the selected state using dots
      if (stateCoasts && stateCoasts.length > 0) {
        stateCoasts.forEach((c) => {
          if (!c.lat || !c.lon) return;

          const isCurrentCoast =
            activeCoast &&
            (activeCoast.id === c.id ||
              (Math.abs(c.lat - curLat) < 0.05 && Math.abs(c.lon - curLon) < 0.05));

          const dot = L.circleMarker([c.lat, c.lon], {
            radius: isCurrentCoast ? 7 : 5,
            fillColor: isCurrentCoast ? '#38BDF8' : '#2DD4BF',
            color: '#FFFFFF',
            weight: isCurrentCoast ? 2 : 1,
            opacity: 1,
            fillOpacity: isCurrentCoast ? 1.0 : 0.85,
            className: 'orca-coast-dot',
          });

          const dispName = translatePortName(c.name, lang);
          const dispState = translateStateName(c.state, lang);
          const dispDir = translateDirection(c.direction, lang);

          // Quick Hover Tooltip with high contrast and dark command center styling
          dot.bindTooltip(
            `<div style="font-family:'Inter',system-ui,sans-serif;background-color:#0B1322;padding:2px 0;min-width:130px;">
              <div style="font-size:13px;font-weight:700;color:#FFFFFF;line-height:1.3;margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                <span>${dispName}</span>
                <span style="font-size:11px;font-weight:500;color:#94A3B8;">(${dispState})</span>
              </div>
              <div style="font-size:12px;font-family:monospace;color:#38BDF8;font-weight:600;display:flex;align-items:center;gap:4px;">
                <span>${c.distance} ${dispKm}</span>
                <span style="color:#64748B;">@</span>
                <span>${c.bearing}°</span>
                <span style="color:#E2E8F0;">(${dispDir})</span>
              </div>
            </div>`,
            {
              direction: 'top',
              offset: [0, -6],
              opacity: 0.98,
              className: 'orca-map-tooltip',
            }
          );

          // Click Popup with Full Telemetry & Selection action
          const popupContent = document.createElement('div');
          popupContent.style.fontFamily = "'Inter', system-ui, sans-serif";
          popupContent.style.fontSize = '12px';
          popupContent.style.lineHeight = '1.45';
          popupContent.style.minWidth = '200px';
          popupContent.innerHTML = `
            <div style="font-weight:700;font-size:14px;color:#FFFFFF;border-bottom:1px solid #1E293B;padding-bottom:5px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span>${dispName}</span>
              <span style="font-size:11px;font-family:monospace;background:#0F1A2C;padding:2px 6px;border-radius:4px;color:#94A3B8;border:1px solid #1E293B;">${dispState}</span>
            </div>
            <div style="margin-bottom:4px;color:#CBD5E1;font-size:12px;font-family:monospace;">
              ${bearingLabel}: <span style="color:#38BDF8;font-weight:600;">${dispDir} (${c.bearing}°)</span>
            </div>
            <div style="margin-bottom:4px;color:#CBD5E1;font-size:12px;font-family:monospace;">
              ${distLabel}: <span style="font-weight:600;color:#FFFFFF;">${c.distance} ${dispKm}</span>
            </div>
            <div style="margin-bottom:4px;color:#CBD5E1;font-size:12px;font-family:monospace;">
              ${depthLabel}: <span style="font-weight:600;color:#FFFFFF;">${c.depth} ${dispM}</span>
            </div>
            <div style="color:#64748B;font-size:11px;font-family:monospace;background:#060B13;padding:4px 6px;border-radius:4px;margin-top:6px;border:1px solid #1E293B;">
              ${c.latDms || ''} ${c.lonDms || ''}
            </div>
            <button class="orca-select-coast-btn" style="margin-top:10px;width:100%;background:#0284C7;color:#fff;border:none;border-radius:5px;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:background 0.15s;">
              ${selectBtnLabel}
            </button>
          `;

          // Attach click handler to select this coast
          popupContent.querySelector('.orca-select-coast-btn')?.addEventListener('click', () => {
            onSelectLocationRef.current?.(c.lat, c.lon, `${c.name}, ${c.state}`);
            map.closePopup();
          });

          dot.bindPopup(popupContent);
          layerGroup.addLayer(dot);
        });
      }

      // 2. PFZ Hotspot & Connector Line for the active coast (if available)
      if (activeCoast?.pfzLat && activeCoast?.pfzLon) {
        // Dashed marine connector line
        const pfzLine = L.polyline(
          [
            [curLat, curLon],
            [activeCoast.pfzLat, activeCoast.pfzLon],
          ],
          {
            color: '#38BDF8',
            dashArray: '5, 7',
            weight: 2,
            opacity: 0.8,
          }
        );
        layerGroup.addLayer(pfzLine);

        // PFZ Hotspot Icon
        const pfzIcon = L.divIcon({
          className: 'orca-pfz-hotspot',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
              <div style="background:#0369A1;color:#FFFFFF;font-size:11px;font-family:monospace;font-weight:600;padding:2px 7px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.6);white-space:nowrap;margin-bottom:3px;border:1px solid rgba(56,189,248,0.7);">
                PFZ (${activeCoast.distance} ${dispKm})
              </div>
              <div style="width:13px;height:13px;background:#0284C7;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px rgba(2,132,199,0.5);"></div>
            </div>
          `,
          iconSize: [130, 38],
          iconAnchor: [65, 34],
        });

        const activeName = translatePortName(activeCoast.name, lang);
        const activeStateName = translateStateName(activeCoast.state, lang);
        const activeDir = translateDirection(activeCoast.direction, lang);

        const pfzMarker = L.marker([activeCoast.pfzLat, activeCoast.pfzLon], {
          icon: pfzIcon,
        }).bindPopup(`
          <div style="font-family:'Inter',system-ui,sans-serif;font-size:12px;line-height:1.45;min-width:190px;">
            <strong style="color:#38BDF8;font-size:13px;display:block;margin-bottom:3px;">${t('map.pfzHotspot', 'INCOIS Potential Fishing Zone')}</strong>
            <div style="margin-top:2px;font-size:12px;color:#E2E8F0;">
              ${t('map.pfzSector', 'Sector for')} <strong>${activeName}</strong> (${activeStateName})
            </div>
            <div style="margin-top:4px;color:#94A3B8;font-size:11px;font-family:monospace;">
              ${bearingLabel}: ${activeCoast.bearing}° (${activeDir})<br/>
              ${distLabel}: ${activeCoast.distance} ${dispKm} | ${depthLabel}: ${activeCoast.depth} ${dispM}
            </div>
          </div>
        `);
        layerGroup.addLayer(pfzMarker);
      }

      // 3. Current / Selected Location Marker
      const dispCurrentLocName = translateLocationName(currentLocation.name, lang);
      const currentPinText = isLive
        ? t('map.liveGpsPosition', 'GPS Position')
        : dispCurrentLocName.split(',')[0];

      const currentIcon = L.divIcon({
        className: isLive ? 'orca-live-pin' : 'orca-target-pin',
        html: isLive
          ? `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:grab;">
            <div style="background:#1E40AF;color:#FFFFFF;font-size:11px;font-family:monospace;font-weight:600;padding:2px 7px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.6);white-space:nowrap;margin-bottom:4px;border:1px solid rgba(96,165,250,0.8);">
              ${t('map.liveGpsPosition', 'GPS Position')}
            </div>
            <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
              <div class="orca-radar-wave" style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(59,130,246,0.5);"></div>
              <div style="width:13px;height:13px;background:#2563EB;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px rgba(37,99,235,0.7);position:relative;z-index:2;"></div>
            </div>
          </div>
        `
          : `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:grab;">
            <div style="background:#0F172A;color:#FFFFFF;font-size:11px;font-family:monospace;font-weight:600;padding:2px 7px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.6);white-space:nowrap;margin-bottom:4px;border:1px solid rgba(148,163,184,0.6);">
              ${currentPinText}
            </div>
            <div style="width:14px;height:14px;background:#0284C7;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px rgba(2,132,199,0.5);"></div>
          </div>
        `,
        iconSize: [140, 48],
        iconAnchor: [70, 44],
      });

      const currentMarker = L.marker([curLat, curLon], {
        icon: currentIcon,
        draggable: true,
      }).bindPopup(`
        <div style="font-family:'Inter',system-ui,sans-serif;font-size:12px;line-height:1.45;min-width:180px;">
          <strong style="font-size:13px;color:#FFFFFF;">${
            isLive ? t('map.liveGpsPosition', 'GPS Position') : dispCurrentLocName
          }</strong>
          <div style="color:#94A3B8;font-size:11px;font-family:monospace;margin-top:3px;">
            ${curLat.toFixed(4)}°N, ${curLon.toFixed(4)}°E
          </div>
          <div style="margin-top:4px;font-size:12px;color:#CBD5E1;">
            ${t('map.risk', 'Risk')}: <span style="font-weight:700;color:#38BDF8;">${currentLocation.riskLevel}</span>
          </div>
        </div>
      `);

      currentMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        onSelectLocationRef.current?.(
          pos.lat,
          pos.lng,
          `Custom Point (${pos.lat.toFixed(3)}°N, ${pos.lng.toFixed(3)}°E)`
        );
      });

      layerGroup.addLayer(currentMarker);

      // 4. Suggested Alternative Location Marker (if available)
      if (suggestedLocation && suggestedLocation.available) {
        const sugLat = suggestedLocation.coordinates.latitude;
        const sugLon = suggestedLocation.coordinates.longitude;
        const dispSugName = translateLocationName(suggestedLocation.name, lang);
        const safePrefix = t('conditions.safestPort', 'Safe');
        const sugPinText = `${safePrefix}: ${dispSugName.split(',')[0]}`;

        const suggestedIcon = L.divIcon({
          className: 'orca-suggested-pin',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
              <div style="background:#064E3B;color:#6EE7B7;font-size:11px;font-family:monospace;font-weight:600;padding:2px 7px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.6);white-space:nowrap;margin-bottom:3px;border:1px solid rgba(16,185,129,0.6);">
                ${sugPinText}
              </div>
              <div style="width:13px;height:13px;background:#059669;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px rgba(5,150,105,0.5);"></div>
            </div>
          `,
          iconSize: [140, 38],
          iconAnchor: [70, 34],
        });

        const sugMarker = L.marker([sugLat, sugLon], {
          icon: suggestedIcon,
        }).bindPopup(`
          <div style="font-family:'Inter',system-ui,sans-serif;font-size:12px;line-height:1.45;min-width:180px;">
            <strong style="color:#34D399;font-size:13px;">${t('map.safeHarborOption', 'Sheltered Harbor Option')}</strong>
            <div style="font-size:12px;color:#FFFFFF;margin-top:3px;">
              ${dispSugName}
            </div>
            <div style="color:#94A3B8;font-size:11px;font-family:monospace;margin-top:3px;">
              ${distLabel}: ${suggestedLocation.distanceKm} ${dispKm}
            </div>
          </div>
        `);
        layerGroup.addLayer(sugMarker);
      }

      // Re-fit view to encompass active coast dots and current position
      updateMapBounds(map);
    },
    [
      curLat,
      curLon,
      isLive,
      stateCoasts,
      activeCoast,
      currentLocation,
      suggestedLocation,
      t,
      i18n.language,
      updateMapBounds,
    ]
  );

  // Initialize Leaflet map once on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [curLat, curLon],
      zoom: 10,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // 1. Satellite Imagery (Esri World Imagery)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
      }
    ).addTo(map);

    // 2. English Place Overlay (Esri World Boundaries and Places)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Labels &copy; Esri',
      }
    ).addTo(map);

    // Click on map to set location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onSelectLocationRef.current?.(
        lat,
        lng,
        `Custom Point (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`
      );
    });

    // Initialize layer group and render markers
    layerGroupRef.current = L.layerGroup().addTo(map);
    renderMarkers(map);

    const initTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    }, 150);

    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    });
    ro.observe(mapContainerRef.current);

    return () => {
      clearTimeout(initTimer);
      ro.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Re-render markers whenever location, suggested props, or active state changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      renderMarkers(mapInstanceRef.current);
    }
  }, [renderMarkers]);

  return (
    <div className="bg-[#0A111E] border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3 transition-colors">
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
            {t('map.title')}
          </h2>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#060B14] border border-slate-800 text-sky-300 font-medium">
            {translateStateName(activeState.displayName, i18n.language)}: {stateCoasts.length} {t('map.coasts', 'Coasts')}
          </span>
          <span className="text-xs font-mono text-slate-400 bg-[#060B14] px-2.5 py-1 rounded border border-slate-800 hidden sm:inline-block">
            {curLat.toFixed(3)}°N, {curLon.toFixed(3)}°E
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRequestGeolocation && (
            <button
              type="button"
              onClick={onRequestGeolocation}
              disabled={isLocating}
              className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border transition-colors cursor-pointer font-semibold ${
                isLive
                  ? 'bg-blue-900/80 border-blue-500 text-blue-200'
                  : 'bg-[#060B14] hover:bg-[#0E1726] text-slate-300 border-slate-800'
              }`}
              title="Locate using GPS"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-current" />
              )}
              <span>{isLive ? t('map.liveGpsActive', 'GPS ACTIVE') : t('map.liveGps', 'GPS')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Map Container Wrapper */}
      <div className={`w-full ${heightClass || 'h-[280px] sm:h-[320px] lg:h-[380px]'} rounded-lg border border-slate-800 overflow-hidden relative shadow-inner`}>
        <div
          ref={mapContainerRef}
          className="w-full h-full leaflet-container"
          style={{ width: '100%', height: '100%', minHeight: '100%', position: 'relative', zIndex: 0 }}
        />

        {/* Floating Layer Indicator Badge */}
        <div className="absolute top-2 right-2 z-[400] bg-[#060B13]/90 text-slate-300 text-2xs font-mono px-2.5 py-1 rounded border border-slate-700/80 uppercase tracking-wider pointer-events-none">
          {t('map.satellite', 'SATELLITE')}
        </div>

        {/* Floating Hint Overlay on Map */}
        <div className="absolute bottom-2 left-2 z-[400] bg-[#060B13]/90 text-slate-300 text-xs font-mono px-3 py-1.5 rounded shadow-xs pointer-events-none flex items-center gap-1.5 border border-slate-700/80">
          <span>{t('map.clickToInspect', 'Click any coastal marker to inspect or relocate')}</span>
        </div>
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400/40" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          )}
          <span>{isLive ? t('map.liveGpsPosition', 'GPS Position') : t('map.currentLocation')}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
          <span>{translateStateName(activeState.displayName, i18n.language)} {t('map.coasts', 'Coasts')} ({stateCoasts.length})</span>
        </div>

        {activeCoast?.pfzLat && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>PFZ ({activeCoast.distance} {translateUnit('km', i18n.language)})</span>
          </div>
        )}

        {suggestedLocation?.available && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>{t('map.suggestedLocation')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
