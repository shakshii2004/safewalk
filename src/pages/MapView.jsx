import React, { useState, useRef, useCallback, useEffect } from 'react';
import useGeolocation from '../hooks/useGeolocation';
import RiskMap from '../components/RiskMap';
import {
    Search, MapPin, AlertCircle, Crosshair, X,
    Plus, Minus, Layers, Navigation, Clock, Route,
    ChevronDown, Shield
} from 'lucide-react';
import { listenToNearbyReports } from '../services/api';

// ──────────── Nominatim autocomplete ────────────
async function queryPlaces(text, location) {
    const viewbox = location
        ? `&viewbox=${location.lng - 1.5},${location.lat + 1.5},${location.lng + 1.5},${location.lat - 1.5}&bounded=0`
        : '';
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&addressdetails=1${viewbox}&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SafeWalk/1.0' } });
    return res.json();
}

// ──────────── Nominatim reverse geocode ────────────
async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'SafeWalk/1.0' } });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

// ──────────── Suggestion label formatter ────────────
function formatSuggestion(result) {
    const parts = result.display_name.split(',');
    const title = parts[0].trim();
    const addr = result.address || {};
    const subtitle = [
        addr.suburb || addr.neighbourhood,
        addr.city || addr.town || addr.village,
        addr.state
    ].filter(Boolean).join(', ');
    return { title, subtitle };
}

const LAYER_OPTIONS = [
    { key: 'street', label: 'Street', emoji: '🗺️' },
    { key: 'satellite', label: 'Satellite', emoji: '🛰️' },
    { key: 'dark', label: 'Night', emoji: '🌙' },
];

