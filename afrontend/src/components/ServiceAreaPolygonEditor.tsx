import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api";

export type GeoPolygon = {
  type: "Polygon";
  coordinates: number[][][]; // [[[lng, lat], ...]]
};

export interface ServiceAreaPolygonEditorProps {
  value: GeoPolygon | null | undefined;
  center: { lat: number; lng: number };
  onChange: (value: GeoPolygon | null) => void;
  disabled?: boolean;
  height?: string;
}

const containerStyle = { width: "100%", height: "100%" };

type Libraries = ("places" | "drawing" | "geometry" | "visualization")[];
const libraries: Libraries = ["places", "geometry"];

const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

const polygonOptions: google.maps.PolygonOptions = {
  strokeColor: "#0d9488",
  strokeOpacity: 0.95,
  strokeWeight: 2,
  fillColor: "#14b8a6",
  fillOpacity: 0.18,
  clickable: false,
  editable: false,
  draggable: false,
  zIndex: 1,
};

function ringFromValue(value: GeoPolygon | null | undefined): { lat: number; lng: number }[] {
  if (!value || value.type !== "Polygon") return [];
  const ring = value.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 1) return [];
  // Strip the closing duplicate so vertex markers are 1:1 with distinct points.
  const open =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  return open.map(([lng, lat]) => ({ lat, lng }));
}

