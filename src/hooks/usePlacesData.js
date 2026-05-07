import { useState, useEffect } from 'react';

/**
 * Queries OpenStreetMap (Overpass API) to find real structural context nearby.
 * Fully open source, no API key required.
 */
export default function usePlacesData(location) {
    const [placesContext, setPlacesContext] = useState({
        nearPolice: false,
        noNearbyPlaces: false,
        nearHospital: false,
        nearRiskyZone: false,
        isSearching: false
    });

    useEffect(() => {
        if (!location) return;

        let isMounted = true;
        setPlacesContext(prev => ({ ...prev, isSearching: true }));

        const fetchPlaces = async () => {
            try {
                // 1. Check for police and hospitals within 1km
                const query = `
                    [out:json][timeout:10];
                    (
                        node["amenity"~"police|hospital"](around:1000,${location.lat},${location.lng});
                        way["amenity"~"police|hospital"](around:1000,${location.lat},${location.lng});
                    );
                    out body;
                `;
                const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
                const json = await res.json();
                if (!isMounted) return;

                const elements = json.elements || [];
                const nearPolice = elements.some(e => e.tags && e.tags.amenity === 'police');
                const nearHospital = elements.some(e => e.tags && e.tags.amenity === 'hospital');

                // 2. Check for overall amenity density to compute isolation (500m radius)
                const isoQuery = `[out:json][timeout:5];node["amenity"](around:500,${location.lat},${location.lng});out count;`;
                const isoRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(isoQuery)}`);
                const isoJson = await isoRes.json();

                let noNearbyPlaces = true;
                if (isoJson.elements && isoJson.elements.length > 0 && isoJson.elements[0].tags) {
                    noNearbyPlaces = (isoJson.elements[0].tags.nodes || 0) < 3;
                }

                setPlacesContext({
                    nearPolice,
                    nearHospital,
                    noNearbyPlaces,
                    nearRiskyZone: noNearbyPlaces,
                    isSearching: false
                });

            } catch (e) {
                if (isMounted) {
                    // Fallback conservatively
                    setPlacesContext({
                        nearPolice: false,
                        nearHospital: false,
                        noNearbyPlaces: true,
                        nearRiskyZone: true,
                        isSearching: false
                    });
                }
            }
        };

        fetchPlaces();

        return () => { isMounted = false; };
    }, [location]);

    return placesContext;
}
