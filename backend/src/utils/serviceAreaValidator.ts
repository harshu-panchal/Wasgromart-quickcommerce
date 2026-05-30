/**
 * Validation helpers for the seller `serviceAreaMode` + `serviceArea` fields
 * shared by the admin `updateSeller`, the seller `register`, and the seller
 * `updateProfile` controllers so the rules cannot drift between paths.
 */

export type ServiceAreaMode = 'radius' | 'polygon';

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

const MAX_VERTICES = 500;

export interface ValidatedServiceArea {
  mode?: ServiceAreaMode;
  area?: GeoPolygon | null; // null means: clear it
}

export interface ServiceAreaValidationError {
  message: string;
}

/**
 * Validates and normalizes the `serviceAreaMode` / `serviceArea` pair from a
 * request body. Returns either the normalized fields ready to persist or a
 * single error message describing the first problem encountered.
 *
 * - When mode is omitted, area is also expected to be omitted (caller decides
 *   whether to update the existing values).
 * - When mode is 'radius', a serviceArea may be sent as `null` to clear an old
 *   polygon, or omitted to keep it as-is. A non-null polygon alongside radius
 *   mode is silently kept (so users can flip back later) but it is not used
 *   for filtering.
 * - When mode is 'polygon', a valid GeoJSON Polygon is required.
 */
export function validateServiceArea(body: any): ValidatedServiceArea | ServiceAreaValidationError {
  const hasMode = body.serviceAreaMode !== undefined;
  const hasArea = body.serviceArea !== undefined;

  if (!hasMode && !hasArea) {
    return {};
  }

  let mode: ServiceAreaMode | undefined;
  if (hasMode) {
    if (body.serviceAreaMode !== 'radius' && body.serviceAreaMode !== 'polygon') {
      return { message: "serviceAreaMode must be 'radius' or 'polygon'" };
    }
    mode = body.serviceAreaMode;
  }

  let area: GeoPolygon | null | undefined;
  if (hasArea) {
    if (body.serviceArea === null) {
      area = null;
    } else {
      const result = validatePolygon(body.serviceArea);
      if ('message' in result) return result;
      area = result;
    }
  }

  if (mode === 'polygon' && area == null) {
    return { message: 'A service area polygon is required when serviceAreaMode is "polygon"' };
  }

  return { mode, area };
}

function validatePolygon(value: any): GeoPolygon | ServiceAreaValidationError {
  if (!value || typeof value !== 'object') {
    return { message: 'serviceArea must be a GeoJSON Polygon object' };
  }
  if (value.type !== 'Polygon') {
    return { message: 'serviceArea.type must be "Polygon"' };
  }
  const coords = value.coordinates;
  if (!Array.isArray(coords) || coords.length !== 1) {
    return { message: 'serviceArea.coordinates must contain exactly one linear ring' };
  }
  const ring = coords[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return { message: 'Polygon ring must have at least 4 coordinates (3 distinct points + closing point)' };
  }
  if (ring.length > MAX_VERTICES) {
    return { message: `Polygon cannot have more than ${MAX_VERTICES} vertices` };
  }

  const sanitizedRing: number[][] = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length !== 2) {
      return { message: 'Each polygon coordinate must be a [lng, lat] pair' };
    }
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return { message: 'Polygon coordinates must be finite numbers' };
    }
    if (lng < -180 || lng > 180) {
      return { message: 'Longitude must be between -180 and 180' };
    }
    if (lat < -90 || lat > 90) {
      return { message: 'Latitude must be between -90 and 90' };
    }
    sanitizedRing.push([lng, lat]);
  }

  const first = sanitizedRing[0];
  const last = sanitizedRing[sanitizedRing.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { message: 'Polygon ring must be closed (first and last point identical)' };
  }

  // Reject degenerate rings where all distinct vertices collapse to one point.
  const distinct = new Set(sanitizedRing.slice(0, -1).map((p) => `${p[0]},${p[1]}`));
  if (distinct.size < 3) {
    return { message: 'Polygon must have at least 3 distinct vertices' };
  }

  return { type: 'Polygon', coordinates: [sanitizedRing] };
}
