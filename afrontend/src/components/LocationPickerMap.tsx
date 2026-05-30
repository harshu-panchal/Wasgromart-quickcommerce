import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Circle, GoogleMap, MarkerF, Polygon, useJsApiLoader } from '@react-google-maps/api';

interface LocationPickerMapProps {
  initialLat: number;
  initialLng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: string;
  /** When > 0, draws a service-radius circle (in km) around the pin. */
  radiusKm?: number;
  /** Optional polygon to render as a read-only overlay (GeoJSON [[[lng,lat], ...]]). */
  polygon?: { type: 'Polygon'; coordinates: number[][][] } | null;
  /**
   * When false, the marker is locked: clicks on the map and drags on the marker
   * no longer move the store location. Useful when the seller is busy editing a
   * service-area polygon below and we don't want stray clicks to relocate the
   * store pin.
   */
  interactive?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629,
};

type Libraries = ("places" | "drawing" | "geometry" | "visualization")[];
const libraries: Libraries = ['places', 'geometry'];

export default function LocationPickerMap({
  initialLat,
  initialLng,
  onLocationSelect,
  height = "300px",
  radiusKm,
  polygon,
  interactive = true,
}: LocationPickerMapProps) {
  // Use the same ID and libraries as GoogleMapsAutocomplete to share the script
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(defaultCenter);
  const didInitialFitRef = useRef(false);

  const numericLat = useMemo(
    () => (typeof initialLat === 'number' ? initialLat : parseFloat(initialLat as any)),
    [initialLat]
  );
  const numericLng = useMemo(
    () => (typeof initialLng === 'number' ? initialLng : parseFloat(initialLng as any)),
    [initialLng]
  );
  const hasValidCoords =
    isFinite(numericLat) && isFinite(numericLng) && (numericLat !== 0 || numericLng !== 0);

  // Pan / fit the map when the saved coordinates change (e.g. user picks a
  // place from autocomplete, or we just loaded the seller's profile). We do
  // NOT touch the marker position from here - the marker is bound directly to
  // the saved coords, so it's always anchored correctly.
  useEffect(() => {
    if (!hasValidCoords) return;
    if (!map) {
      setCenter({ lat: numericLat, lng: numericLng });
      return;
    }

    if (radiusKm && radiusKm > 0) {
      const bounds = new google.maps.Circle({
        center: { lat: numericLat, lng: numericLng },
        radius: radiusKm * 1000,
      }).getBounds();
      if (bounds) {
        map.fitBounds(bounds, 48);
        didInitialFitRef.current = true;
        return;
      }
    }
    map.panTo({ lat: numericLat, lng: numericLng });
  }, [numericLat, numericLng, hasValidCoords, map, radiusKm]);

  // When the radius itself changes (and we have valid coords), refit so the
  // whole circle stays visible.
  useEffect(() => {
    if (!map || !hasValidCoords) return;
    if (!radiusKm || radiusKm <= 0) return;
    const bounds = new google.maps.Circle({
      center: { lat: numericLat, lng: numericLng },
      radius: radiusKm * 1000,
    }).getBounds();
    if (bounds) map.fitBounds(bounds, 48);
  }, [radiusKm, map, hasValidCoords, numericLat, numericLng]);

  // First time we mount with valid coords + radius, make sure the circle is
  // framed (the pan effect above already handles this, but a polygon-only
  // overlay still benefits from a fit).
  useEffect(() => {
    if (!map || didInitialFitRef.current || !hasValidCoords) return;
    if (polygon && polygon.type === 'Polygon' && polygon.coordinates?.[0]?.length >= 3) {
      const bounds = new google.maps.LatLngBounds();
      polygon.coordinates[0].forEach(([lng, lat]) => bounds.extend({ lat, lng }));
      bounds.extend({ lat: numericLat, lng: numericLng });
      map.fitBounds(bounds, 48);
      didInitialFitRef.current = true;
    }
  }, [map, polygon, hasValidCoords, numericLat, numericLng]);

  const polygonPath = useMemo(() => {
    if (!polygon || polygon.type !== 'Polygon') return null;
    const ring = polygon.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    return ring.map(([lng, lat]) => ({ lat, lng }));
  }, [polygon]);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    draggable: true,
    gestureHandling: "greedy",
  }), []);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(_map: google.maps.Map) {
    setMap(null);
  }, []);

  // Fired only when the user explicitly moves the pin (drags marker or clicks
  // the map). This is the ONLY path that updates the saved location.
  const emitLocation = useCallback(
    (lat: number, lng: number) => {
      onLocationSelect(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
    },
    [onLocationSelect]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!interactive || !e.latLng) return;
      emitLocation(e.latLng.lat(), e.latLng.lng());
    },
    [emitLocation, interactive]
  );

  const handleMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!interactive || !e.latLng) return;
      emitLocation(e.latLng.lat(), e.latLng.lng());
    },
    [emitLocation, interactive]
  );

  const handleFitToServiceArea = useCallback(() => {
    if (!map || !hasValidCoords) return;
    if (radiusKm && radiusKm > 0) {
      const bounds = new google.maps.Circle({
        center: { lat: numericLat, lng: numericLng },
        radius: radiusKm * 1000,
      }).getBounds();
      if (bounds) map.fitBounds(bounds, 48);
      return;
    }
    if (polygonPath && polygonPath.length >= 3) {
      const bounds = new google.maps.LatLngBounds();
      polygonPath.forEach((p) => bounds.extend(p));
      bounds.extend({ lat: numericLat, lng: numericLng });
      map.fitBounds(bounds, 48);
    }
  }, [map, hasValidCoords, radiusKm, numericLat, numericLng, polygonPath]);

  // Pick a starting zoom that already shows a reasonable chunk of the
  // service area; we still call fitBounds once the map is ready, so this is
  // mostly to avoid flashing a fully-zoomed-in view on first paint.
  const initialZoom = radiusKm && radiusKm > 0 ? 12 : 17;

  if (!isLoaded) {
    return (
      <div
        className="w-full bg-neutral-100 animate-pulse rounded-lg border border-neutral-300"
        style={{ height }}
      >
        <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
          Loading Map...
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-neutral-300 shadow-sm" style={{ height }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={initialZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {radiusKm && radiusKm > 0 && hasValidCoords && (
          <Circle
            center={{ lat: numericLat, lng: numericLng }}
            radius={radiusKm * 1000}
            options={{
              strokeColor: '#0d9488',
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: '#14b8a6',
              fillOpacity: 0.15,
              clickable: false,
              draggable: false,
              editable: false,
              zIndex: 1,
            }}
          />
        )}
        {polygonPath && polygonPath.length >= 3 && (
          <Polygon
            paths={polygonPath}
            options={{
              strokeColor: '#0d9488',
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: '#14b8a6',
              fillOpacity: 0.15,
              clickable: false,
              draggable: false,
              editable: false,
              zIndex: 1,
            }}
          />
        )}
        {hasValidCoords && (
          <MarkerF
            position={{ lat: numericLat, lng: numericLng }}
            draggable={interactive}
            onDragEnd={handleMarkerDragEnd}
            title={interactive ? 'Drag to set your store location' : 'Store location'}
            zIndex={999}
            animation={
              typeof window !== 'undefined' && window.google?.maps?.Animation
                ? window.google.maps.Animation.DROP
                : undefined
            }
          />
        )}
      </GoogleMap>

      {((radiusKm && radiusKm > 0) || (polygonPath && polygonPath.length >= 3)) && (
        <button
          type="button"
          onClick={handleFitToServiceArea}
          className="absolute top-2 left-2 z-10 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/95 hover:bg-white border border-neutral-300 shadow-sm text-neutral-700"
        >
          Fit service area
        </button>
      )}

      <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none flex justify-center">
        <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur-sm text-white text-[11px] text-center">
          {interactive
            ? "Drag the pin or click on the map to update your store's exact location"
            : "Store location is locked while you draw the service-area polygon below"}
        </span>
      </div>
    </div>
  );
}
