import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, Circle, Polygon, InfoWindow } from '@react-google-maps/api';
import type { ServiceAreaPolygon } from '../../../services/api/sellerService';

type Libraries = ('places' | 'drawing' | 'geometry' | 'visualization')[];
const libraries: Libraries = ['places', 'geometry'];

const containerStyle = { width: '100%', height: '100%' };

const STORE_ICON_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><text x="6" y="28" font-size="28">🏪</text></svg>'
)}`;

interface SellerServiceMapProps {
  latitude: number;
  longitude: number;
  radiusKm: number;
  storeName: string;
  serviceAreaMode?: 'radius' | 'polygon';
  serviceArea?: ServiceAreaPolygon | null;
}

export default function SellerServiceMap({
  latitude,
  longitude,
  radiusKm,
  storeName,
  serviceAreaMode,
  serviceArea,
}: SellerServiceMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
  });

  const center = useMemo(
    () => ({ lat: latitude, lng: longitude }),
    [latitude, longitude]
  );

  const polygonPaths = useMemo<{ lat: number; lng: number }[]>(() => {
    if (
      serviceAreaMode !== 'polygon' ||
      !serviceArea ||
      serviceArea.type !== 'Polygon' ||
      !Array.isArray(serviceArea.coordinates) ||
      !Array.isArray(serviceArea.coordinates[0])
    ) {
      return [];
    }
    return serviceArea.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
  }, [serviceAreaMode, serviceArea]);

  const showPolygon = polygonPaths.length >= 3;
  const validRadius =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(radiusKm) &&
    radiusKm > 0;

  const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  useEffect(() => {
    if (!map || !hasValidCoords) return;

    if (showPolygon && polygonPaths.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      polygonPaths.forEach((p) => bounds.extend(p));
      bounds.extend(center);
      map.fitBounds(bounds, 32);
    } else if (validRadius) {
      const bounds = new window.google.maps.Circle({
        center,
        radius: radiusKm * 1000,
      }).getBounds();
      if (bounds) {
        map.fitBounds(bounds, 32);
      }
    } else {
      map.panTo(center);
    }
  }, [map, hasValidCoords, center, showPolygon, polygonPaths, validRadius, radiusKm]);

  if (loadError) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-red-200 bg-red-50 flex items-center justify-center text-sm text-red-700 p-4 text-center">
        Failed to load Google Maps. Check the API key configuration.
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-amber-200 bg-amber-50 flex items-center justify-center text-sm text-amber-800 p-4 text-center">
        Set <code className="mx-1 px-1 rounded bg-amber-100">VITE_GOOGLE_MAPS_API_KEY</code> in
        <code className="mx-1 px-1 rounded bg-amber-100">afrontend/.env</code> to load the map.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 flex items-center justify-center text-sm text-neutral-500">
        Loading map...
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        }}
      >
        {hasValidCoords && (
          <MarkerF
            position={center}
            title={storeName}
            icon={{
              url: STORE_ICON_URL,
              scaledSize: new window.google.maps.Size(36, 36),
              anchor: new window.google.maps.Point(18, 18),
            }}
            onClick={() => setInfoWindowOpen(true)}
          >
            {infoWindowOpen && (
              <InfoWindow onCloseClick={() => setInfoWindowOpen(false)}>
                <div style={{ fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{storeName}</div>
                  <div style={{ color: '#525252' }}>
                    {showPolygon ? 'Polygon service area' : `Service Radius: ${radiusKm} km`}
                  </div>
                </div>
              </InfoWindow>
            )}
          </MarkerF>
        )}

        {showPolygon && (
          <Polygon
            paths={polygonPaths}
            options={{
              strokeColor: '#0D9488',
              strokeOpacity: 0.95,
              strokeWeight: 2,
              fillColor: '#14b8a6',
              fillOpacity: 0.18,
              clickable: false,
            }}
          />
        )}

        {!showPolygon && validRadius && (
          <Circle
            center={center}
            radius={radiusKm * 1000}
            options={{
              strokeColor: '#0D9488',
              strokeOpacity: 0.95,
              strokeWeight: 2,
              fillColor: '#14b8a6',
              fillOpacity: 0.2,
              clickable: false,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