export default function MapView() {
    const { location, error } = useGeolocation();
    const mapRef = useRef(null);               // DOM div inside RiskMap (accessed via wrapper div)
    const riskMapWrapperRef = useRef(null);    // outer wrapper to grab RiskMap controls

    const [destination, setDestination] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [searchTarget, setSearchTarget] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);     // { distance, duration }
    const [activeLayer, setActiveLayer] = useState('street');
    const [showLayers, setShowLayers] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [currentLocationName, setCurrentLocationName] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [isRouteRisky, setIsRouteRisky] = useState(false);
    const [realReports, setRealReports] = useState([]);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const mapTheme = {
        appBg: isLight ? '#f8fafc' : '#0f172a',
        panelBg: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.92)',
        panelBgStrong: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,23,42,0.97)',
        border: isLight ? 'rgba(148,163,184,0.45)' : 'rgba(71,85,105,0.5)',
        borderActive: 'rgba(99,102,241,0.55)',
        textMain: isLight ? '#0f172a' : '#f1f5f9',
        textMuted: isLight ? '#475569' : '#94a3b8',
        textSoft: isLight ? '#64748b' : '#64748b',
        controlBg: isLight ? 'rgba(248,250,252,0.95)' : 'rgba(15,23,42,0.88)',
        controlHover: isLight ? 'rgba(226,232,240,0.95)' : 'rgba(30,41,59,0.95)'
    };

    const debounce = useRef(null);
    const inputRef = useRef(null);

    // ── Autocomplete ──
    const handleInput = (e) => {
        const q = e.target.value;
        setDestination(q);
        setSearchTarget(null);
        setRouteInfo(null);
        clearTimeout(debounce.current);
        if (!q.trim() || q.length < 2) { setSuggestions([]); return; }
        setIsSearching(true);
        debounce.current = setTimeout(async () => {
            try {
                const data = await queryPlaces(q, location);
                setSuggestions(data);
            } catch { setSuggestions([]); }
            finally { setIsSearching(false); }
        }, 280);
    };

    const pickSuggestion = (result) => {
        const { title, subtitle } = formatSuggestion(result);
        const name = subtitle ? `${title}, ${subtitle}` : title;
        setDestination(title);
        setSuggestions([]);
        setSearchTarget({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), name });
        inputRef.current?.blur();
    };

    const clearSearch = () => {
        setDestination(''); setSuggestions([]);
        setSearchTarget(null); setRouteInfo(null);
        inputRef.current?.focus();
    };

    // ── Reverse Geocode Effect ──
    useEffect(() => {
        if (!location) return;

        const fetchLocationName = async () => {
            setIsLocating(true);
            const data = await reverseGeocode(location.lat, location.lng);
            if (data && data.address) {
                const addr = data.address;
                const name = addr.university || addr.amenity || addr.building || addr.office || addr.shop || addr.road || addr.suburb || addr.neighbourhood || addr.city || addr.town || 'Current Location';
                setCurrentLocationName(name);
            }
            setIsLocating(false);
        };

        if (!currentLocationName) {
            fetchLocationName();
        }

        // Subscribe to real reports for the heatmap
        const unsubscribe = listenToNearbyReports(location, 10, (reports) => {
            setRealReports(reports);
        });

        return () => unsubscribe();
    }, [location, currentLocationName]);

    // ── Map control proxies (delegated to RiskMap) ──
    const callControl = (fn) => {
        const el = riskMapWrapperRef.current?.querySelector(':first-child');
        if (el?.[fn]) el[fn]();
        else if (riskMapWrapperRef.current?.__riskMap?.[fn]) riskMapWrapperRef.current.__riskMap[fn]();
    };

    // Since RiskMap exposes controls on its inner div, we pass callbacks directly
    const [mapControls, setMapControls] = useState(null);

    const onMapReady = useCallback((controls) => {
        setMapControls(controls);
    }, []);

    // Layer switch
    const switchLayer = (key) => {
        setActiveLayer(key);
        setShowLayers(false);
        mapControls?.switchLayer(key);
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: mapTheme.appBg }}>

            {/* ══════ FULL-SCREEN MAP ══════ */}
            <div ref={riskMapWrapperRef} style={{ position: 'absolute', inset: 0 }}>
                <RiskMap
                    location={location}
                    currentLocationName={currentLocationName}
                    searchTarget={searchTarget}
                    realReports={realReports}
                    onRouteInfo={setRouteInfo}
                    onRouteSafety={setIsRouteRisky}
                    onControlsReady={onMapReady}
                />
            </div>

            {/* ══════ SAFETY WARNING OVERLAY ══════ */}
            {routeInfo && (routeInfo.isRisky || routeInfo.isCaution) && (
                <div style={{
                    position: 'absolute', top: 76, left: 12, right: 12, zIndex: 15,
                    background: routeInfo.isRisky ? 'rgba(239,68,68,0.95)' : 'rgba(245,158,11,0.95)', 
                    backdropFilter: 'blur(12px)',
                    borderRadius: 16, padding: '12px 16px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: routeInfo.isRisky ? '0 8px 32px rgba(239,68,68,0.4)' : '0 8px 32px rgba(245,158,11,0.4)',
                    animation: 'slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <AlertCircle size={24} style={{ color: routeInfo.isRisky ? 'white' : '#1e293b', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ color: routeInfo.isRisky ? 'white' : '#1e293b', fontSize: 13, fontWeight: 900, letterSpacing: 0.5 }}>
                            {routeInfo.isRisky ? 'DANGEROUS ROUTE' : 'CAUTION ADVISED'}
                        </div>
                        <div style={{ color: routeInfo.isRisky ? 'rgba(255,255,255,0.9)' : 'rgba(30,41,59,0.8)', fontSize: 11, marginTop: 1, fontWeight: 600 }}>
                            {routeInfo.isRisky ? 'This path enters a high-risk area. Avoid if possible.' : 'This path passes through a caution zone. Stay alert.'}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════ TOP OVERLAY ══════ */}
            <div style={{
                position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20,
                display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none'
            }}>
                {/* Search bar */}
                <div style={{ pointerEvents: 'auto' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: mapTheme.panelBg, backdropFilter: 'blur(16px)',
                        borderRadius: suggestions.length > 0 ? '16px 16px 0 0' : 16,
                        border: `1.5px solid ${searchFocused ? mapTheme.borderActive : mapTheme.border}`,
                        padding: '10px 14px', boxShadow: isLight ? '0 8px 24px rgba(15,23,42,0.12)' : '0 8px 32px rgba(0,0,0,0.5)',
                        transition: 'border-color 0.2s'
                    }}>
                        <Search size={17} style={{ color: mapTheme.textSoft, flexShrink: 0 }} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search destination…"
                            value={destination}
                            onChange={handleInput}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                            autoComplete="off"
                            spellCheck={false}
                            style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: mapTheme.textMain, fontSize: 14, fontWeight: 500,
                            }}
                        />
                        {isSearching && (
                            <div style={{
                                width: 16, height: 16, border: '2px solid rgba(59,130,246,0.4)',
                                borderTopColor: '#3b82f6', borderRadius: '50%',
                                animation: 'spin 0.7s linear infinite', flexShrink: 0
                            }} />
                        )}
                        {destination && !isSearching && (
                            <button onClick={clearSearch} style={{
                                background: isLight ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.3)', border: 'none', borderRadius: '50%',
                                width: 22, height: 22, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', color: mapTheme.textMuted,
                                flexShrink: 0, padding: 0
                            }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Suggestions dropdown */}
                    {suggestions.length > 0 && (
                        <div style={{
                            background: mapTheme.panelBgStrong, backdropFilter: 'blur(16px)',
                            border: '1.5px solid rgba(99,102,241,0.35)', borderTop: 'none',
                            borderRadius: '0 0 16px 16px',
                            boxShadow: isLight ? '0 16px 34px rgba(15,23,42,0.12)' : '0 16px 40px rgba(0,0,0,0.6)', overflow: 'hidden'
                        }}>
                            {suggestions.map((r, i) => {
                                const { title, subtitle } = formatSuggestion(r);
                                return (
                                    <button key={i} onMouseDown={() => pickSuggestion(r)} style={{
                                        width: '100%', padding: '11px 14px', display: 'flex',
                                        alignItems: 'flex-start', gap: 10, border: 'none',
                                        borderBottom: i < suggestions.length - 1 ? `1px solid ${mapTheme.border}` : 'none',
                                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                        transition: 'background 0.15s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <MapPin size={15} style={{ color: '#6366f1', flexShrink: 0, marginTop: 2 }} />
                                        <div>
                                            <div style={{ color: mapTheme.textMain, fontSize: 13, fontWeight: 600 }}>{title}</div>
                                            {subtitle && <div style={{ color: mapTheme.textSoft, fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* GPS status pill */}
                <div style={{
                    pointerEvents: 'auto', alignSelf: 'flex-start',
                    background: mapTheme.panelBg, backdropFilter: 'blur(16px)',
                    border: `1px solid ${location ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: 24, padding: '6px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: isLight ? '0 8px 20px rgba(15,23,42,0.12)' : '0 8px 24px rgba(0,0,0,0.5)',
                    maxWidth: 'calc(100vw - 40px)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: location ? '#10b981' : '#f59e0b',
                            boxShadow: location ? '0 0 12px rgba(16,185,129,0.5)' : '0 0 12px rgba(245,158,11,0.5)',
                            animation: location ? 'none' : 'pulse 1.5s ease-in-out infinite'
                        }} />
                        {isLocating && (
                             <div style={{
                                position: 'absolute', inset: -4,
                                border: '1.5px solid rgba(59,130,246,0.5)',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ 
                            color: location ? '#10b981' : '#f59e0b', 
                            fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                            textTransform: 'uppercase'
                        }}>
                            {location ? 'GPS Locked' : 'Locating…'}
                        </span>
                        {location && (
                            <span style={{ 
                                color: mapTheme.textMain, fontSize: 13, fontWeight: 600,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                                {currentLocationName || 'Finding location…'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════ RIGHT CONTROLS (like Google Maps) ══════ */}
            <div style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8
            }}>
                {/* Zoom In */}
                <MapControlBtn
                    onClick={() => mapControls?.zoomIn()}
                    title="Zoom in"
                >
                    <Plus size={18} />
                </MapControlBtn>

                {/* Zoom Out */}
                <MapControlBtn
                    onClick={() => mapControls?.zoomOut()}
                    title="Zoom out"
                >
                    <Minus size={18} />
                </MapControlBtn>

                <div style={{ height: 4 }} />

                {/* My Location */}
                <MapControlBtn
                    onClick={() => mapControls?.flyToUser()}
                    title="My location"
                    accent
                >
                    <Crosshair size={18} />
                </MapControlBtn>

                <div style={{ height: 4 }} />

                {/* Layer switcher */}
                <div style={{ position: 'relative' }}>
                    <MapControlBtn
                        onClick={() => setShowLayers(v => !v)}
                        title="Map type"
                    >
                        <Layers size={18} />
                    </MapControlBtn>
                    {showLayers && (
                        <div style={{
                            position: 'absolute', right: 46, top: '50%', transform: 'translateY(-50%)',
                            background: mapTheme.panelBgStrong, backdropFilter: 'blur(16px)',
                            border: `1px solid ${mapTheme.border}`, borderRadius: 14,
                            padding: '6px', display: 'flex', flexDirection: 'column', gap: 4,
                            minWidth: 120, boxShadow: isLight ? '0 8px 24px rgba(15,23,42,0.12)' : '0 8px 32px rgba(0,0,0,0.5)'
                        }}>
                            {LAYER_OPTIONS.map(opt => (
                                <button key={opt.key} onClick={() => switchLayer(opt.key)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 12px', borderRadius: 10, border: 'none',
                                        background: activeLayer === opt.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: activeLayer === opt.key ? '#6366f1' : mapTheme.textMuted,
                                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                        transition: 'all 0.15s', width: '100%', textAlign: 'left'
                                    }}
                                >
                                    <span>{opt.emoji}</span>
                                    <span>{opt.label}</span>
                                    {activeLayer === opt.key && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Safety Legend Toggle */}
                <div style={{ position: 'relative' }}>
                    <MapControlBtn
                        onClick={() => setShowLegend(v => !v)}
                        title="Safety Legend"
                        accent={showLegend}
                    >
                        <AlertCircle size={18} />
                    </MapControlBtn>
                    {showLegend && (
                        <div style={{
                            position: 'absolute', right: 46, bottom: 0,
                            background: mapTheme.panelBgStrong, backdropFilter: 'blur(20px)',
                            border: `1px solid ${mapTheme.border}`, borderRadius: 18,
                            padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
                            minWidth: 220, boxShadow: isLight ? '0 12px 32px rgba(15,23,42,0.12)' : '0 12px 48px rgba(0,0,0,0.6)',
                            zIndex: 30
                        }}>
                            <div style={{ color: mapTheme.textMain, fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Safety Legend</div>
                            
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 2, boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
                                <div>
                                    <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>High Risk Zone</div>
                                    <div style={{ color: mapTheme.textMuted, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>Areas with high reported incidents. Avoid walking alone or at night.</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 2, boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
                                <div>
                                    <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>Caution Zone</div>
                                    <div style={{ color: mapTheme.textMuted, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>Areas with low lighting or limited activity. Stay alert.</div>
                                </div>
                            </div>

                            <div style={{ height: 1, background: mapTheme.border, margin: '4px 0' }} />
                            
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 2, boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
                                <div>
                                    <div style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700 }}>Your Location</div>
                                    <div style={{ color: mapTheme.textMuted, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>Real-time GPS position with precision indicator.</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════ ROUTE INFO PANEL (bottom) ══════ */}
            {routeInfo && (
                <div style={{
                    position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 20,
                    background: mapTheme.panelBgStrong, backdropFilter: 'blur(20px)',
                    borderRadius: 20, padding: '16px 20px',
                    border: '1px solid rgba(59,130,246,0.3)',
                    boxShadow: isLight ? '0 -4px 28px rgba(15,23,42,0.12)' : '0 -4px 32px rgba(0,0,0,0.5)',
                    display: 'flex', gap: 20, alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 38, height: 38, background: 'rgba(59,130,246,0.15)',
                            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Clock size={18} style={{ color: '#6366f1' }} />
                        </div>
                        <div>
                            <div style={{ color: mapTheme.textMain, fontSize: 17, fontWeight: 800 }}>{routeInfo.duration}</div>
                            <div style={{ color: mapTheme.textSoft, fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>ETA</div>
                        </div>
                    </div>
                    <div style={{ width: 1, height: 36, background: mapTheme.border }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 38, height: 38, background: 'rgba(16,185,129,0.15)',
                            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Route size={18} style={{ color: '#10b981' }} />
                        </div>
                        <div>
                            <div style={{ color: mapTheme.textMain, fontSize: 17, fontWeight: 800 }}>{routeInfo.distance}</div>
                            <div style={{ color: mapTheme.textSoft, fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>DISTANCE</div>
                        </div>
                    </div>
                    <div style={{ width: 1, height: 36, background: mapTheme.border }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 38, height: 38, 
                            background: routeInfo.isRisky ? 'rgba(239,68,68,0.15)' : (routeInfo.isCaution ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'),
                            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Shield size={18} style={{ color: routeInfo.isRisky ? '#ef4444' : (routeInfo.isCaution ? '#f59e0b' : '#10b981') }} />
                        </div>
                        <div>
                            <div style={{ color: routeInfo.isRisky ? '#ef4444' : (routeInfo.isCaution ? '#f59e0b' : '#10b981'), fontSize: 17, fontWeight: 800 }}>
                                {routeInfo.isRisky ? 'LOW' : (routeInfo.isCaution ? 'MED' : 'HIGH')}
                            </div>
                            <div style={{ color: mapTheme.textSoft, fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>SAFETY</div>
                        </div>
                    </div>
                    <button onClick={() => { setRouteInfo(null); clearSearch(); }}
                        style={{
                            marginLeft: 'auto', background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                            padding: '6px 12px', color: '#ef4444', fontSize: 12,
                            fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5
                        }}>
                        END
                    </button>
                </div>
            )}

            {/* ══════ DESTINATION SELECTED CHIP (no route yet) ══════ */}
            {searchTarget && !routeInfo && (
                <div style={{
                    position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 20,
                    background: mapTheme.panelBgStrong, backdropFilter: 'blur(16px)',
                    borderRadius: 16, padding: '12px 16px',
                    border: '1px solid rgba(245,158,11,0.3)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: isLight ? '0 -4px 20px rgba(15,23,42,0.1)' : '0 -4px 24px rgba(0,0,0,0.4)'
                }}>
                    <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>CALCULATING ROUTE…</div>
                        <div style={{ color: mapTheme.textMuted, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {searchTarget.name}
                        </div>
                    </div>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(245,158,11,0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                </div>
            )}

            {/* Spin + pulse keyframes */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                @keyframes slideDown {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

// ──────────── Reusable map control button ────────────
function MapControlBtn({ onClick, children, title, accent }) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                width: 40, height: 40,
                background: accent ? 'rgba(99,102,241,0.15)' : (isLight ? 'rgba(248,250,252,0.95)' : 'rgba(15,23,42,0.88)'),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${accent ? 'rgba(99,102,241,0.5)' : (isLight ? 'rgba(148,163,184,0.45)' : 'rgba(71,85,105,0.5)')}`,
                borderRadius: 12,
                color: accent ? '#6366f1' : (isLight ? '#475569' : '#94a3b8'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: isLight ? '0 4px 16px rgba(15,23,42,0.12)' : '0 4px 16px rgba(0,0,0,0.4)',
                transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = accent ? 'rgba(99,102,241,0.25)' : (isLight ? 'rgba(226,232,240,0.95)' : 'rgba(30,41,59,0.95)');
                e.currentTarget.style.color = isLight ? '#0f172a' : '#f1f5f9';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = accent ? 'rgba(99,102,241,0.15)' : (isLight ? 'rgba(248,250,252,0.95)' : 'rgba(15,23,42,0.88)');
                e.currentTarget.style.color = accent ? '#6366f1' : (isLight ? '#475569' : '#94a3b8');
            }}
        >
            {children}
        </button>
    );
}
