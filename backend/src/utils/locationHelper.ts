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
 * Find sellers whose service radius covers the user's location
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @returns Array of seller IDs within range
 */
export async function findSellersWithinRange(
  userLat: number,
  userLng: number
): Promise<mongoose.Types.ObjectId[]> {
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    console.log("DEBUG: findSellersWithinRange - INVALID USER COORDINATES", { userLat, userLng });
    return [];
  }

  // Validate coordinates
  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    console.log("DEBUG: findSellersWithinRange - USER COORDINATES OUT OF RANGE", { userLat, userLng });
    return [];
  }

  try {
    // Fetch all approved sellers with location
    const sellers = await Seller.find({
      status: "Approved",
    }).select("_id location serviceRadiusKm latitude longitude storeName");

    // Filter sellers where user is within their service radius
    const nearbySellerIds: mongoose.Types.ObjectId[] = [];
    console.log(`DEBUG: findSellersWithinRange - Total Approved sellers found: ${sellers.length}`);

    for (const seller of sellers) {
      let sellerLat: number | null = null;
      let sellerLng: number | null = null;

      // Try GeoJSON first
      if (seller.location && seller.location.coordinates && seller.location.coordinates.length === 2) {
        sellerLng = seller.location.coordinates[0];
        sellerLat = seller.location.coordinates[1];
      }
      // Fallback to string fields if GeoJSON missing
      else if (seller.latitude && seller.longitude) {
         sellerLat = parseFloat(seller.latitude);
         sellerLng = parseFloat(seller.longitude);
      }

      if (sellerLat !== null && sellerLng !== null && !isNaN(sellerLat) && !isNaN(sellerLng)) {
        // Basic check for 0,0 coordinates
        if (sellerLat === 0 && sellerLng === 0) {
          console.log(`DEBUG: Seller ${seller._id} (${seller.storeName}) skipped - COORDINATES ARE 0,0`);
          continue;
        }

        const distance = calculateDistance(
          userLat,
          userLng,
          sellerLat,
          sellerLng
        );
        const serviceRadius = seller.serviceRadiusKm || 10; // Default to 10km if not set

        console.log(`DEBUG: Seller ${seller._id} (${seller.storeName}) - Distance: ${distance.toFixed(2)}km, Radius: ${serviceRadius}km`);

        if (distance <= serviceRadius) {
          nearbySellerIds.push(seller._id as mongoose.Types.ObjectId);
        }
      } else {
        console.log(`DEBUG: Seller ${seller._id} (${seller.storeName}) skipped - MISSING OR INVALID COORDINATES`, {
          lat: sellerLat,
          lng: sellerLng,
          rawLat: seller.latitude,
          rawLng: seller.longitude,
          hasLoc: !!seller.location
        });
      }
    }

    console.log(`DEBUG: findSellersWithinRange - Final nearbySellerIds count: ${nearbySellerIds.length}`);
    return nearbySellerIds;
  } catch (error) {
    console.error("Error finding nearby sellers:", error);
    return [];
  }
}
