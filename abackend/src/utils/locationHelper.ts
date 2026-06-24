import mongoose from "mongoose";
import Seller from "../models/Seller";
import { cache } from "./cache";

/** Upper bound for geo pre-filter (km). Per-seller radius is applied after. */
const MAX_SEARCH_RADIUS_KM = 50;
const SELLER_LOOKUP_CACHE_TTL = 3 * 60 * 1000;

function roundCoord(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function collectRadiusMatches(
  sellers: Array<{
    _id: mongoose.Types.ObjectId;
    location?: { coordinates?: number[] };
    serviceRadiusKm?: number;
    latitude?: string;
    longitude?: string;
  }>,
  userLat: number,
  userLng: number,
  nearbyIds: Map<string, mongoose.Types.ObjectId>
): void {
  for (const seller of sellers) {
    let sellerLat: number | null = null;
    let sellerLng: number | null = null;

    if (seller.location?.coordinates?.length === 2) {
      sellerLng = seller.location.coordinates[0];
      sellerLat = seller.location.coordinates[1];
    } else if (seller.latitude && seller.longitude) {
      sellerLat = parseFloat(seller.latitude);
      sellerLng = parseFloat(seller.longitude);
    }

    if (
      sellerLat === null ||
      sellerLng === null ||
      isNaN(sellerLat) ||
      isNaN(sellerLng) ||
      (sellerLat === 0 && sellerLng === 0)
    ) {
      continue;
    }

    const distance = calculateDistance(userLat, userLng, sellerLat, sellerLng);
    const serviceRadius = seller.serviceRadiusKm || 10;

    if (distance <= serviceRadius) {
      const id = seller._id as mongoose.Types.ObjectId;
      nearbyIds.set(id.toString(), id);
    }
  }
}

/**
 * Find sellers whose service area covers the user's location.
 */
export async function findSellersWithinRange(
  userLat: number,
  userLng: number
): Promise<mongoose.Types.ObjectId[]> {
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    return [];
  }

  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    return [];
  }

  const cacheKey = `nearby-sellers-${roundCoord(userLat)}-${roundCoord(userLng)}`;
  const cached = cache.get<mongoose.Types.ObjectId[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const point = { type: "Point" as const, coordinates: [userLng, userLat] };
    const radiusModeFilter = {
      status: "Approved",
      $or: [
        { serviceAreaMode: "radius" },
        { serviceAreaMode: { $exists: false } },
      ],
    };

    const [polygonSellers, geoRadiusSellers, legacyRadiusSellers] =
      await Promise.all([
        Seller.find({
          status: "Approved",
          serviceAreaMode: "polygon",
          serviceArea: { $geoIntersects: { $geometry: point } },
        }).select("_id"),
        Seller.find({
          ...radiusModeFilter,
          location: {
            $geoWithin: {
              $centerSphere: [
                [userLng, userLat],
                MAX_SEARCH_RADIUS_KM / 6378.1,
              ],
            },
          },
        }).select("_id location serviceRadiusKm latitude longitude"),
        Seller.find({
          ...radiusModeFilter,
          $and: [
            {
              $or: [
                { location: { $exists: false } },
                { location: null },
                { "location.coordinates.0": { $exists: false } },
              ],
            },
            { latitude: { $exists: true, $nin: ["", null] } },
            { longitude: { $exists: true, $nin: ["", null] } },
          ],
        })
          .select("_id location serviceRadiusKm latitude longitude")
          .limit(300),
      ]);

    const nearbyIds = new Map<string, mongoose.Types.ObjectId>();

    for (const seller of polygonSellers) {
      const id = seller._id as mongoose.Types.ObjectId;
      nearbyIds.set(id.toString(), id);
    }

    collectRadiusMatches(geoRadiusSellers, userLat, userLng, nearbyIds);
    collectRadiusMatches(legacyRadiusSellers, userLat, userLng, nearbyIds);

    const result = Array.from(nearbyIds.values());
    cache.set(cacheKey, result, SELLER_LOOKUP_CACHE_TTL);
    return result;
  } catch (error) {
    console.error("Error finding nearby sellers:", error);
    return [];
  }
}
