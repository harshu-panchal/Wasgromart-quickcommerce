
import { Request, Response } from 'express';
import Wishlist from '../../../models/Wishlist';
import Product from '../../../models/Product';
import { findSellersWithinRange } from '../../../utils/locationHelper';
import {
    isSellerAvailableForOrder,
    sortProductsBySellerRange,
    withShopPresentation,
} from '../../../utils/productPresentation';

export const getWishlist = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { latitude, longitude } = req.query;

        // Parse location
        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;

        const nearbySellerIds =
            userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)
                ? await findSellersWithinRange(userLat, userLng)
                : [];

        let wishlist = await Wishlist.findOne({ customer: userId }).populate({
            path: 'products',
            match: {
                status: 'Active',
                publish: true,
            },
            populate: {
                path: 'seller',
                select: 'storeName sellerName location serviceRadiusKm isShopOpen'
            }
        });

        if (!wishlist) {
            // Return empty if not created yet
            wishlist = new Wishlist({ customer: userId, products: [] });
        }

        const wishlistData = wishlist.toObject();
        wishlistData.products = sortProductsBySellerRange(
            (wishlistData.products as any[]).map((product: any) => ({
                ...withShopPresentation(product),
                isAvailable: isSellerAvailableForOrder(product.seller, nearbySellerIds),
            })),
            nearbySellerIds
        ) as any;

        return res.status(200).json({
            success: true,
            data: wishlistData
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching wishlist',
            error: error.message
        });
    }
};

export const addToWishlist = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId } = req.body;
        const { latitude, longitude } = req.query;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Verify the product exists. Out-of-range products may still be saved;
        // ordering remains blocked by the cart/order availability checks.
        const product = await Product.findOne({ _id: productId, status: 'Active', publish: true });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
        }

        const userLat = latitude ? parseFloat(latitude as string) : null;
        const userLng = longitude ? parseFloat(longitude as string) : null;
        const nearbySellerIds =
            userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)
                ? await findSellersWithinRange(userLat, userLng)
                : [];

        let wishlist = await Wishlist.findOne({ customer: userId });

        if (!wishlist) {
            wishlist = await Wishlist.create({ customer: userId, products: [productId] });
        } else {
            // Add if not exists
            if (!wishlist.products.includes(productId)) {
                wishlist.products.push(productId);
                await wishlist.save();
            }
        }

        const populatedWishlist = await wishlist.populate({
            path: 'products',
            match: { status: 'Active', publish: true },
            populate: {
                path: 'seller',
                select: 'storeName sellerName isShopOpen'
            }
        });

        const wishlistData = populatedWishlist.toObject();
        wishlistData.products = sortProductsBySellerRange(
            (wishlistData.products as any[]).map((wishlistProduct: any) => ({
                ...withShopPresentation(wishlistProduct),
                isAvailable: isSellerAvailableForOrder(
                    wishlistProduct.seller,
                    nearbySellerIds
                ),
            })),
            nearbySellerIds
        ) as any;

        return res.status(200).json({
            success: true,
            message: 'Added to wishlist',
            data: wishlistData
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding to wishlist',
            error: error.message
        });
    }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId } = req.params;

        const wishlist = await Wishlist.findOne({ customer: userId });

        if (wishlist) {
            wishlist.products = wishlist.products.filter(p => p.toString() !== productId);
            await wishlist.save();
            await wishlist.populate('products');
        }

        return res.status(200).json({
            success: true,
            message: 'Removed from wishlist',
            data: wishlist
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error removing from wishlist',
            error: error.message
        });
    }
};
