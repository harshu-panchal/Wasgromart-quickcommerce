import mongoose from "mongoose";
import Seller from "../models/Seller";

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
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

/**
 * Find sellers whose service area covers the user's location.
 *
 * Two parallel paths are unioned:
 *   1. Polygon sellers ($geoIntersects on the manually-drawn `serviceArea`).
 *   2. Radius / legacy sellers (`location` Point + `serviceRadiusKm`, filtered
 *      with the existing in-process Haversine check).
 *
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @returns Deduplicated array of seller IDs that include the user's point
 */
export async function findSellersWithinRange(
  userLat: number,
  userLng: number
): Promise<mongoose.Types.ObjectId[]> {
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    console.log("DEBUG: findSellersWithinRange - INVALID USER COORDINATES", { userLat, userLng });
    return [];
  }

  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    console.log("DEBUG: findSellersWithinRange - USER COORDINATES OUT OF RANGE", { userLat, userLng });
    return [];
  }

  try {
    const point = { type: "Point" as const, coordinates: [userLng, userLat] };

    const [polygonSellers, radiusSellers] = await Promise.all([
      Seller.find({
        status: "Approved",
        serviceAreaMode: "polygon",
        serviceArea: { $geoIntersects: { $geometry: point } },
      }).select("_id storeName"),
      Seller.find({
        status: "Approved",
        $or: [
          { serviceAreaMode: "radius" },
          { serviceAreaMode: { $exists: false } },
        ],
      }).select("_id location serviceRadiusKm latitude longitude storeName"),
    ]);

    const nearbyIds = new Map<string, mongoose.Types.ObjectId>();

    for (const seller of polygonSellers) {
      const id = seller._id as mongoose.Types.ObjectId;
      nearbyIds.set(id.toString(), id);
    }

    for (const seller of radiusSellers) {
      let sellerLat: number | null = null;
      let sellerLng: number | null = null;

      if (
        seller.location &&
        seller.location.coordinates &&
        seller.location.coordinates.length === 2
      ) {
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
        isNaN(sellerLng)
      ) {
        continue;
      }
      if (sellerLat === 0 && sellerLng === 0) continue;

      const distance = calculateDistance(userLat, userLng, sellerLat, sellerLng);
      const serviceRadius = seller.serviceRadiusKm || 10;

      if (distance <= serviceRadius) {
        const id = seller._id as mongoose.Types.ObjectId;
        nearbyIds.set(id.toString(), id);
      }
    }

    console.log(
      `DEBUG: findSellersWithinRange - polygon=${polygonSellers.length}, radius=${radiusSellers.length}, total=${nearbyIds.size}`
    );
    return Array.from(nearbyIds.values());
  } catch (error) {
    console.error("Error finding nearby sellers:", error);
    return [];
  }
}