function buildGeoPolygon(points: { lat: number; lng: number }[]): GeoPolygon | null {
  if (points.length < 3) return null;
  const ring = points.map((p) => [p.lng, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: "Polygon", coordinates: [ring] };
}

// Spherical-excess fallback (km²) so we still render a sensible readout if the
// geometry library failed to load for any reason.
function sphericalPolygonAreaKm2(points: { lat: number; lng: number }[]): number {
  const n = points.length;
  if (n < 3) return 0;
  const R = 6378.137;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    area +=
      toRad(p2.lng - p1.lng) *
      (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs((area * R * R) / 2);
}

export default function ServiceAreaPolygonEditor({
  value,
  center,
  onChange,
  disabled = false,
  height = "360px",
}: ServiceAreaPolygonEditorProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [points, setPoints] = useState<{ lat: number; lng: number }[]>(() =>
    ringFromValue(value)
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const didFitRef = useRef(false);

  // The Google Maps click listener captures whichever callback we pass at the
  // moment GoogleMap mounts; @react-google-maps/api v2.20 doesn't always
  // re-attach the listener when the JSX prop changes. To avoid the listener
  // firing with a stale `points = []` closure (which would make every click
  // replace the polygon with a single point), we route everything through
  // refs that always hold the latest values.
  const pointsRef = useRef(points);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setPoints(ringFromValue(value));
  }, [value]);

  // Recenter when the seller's anchor location changes, only if the editor is empty.
  useEffect(() => {
    if (
      map &&
      points.length === 0 &&
      Number.isFinite(center.lat) &&
      Number.isFinite(center.lng) &&
      (center.lat !== 0 || center.lng !== 0)
    ) {
      map.panTo(center);
    }
  }, [map, center.lat, center.lng, points.length]);

  // Fit the viewport to the polygon the first time a saved value loads.
  useEffect(() => {
    if (!map || didFitRef.current || points.length < 3) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 32);
    didFitRef.current = true;
  }, [map, points]);

  const initialCenter = useMemo(() => {
    if (
      Number.isFinite(center.lat) &&
      Number.isFinite(center.lng) &&
      (center.lat !== 0 || center.lng !== 0)
    ) {
      return center;
    }
    return FALLBACK_CENTER;
  }, [center.lat, center.lng]);

  const polygonPath = useMemo(() => points, [points]);

  // Stable commit - reads/writes through refs so it's safe to call from any
  // closure age (including listeners that were set up at mount time).
  const commit = useCallback((next: { lat: number; lng: number }[]) => {
    pointsRef.current = next;
    setPoints(next);
    onChangeRef.current(buildGeoPolygon(next));
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (disabledRef.current || !e.latLng) return;
      const lat = parseFloat(e.latLng.lat().toFixed(6));
      const lng = parseFloat(e.latLng.lng().toFixed(6));
      commit([...pointsRef.current, { lat, lng }]);
    },
    [commit]
  );

  const handleVertexDrag = useCallback(
    (index: number, e: google.maps.MapMouseEvent) => {
      if (disabledRef.current || !e.latLng) return;
      const lat = parseFloat(e.latLng.lat().toFixed(6));
      const lng = parseFloat(e.latLng.lng().toFixed(6));
      const next = pointsRef.current.slice();
      next[index] = { lat, lng };
      commit(next);
    },
    [commit]
  );

  const handleVertexDelete = useCallback(
    (index: number) => {
      if (disabledRef.current) return;
      commit(pointsRef.current.filter((_, i) => i !== index));
    },
    [commit]
  );

  const handleUndo = useCallback(() => {
    if (disabledRef.current || pointsRef.current.length === 0) return;
    commit(pointsRef.current.slice(0, -1));
  }, [commit]);

  const handleClear = useCallback(() => {
    if (disabledRef.current || pointsRef.current.length === 0) return;
    commit([]);
  }, [commit]);

  // Live area in km². Prefer Google's geometry library; fall back to the local
  // spherical-excess implementation if it's unavailable.
  const areaKm2 = useMemo(() => {
    if (points.length < 3) return 0;
    if (isLoaded) {
      const sphericalApi = (window as any).google?.maps?.geometry?.spherical;
      if (sphericalApi) {
        const path = points.map(
          (p) => new (window as any).google.maps.LatLng(p.lat, p.lng)
        );
        return sphericalApi.computeArea(path) / 1_000_000;
      }
    }
    return sphericalPolygonAreaKm2(points);
  }, [isLoaded, points]);

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
      clickableIcons: false,
    }),
    []
  );

  if (loadError) {
    return (
      <div
        className="w-full bg-red-50 border border-red-200 rounded-lg flex items-center justify-center text-sm text-red-700 p-4"
        style={{ height }}
      >
        Failed to load Google Maps. Check that VITE_GOOGLE_MAPS_API_KEY is set
        and the key is enabled for the Maps JavaScript API.
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        className="w-full bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center text-sm text-amber-800 p-4 text-center"
        style={{ height }}
      >
        Google Maps API key is missing. Set <code className="mx-1 px-1 rounded bg-amber-100">VITE_GOOGLE_MAPS_API_KEY</code> in
        <code className="mx-1 px-1 rounded bg-amber-100">afrontend/.env</code> and restart the dev server.
      </div>
    );
  }

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
    <div className="space-y-2">
      <div
        className="relative w-full rounded-lg overflow-hidden border border-neutral-300 shadow-sm"
        style={{ height }}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={initialCenter}
          zoom={14}
          onLoad={setMap}
          onUnmount={() => setMap(null)}
          onClick={handleMapClick}
          options={mapOptions}
        >
          {polygonPath.length >= 3 && (
            <Polygon paths={polygonPath} options={polygonOptions} />
          )}
          {points.map((p, idx) => (
            <MarkerF
              key={`${idx}-${p.lat}-${p.lng}`}
              position={p}
              draggable={!disabled}
              onDragEnd={(e) => handleVertexDrag(idx, e)}
              onRightClick={() => handleVertexDelete(idx)}
              zIndex={500 + idx}
              label={{
                text: String(idx + 1),
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "600",
              }}
            />
          ))}
        </GoogleMap>

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-[11px] text-white pointer-events-none">
          <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur-sm">
            {points.length === 0
              ? "Tap on the map to add points"
              : points.length < 3
              ? `${points.length} point${points.length === 1 ? "" : "s"} - need at least 3`
              : `${points.length} points - ~${areaKm2.toFixed(2)} km²`}
          </span>
          <span className="px-2 py-1 rounded-md bg-black/55 backdrop-blur-sm hidden sm:inline">
            Drag pins to fine-tune. Right-click a pin to delete it.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={disabled || points.length === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Undo last
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || points.length === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <span className="ml-auto text-[11px] text-neutral-500">
          A polygon needs at least 3 points; it will close automatically.
        </span>
      </div>
    </div>
  );
}
