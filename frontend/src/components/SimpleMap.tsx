import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import L from 'leaflet';
import type { LocationAssessment, SuggestedLocation } from '../types';
import { getActiveStateAndCoasts } from '../data/incoisPfz';

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
  const { t } = useTranslation();
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
            fillColor: isCurrentCoast ? '#2563EB' : '#0D9488',
            color: '#FFFFFF',
            weight: isCurrentCoast ? 2.5 : 1.5,
            opacity: 1,
            fillOpacity: isCurrentCoast ? 1.0 : 0.85,
            className: 'orca-coast-dot',
          });

          // Quick Hover Tooltip
          dot.bindTooltip(
            `<div style="font-family:sans-serif;font-size:11px;font-weight:700;color:#0F172A;">
              ⚓ ${c.name} (${c.state})
            </div>
            <div style="font-size:10px;color:#0284C7;font-weight:600;">
              ${c.distance} km @ ${c.bearing}° (${c.direction})
            </div>`,
            { direction: 'top', offset: [0, -5], opacity: 0.95 }
          );

          // Click Popup with Full Telemetry & Selection action
          const popupContent = document.createElement('div');
          popupContent.style.fontFamily = 'sans-serif';
          popupContent.style.fontSize = '12px';
          popupContent.style.lineHeight = '1.4';
          popupContent.style.minWidth = '200px';
          popupContent.innerHTML = `
            <div style="font-weight:bold;font-size:13px;color:#0F172A;border-bottom:1px solid #E2E8F0;padding-bottom:5px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
              <span>⚓ ${c.name}</span>
              <span style="font-size:10px;background:#F1F5F9;padding:2px 6px;border-radius:4px;color:#475569;font-weight:600;">${c.state}</span>
            </div>
            <div style="margin-bottom:3px;color:#334155;font-size:11px;">
              🧭 <strong>Direction / Bearing:</strong> <span style="color:#0284C7;font-weight:bold;">${c.direction} (${c.bearing}°)</span>
            </div>
            <div style="margin-bottom:3px;color:#334155;font-size:11px;">
              📏 <strong>Distance to PFZ:</strong> <span style="font-weight:bold;">${c.distance} km</span>
            </div>
            <div style="margin-bottom:3px;color:#334155;font-size:11px;">
              🌊 <strong>Depth Range:</strong> <span style="font-weight:bold;">${c.depth} m</span>
            </div>
            <div style="color:#64748B;font-size:10px;font-family:monospace;background:#F8FAFC;padding:3px 6px;border-radius:4px;margin-top:5px;border:1px solid #E2E8F0;">
              PFZ: ${c.latDms || ''}, ${c.lonDms || ''}
            </div>
            <button class="orca-select-coast-btn" style="margin-top:8px;width:100%;background:#0284C7;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:background 0.2s;">
              📍 Set as Active Location
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
            color: '#0284C7',
            dashArray: '6, 8',
            weight: 2.5,
            opacity: 0.85,
          }
        );
        layerGroup.addLayer(pfzLine);

        // PFZ Hotspot Icon
        const pfzIcon = L.divIcon({
          className: 'orca-pfz-hotspot',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
              <div style="background:#0284C7;color:#FFFFFF;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.3);white-space:nowrap;margin-bottom:4px;border:1px solid rgba(255,255,255,0.7);display:flex;align-items:center;gap:4px;">
                <span>🐟</span>
                <span>PFZ (${activeCoast.distance} km)</span>
              </div>
              <div style="width:14px;height:14px;background:#0369A1;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px rgba(3,105,161,0.5);"></div>
            </div>
          `,
          iconSize: [130, 42],
          iconAnchor: [65, 38],
        });

        const pfzMarker = L.marker([activeCoast.pfzLat, activeCoast.pfzLon], {
          icon: pfzIcon,
        }).bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;line-height:1.4;">
            <strong style="color:#0284C7;font-size:13px;">🐟 INCOIS Potential Fishing Zone (PFZ)</strong>
            <div style="margin-top:4px;font-size:11px;color:#1E293B;">
              Target sector for <strong>${activeCoast.name}</strong> (${activeCoast.state})
            </div>
            <div style="margin-top:4px;color:#475569;font-size:11px;">
              🧭 Bearing: <strong>${activeCoast.bearing}° (${activeCoast.direction})</strong><br/>
              📏 Distance from coast: <strong>${activeCoast.distance} km</strong><br/>
              🌊 Water Depth: <strong>${activeCoast.depth} m</strong>
            </div>
            <div style="color:#64748B;font-size:10px;font-family:monospace;background:#F8FAFC;padding:3px 6px;border-radius:4px;margin-top:5px;border:1px solid #E2E8F0;">
              ${activeCoast.latDms || ''}, ${activeCoast.lonDms || ''}
            </div>
          </div>
        `);
        layerGroup.addLayer(pfzMarker);
      }

      // 3. Current / Selected Location Marker ("and also in the location it is")
      const currentIcon = L.divIcon({
        className: isLive ? 'orca-live-pin' : 'orca-target-pin',
        html: isLive
          ? `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:grab;">
            <div style="background:#1D4ED8;color:#FFFFFF;font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;margin-bottom:6px;border:1px solid rgba(255,255,255,0.8);display:flex;align-items:center;gap:5px;">
              <span style="display:inline-block;width:6px;height:6px;background:#60A5FA;border-radius:50%;"></span>
              Live GPS Location
            </div>
            <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
              <div class="orca-radar-wave" style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(37,99,235,0.45);"></div>
              <div style="width:14px;height:14px;background:#2563EB;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 2px rgba(37,99,235,0.6),0 2px 5px rgba(0,0,0,0.3);position:relative;z-index:2;"></div>
            </div>
          </div>
        `
          : `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:grab;">
            <div style="background:#0F172A;color:#FFFFFF;font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap;margin-bottom:6px;border:1px solid rgba(255,255,255,0.6);display:flex;align-items:center;gap:4px;">
              <span style="color:#38BDF8;">📍</span>
              ${currentLocation.name.split(',')[0]}
            </div>
            <div style="width:18px;height:18px;background:#0369A1;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 3px rgba(3,105,161,0.35),0 2px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [140, 52],
        iconAnchor: [70, 48],
      });

      const currentMarker = L.marker([curLat, curLon], {
        icon: currentIcon,
        draggable: true,
      }).bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;line-height:1.4;">
          <strong style="font-size:13px;color:#0F172A;">${
            isLive ? '🛰️ ' + t('map.liveGpsPosition', 'Live GPS Location') : '📍 ' + currentLocation.name
          }</strong>
          <div style="color:#64748B;font-size:11px;margin-top:2px;">
            Lat: ${curLat.toFixed(4)}° | Lon: ${curLon.toFixed(4)}°
          </div>
          <div style="margin-top:4px;">
            ${t('comparison.overallRisk', 'Risk')}: <span style="font-weight:bold;color:#0369A1;">${currentLocation.riskLevel}</span>
          </div>
          <div style="margin-top:4px;font-size:10px;color:#94A3B8;">
            💡 ${t('map.mapHint', 'Drag pin or click map to relocate')}
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

        const suggestedIcon = L.divIcon({
          className: 'orca-suggested-pin',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
              <div style="background:#047857;color:#FFFFFF;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,0.35);white-space:nowrap;margin-bottom:4px;border:1px solid rgba(255,255,255,0.5)">
                ${suggestedLocation.name} (${t('comparison.suggested', 'Suggested')})
              </div>
              <div style="width:18px;height:18px;background:#059669;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 0 0 3px rgba(5,150,105,0.4)"></div>
            </div>
          `,
          iconSize: [120, 48],
          iconAnchor: [60, 46],
        });

        const sugMarker = L.marker([sugLat, sugLon], { icon: suggestedIcon }).bindPopup(
          `<strong>${suggestedLocation.name}</strong><br/>${t('suggested.badge', 'Lower Risk Alternative')}<br/>${suggestedLocation.distanceKm} km away`
        );
        layerGroup.addLayer(sugMarker);
      }

      updateMapBounds(map);
    },
    [curLat, curLon, isLive, currentLocation, suggestedLocation, stateCoasts, activeCoast, updateMapBounds, t]
  );

  // Initialize Map ONCE on Mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [curLat, curLon],
      zoom: 10,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // 1. High-resolution Satellite Imagery (Esri World Imagery)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
      }
    ).addTo(map);

    // 2. English Place and Country Names Overlay (Esri World Boundaries and Places)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Labels &copy; Esri (English Reference)',
      }
    ).addTo(map);

    // Click on map to set location!
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

    // Initial size invalidation to prevent grey tile bugs
    const initTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    }, 150);

    // ResizeObserver on the map container
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
  }, []); // Run once on mount

  // Re-render markers whenever location, suggested props, or active state changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      renderMarkers(mapInstanceRef.current);
    }
  }, [renderMarkers]);

  return (
    <div className="bg-white border border-surface-300 rounded-2xl p-4 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="w-4 h-4 text-marine-600 shrink-0" />
          <h2 className="text-2xs font-bold uppercase tracking-wider text-navy-700">
            {t('map.title')}
          </h2>
          <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
            {activeState.displayName}: {stateCoasts.length} Coasts
          </span>
          <span className="text-2xs font-mono text-surface-500 bg-surface-100 px-2 py-0.5 rounded border border-surface-200 hidden sm:inline-block">
            {curLat.toFixed(3)}°N, {curLon.toFixed(3)}°E
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onRequestGeolocation && (
            <button
              type="button"
              onClick={onRequestGeolocation}
              disabled={isLocating}
              className={`flex items-center gap-1 text-2xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isLive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-xs'
                  : 'bg-marine-50 hover:bg-marine-100 text-marine-700 border-marine-200'
              }`}
              title="Locate me using GPS"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-current" />
              )}
              <span>{isLive ? t('map.liveGpsActive', 'Live GPS Active') : t('map.liveGps', 'Live GPS')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Map Container Wrapper */}
      <div className={`w-full ${heightClass || 'h-[280px] sm:h-[320px] lg:h-[380px]'} rounded-xl border border-surface-300 overflow-hidden relative shadow-inner`}>
        <div
          ref={mapContainerRef}
          className="w-full h-full leaflet-container"
          style={{ width: '100%', height: '100%', minHeight: '100%', position: 'relative', zIndex: 0 }}
        />

        {/* Floating Layer Indicator Badge */}
        <div className="absolute top-2 right-2 z-[400] bg-navy-950/80 backdrop-blur-xs text-white text-3xs font-medium px-2 py-0.5 rounded shadow-xs border border-white/20 uppercase tracking-wider pointer-events-none">
          🛰️ Satellite View
        </div>

        {/* Floating Hint Overlay on Map */}
        <div className="absolute bottom-2 left-2 z-[400] bg-navy-950/85 backdrop-blur-xs text-white text-2xs px-2.5 py-1 rounded-md shadow-xs pointer-events-none flex items-center gap-1.5 border border-white/20">
          <span>💡</span>
          <span>Click any coastal dot to inspect or select that harbor</span>
        </div>
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap items-center gap-3.5 pt-1 text-2xs text-surface-600 font-medium">
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white ring-2 ring-blue-300" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-navy-900 border border-white" />
          )}
          <span>{isLive ? t('map.liveGpsPosition', 'Live GPS Position') : t('map.currentLocation')}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600 border border-white ring-1 ring-teal-400" />
          <span>{activeState.displayName} Coasts ({stateCoasts.length} dots)</span>
        </div>

        {activeCoast?.pfzLat && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 border border-white ring-1 ring-sky-300" />
            <span>INCOIS PFZ Hotspot ({activeCoast.distance} km)</span>
          </div>
        )}

        {suggestedLocation?.available && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white" />
            <span>{t('map.suggestedLocation')}</span>
          </div>
        )}
      </div>
    </div>
  );
};


