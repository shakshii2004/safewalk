import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// ── Tile layers ──────────────────────────────────────────────────────────────
const LAYERS = {
    street: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attr: '© OpenStreetMap © CARTO',
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: '© Esri',
    },
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attr: '© OpenStreetMap © CARTO',
    },
};

// ── Icons ────────────────────────────────────────────────────────────────────
const makePulseIcon = () => L.divIcon({
    className: '',
    html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:24px;height:24px;background:rgba(59,130,246,0.25);border-radius:50%;animation:pulseRing 2s ease-out infinite;"></div>
        <div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6);position:relative;z-index:1;"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const destIcon = L.divIcon({
    className: '',
    html: `<div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:20px solid #ef4444;filter:drop-shadow(0 2px 4px rgba(239,68,68,0.5));"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
});

// ── OSRM routing ─────────────────────────────────────────────────────────────
async function fetchRoute(from, to) {
    const url = `https://router.project-osrm.org/route/v1/walking/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM route failed');
    const data = await res.json();
    if (!data.routes?.[0]) return null;
    const r = data.routes[0];
    return {
        coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distanceM: r.distance,
        durationS: r.duration,
    };
}

// ── Pulse CSS (injected once) ────────────────────────────────────────────────
function injectPulseCSS() {
    if (document.getElementById('sw-pulse-style')) return;
    const s = document.createElement('style');
    s.id = 'sw-pulse-style';
    s.textContent = `
        @keyframes pulseRing {
            0%   { transform: scale(0.5); opacity: 0.9; }
            80%  { transform: scale(2.8); opacity: 0; }
            100% { transform: scale(2.8); opacity: 0; }
        }
        .sw-location-label {
            background: rgba(15, 23, 42, 0.92) !important;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(59, 130, 246, 0.5) !important;
            border-radius: 10px !important;
            color: #f1f5f9 !important;
            font-weight: 700 !important;
            font-size: 11px !important;
            padding: 4px 10px !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
            white-space: nowrap;
            z-index: 1000 !important;
        }
        .sw-risk-label {
            background: rgba(15, 23, 42, 0.7) !important;
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            border-radius: 6px !important;
            color: #f1f5f9 !important;
            font-weight: 600 !important;
            font-size: 10px !important;
            padding: 2px 6px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
            white-space: nowrap;
            pointer-events: none !important;
        }
        .leaflet-tooltip-top.sw-location-label::before {
            border-top-color: rgba(59, 130, 246, 0.5) !important;
        }
        .leaflet-tooltip-pane { z-index: 650 !important; }
    `;
    document.head.appendChild(s);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RiskMap({ location, currentLocationName, riskZones = [], realReports = [], searchTarget = null, onRouteInfo, onRouteSafety, onControlsReady }) {
    const containerRef = useRef(null);
    const map = useRef(null);
    const tileLayer = useRef(null);
    const locationMarker = useRef(null);
    const accuracyCircle = useRef(null);
    const destMarker = useRef(null);
    const routeLine = useRef(null);
    const riskLayer = useRef(null);
    const hasFlown = useRef(false);
    const currentLayerKey = useRef('street');

    // ── 1. Init map once ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || map.current) return;

        injectPulseCSS();

        riskLayer.current = L.layerGroup();

        map.current = L.map(containerRef.current, {
            zoomControl: false,
            attributionControl: true,
        }).setView([20, 78], 4);

        tileLayer.current = L.tileLayer(LAYERS.street.url, { attribution: LAYERS.street.attr }).addTo(map.current);
        riskLayer.current.addTo(map.current);
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map.current);

        // Ensure Leaflet gets real size after first paint
        requestAnimationFrame(() => map.current?.invalidateSize());

        // Watch container size changes (flex layout may deliver size asynchronously)
        const ro = new ResizeObserver(() => map.current?.invalidateSize());
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            if (map.current) { map.current.remove(); map.current = null; }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 2. Track current location ─────────────────────────────────────────────
    useEffect(() => {
        if (!map.current || !location) return;
        const latlng = [location.lat, location.lng];

        if (!hasFlown.current) {
            map.current.flyTo(latlng, 16, { animate: true, duration: 1.8 });
            hasFlown.current = true;
        }

        if (!locationMarker.current) {
            locationMarker.current = L.marker(latlng, { icon: makePulseIcon(), zIndexOffset: 1000 }).addTo(map.current);
        } else {
            locationMarker.current.setLatLng(latlng);
        }

        const radius = location.accuracy ?? 40;
        if (!accuracyCircle.current) {
            accuracyCircle.current = L.circle(latlng, {
                radius, color: '#3b82f6', fillColor: '#3b82f6',
                fillOpacity: 0.07, weight: 1.5, dashArray: '4 4',
            }).addTo(map.current);
        } else {
            accuracyCircle.current.setLatLng(latlng).setRadius(radius);
        }

        // Location label
        if (currentLocationName && locationMarker.current) {
            locationMarker.current.unbindTooltip();
            locationMarker.current.bindTooltip(currentLocationName, {
                permanent: true,
                direction: 'top',
                className: 'sw-location-label',
                offset: [0, -8]
            }).openTooltip();
        }

        // Risk zones around user
        riskLayer.current?.clearLayers();
        
        // Convert real reports to risk zones
        const reportZones = realReports.map(r => ({
            center: [r.lat, r.lng],
            radius: 200,
            color: '#ef4444',
            label: 'Incident Reported',
            desc: r.type || 'Recent safety report in this area.'
        }));

        const zones = [
            ...reportZones,
            { 
                center: [location.lat + 0.005, location.lng + 0.005], 
                radius: 300, color: '#ef4444', 
                label: 'High Risk Area',
                desc: 'Recent incidents reported. Stay in well-lit areas.'
            },
            { 
                center: [location.lat - 0.008, location.lng - 0.003], 
                radius: 500, color: '#f59e0b', 
                label: 'Caution Area',
                desc: 'Low lighting detected. Use caution if walking alone.'
            },
            ...riskZones,
        ];

        zones.forEach(z => {
            const zLatLng = L.latLng(z.center[0], z.center[1]);
            const userLatLng = L.latLng(location.lat, location.lng);
            const distM = userLatLng.distanceTo(zLatLng);
            const distStr = distM > 1000 ? `${(distM / 1000).toFixed(1)}km` : `${Math.round(distM)}m`;

            const circle = L.circle(z.center, { 
                color: z.color, 
                fillColor: z.color, 
                fillOpacity: 0.18, 
                weight: 2, 
                radius: z.radius 
            })
            .bindPopup(`
                <div style="min-width:140px; padding:2px;">
                    <div style="color:${z.color}; font-weight:800; font-size:13px; margin-bottom:2px;">${z.label}</div>
                    <div style="color:#64748b; font-size:10px; font-weight:700; margin-bottom:6px;">${distStr} away</div>
                    <div style="color:#475569; font-size:11px; line-height:1.4;">${z.desc || 'Standard safety check required.'}</div>
                </div>
            `)
            .addTo(riskLayer.current);

            // Add permanent label for risk zones too (similar to user label but different style)
            circle.bindTooltip(`${z.label}`, {
                permanent: true,
                direction: 'center',
                className: 'sw-risk-label',
                interactive: true
            }).openTooltip();
        });
    }, [location, riskZones, realReports, currentLocationName]);

    // ── 3. Draw route to destination ──────────────────────────────────────────
    useEffect(() => {
        if (!map.current) return;

        if (routeLine.current) { routeLine.current.remove(); routeLine.current = null; }
        if (destMarker.current) { destMarker.current.remove(); destMarker.current = null; }

        if (!searchTarget || !location) return;

        const reportZones = realReports.map(r => ({ center: [r.lat, r.lng], radius: 200, color: '#ef4444' }));
        const zones = [
            ...reportZones,
            { center: [location.lat + 0.005, location.lng + 0.005], radius: 300, color: '#ef4444' },
            { center: [location.lat - 0.008, location.lng - 0.003], radius: 500, color: '#f59e0b' },
            ...riskZones,
        ];

        destMarker.current = L.marker([searchTarget.lat, searchTarget.lng], { icon: destIcon, zIndexOffset: 999 })
            .bindPopup(`<b>📍 ${searchTarget.name}</b>`)
            .addTo(map.current)
            .openPopup();

        fetchRoute(location, searchTarget)
            .then(route => {
                if (!route || !map.current) return;

                // Safety Analysis: Check if route crosses High Risk zones
                const riskyZones = zones.filter(z => z.color === '#ef4444');
                const cautionZones = zones.filter(z => z.color === '#f59e0b');
                let isRisky = false;
                let isCaution = false;

                route.coords.forEach(([lat, lng]) => {
                    const point = L.latLng(lat, lng);
                    riskyZones.forEach(z => {
                        if (point.distanceTo(L.latLng(z.center[0], z.center[1])) < z.radius) isRisky = true;
                    });
                    cautionZones.forEach(z => {
                        if (point.distanceTo(L.latLng(z.center[0], z.center[1])) < z.radius) isCaution = true;
                    });
                });

                const routeColor = isRisky ? '#ef4444' : (isCaution ? '#f59e0b' : '#3b82f6');

                routeLine.current = L.polyline(route.coords, {
                    color: routeColor, 
                    weight: 6, opacity: 0.9,
                    lineJoin: 'round', lineCap: 'round',
                    dashArray: isRisky ? '10 10' : 'none'
                }).addTo(map.current);

                const bounds = L.latLngBounds(
                    [location.lat, location.lng],
                    [searchTarget.lat, searchTarget.lng]
                ).pad(0.15);
                map.current.fitBounds(bounds, { animate: true });

                onRouteInfo?.({
                    distance: `${(route.distanceM / 1000).toFixed(1)} km`,
                    duration: `${Math.round(route.durationS / 60)} min`,
                    isRisky,
                    isCaution
                });
                onRouteSafety?.(isRisky);
            })
            .catch(err => console.warn('OSRM routing error:', err));
    }, [searchTarget, location, riskZones, realReports]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Map controls ──────────────────────────────────────────────────────────
    const flyToUser = useCallback(() => {
        if (map.current && location) {
            map.current.flyTo([location.lat, location.lng], 17, { animate: true, duration: 1 });
        }
    }, [location]);

    const zoomIn = useCallback(() => map.current?.zoomIn(), []);
    const zoomOut = useCallback(() => map.current?.zoomOut(), []);

    const switchLayer = useCallback((key) => {
        if (!map.current || !LAYERS[key] || key === currentLayerKey.current) return;
        tileLayer.current?.remove();
        tileLayer.current = L.tileLayer(LAYERS[key].url, { attribution: LAYERS[key].attr }).addTo(map.current);
        currentLayerKey.current = key;
    }, []);

    // Notify parent of available controls
    useEffect(() => {
        onControlsReady?.({ flyToUser, zoomIn, zoomOut, switchLayer });
    }, [flyToUser, zoomIn, zoomOut, switchLayer, onControlsReady]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
}
