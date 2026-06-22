import { Request, Response } from "express";
import LowestPricesProduct from "../../../models/LowestPricesProduct";
import Product from "../../../models/Product";
import HeaderCategory from "../../../models/HeaderCategory";
import mongoose from "mongoose";

const normalizeSlug = (slug: string): string => slug.trim().toLowerCase();

const validateHeaderCategorySlug = async (slug: string): Promise<string | null> => {
    const normalized = normalizeSlug(slug);
    if (!normalized) {
        return "Header category slug is required";
    }
    if (normalized === "all") {
        return null;
    }
    const headerCategory = await HeaderCategory.findOne({
        slug: normalized,
    }).lean();
    if (!headerCategory) {
        return `Header category "${normalized}" not found`;
    }
    return null;
};

// Get all lowest prices products (optional filter by headerCategorySlug)
export const getLowestPricesProducts = async (req: Request, res: Response) => {
    try {
        const { headerCategorySlug } = req.query;
        const query: Record<string, unknown> = {};

        if (headerCategorySlug && typeof headerCategorySlug === "string") {
            query.headerCategorySlug = normalizeSlug(headerCategorySlug);
        }

        const products = await LowestPricesProduct.find(query)
            .populate("product", "productName mainImage price mrp discount status publish headerCategoryId")
            .sort({ headerCategorySlug: 1, order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching lowest prices products",
            error: error.message,
        });
    }
};

// Get single lowest prices product by ID
export const getLowestPricesProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const lowestPricesProduct = await LowestPricesProduct.findById(id)
            .populate("product", "productName mainImage price mrp discount status publish headerCategoryId")
            .lean();

        if (!lowestPricesProduct) {
            return res.status(404).json({
                success: false,
                message: "Lowest prices product not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: lowestPricesProduct,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching lowest prices product",
            error: error.message,
        });
    }
};

// Create new lowest prices product
export const createLowestPricesProduct = async (req: Request, res: Response) => {
    try {
        const { product, order, isActive, headerCategorySlug } = req.body;

        if (!product) {
            return res.status(400).json({
                success: false,
                message: "Product is required",
            });
        }

        if (!headerCategorySlug) {
            return res.status(400).json({
                success: false,
                message: "Header category slug is required",
            });
        }

        const slugError = await validateHeaderCategorySlug(headerCategorySlug);
        if (slugError) {
            return res.status(400).json({ success: false, message: slugError });
        }

        const normalizedSlug = normalizeSlug(headerCategorySlug);

        if (!mongoose.Types.ObjectId.isValid(product)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const productExists = await Product.findById(product);
        if (!productExists) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        const existing = await LowestPricesProduct.findOne({
            product,
            headerCategorySlug: normalizedSlug,
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Product already exists in lowest prices section for this header category",
            });
        }

        let productOrder = order;
        if (productOrder === undefined || productOrder === null) {
            const maxOrderProduct = await LowestPricesProduct.findOne({
                headerCategorySlug: normalizedSlug,
            })
                .sort({ order: -1 })
                .lean();
            productOrder = maxOrderProduct ? maxOrderProduct.order + 1 : 0;
        }

        const newLowestPricesProduct = new LowestPricesProduct({
            product,
            headerCategorySlug: normalizedSlug,
            order: productOrder,
            isActive: isActive !== undefined ? isActive : true,
        });

        await newLowestPricesProduct.save();

        const populatedProduct = await LowestPricesProduct.findById(newLowestPricesProduct._id)
            .populate("product", "productName mainImage price mrp discount status publish headerCategoryId")
            .lean();

        return res.status(201).json({
            success: true,
            message: "Product added to lowest prices section successfully",
            data: populatedProduct,
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Product already exists in lowest prices section for this header category",
            });
        }
        return res.status(500).json({
            success: false,
            message: "Error adding product to lowest prices section",
            error: error.message,
        });
    }
};

// Update lowest prices product
export const updateLowestPricesProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { order, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const lowestPricesProduct = await LowestPricesProduct.findById(id);
        if (!lowestPricesProduct) {
            return res.status(404).json({
                success: false,
                message: "Lowest prices product not found",
            });
        }

        if (order !== undefined) lowestPricesProduct.order = order;
        if (isActive !== undefined) lowestPricesProduct.isActive = isActive;

        await lowestPricesProduct.save();

        const updatedProduct = await LowestPricesProduct.findById(id)
            .populate("product", "productName mainImage price mrp discount status publish headerCategoryId")
            .lean();

        return res.status(200).json({
            success: true,
            message: "Lowest prices product updated successfully",
            data: updatedProduct,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error updating lowest prices product",
            error: error.message,
        });
    }
};

// Delete lowest prices product
export const deleteLowestPricesProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        const lowestPricesProduct = await LowestPricesProduct.findByIdAndDelete(id);
        if (!lowestPricesProduct) {
            return res.status(404).json({
                success: false,
                message: "Lowest prices product not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product removed from lowest prices section successfully",
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error removing product from lowest prices section",
            error: error.message,
        });
    }
};

// Reorder lowest prices products
export const reorderLowestPricesProducts = async (req: Request, res: Response) => {
    try {
        const { products, headerCategorySlug } = req.body;

        if (!Array.isArray(products)) {
            return res.status(400).json({
                success: false,
                message: "Products must be an array",
            });
        }

        const updatePromises = products.map(({ id, order }: { id: string; order: number }) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(`Invalid product ID: ${id}`);
            }
            return LowestPricesProduct.findByIdAndUpdate(id, { order }, { new: true });
        });

        await Promise.all(updatePromises);

        const query: Record<string, unknown> = {};
        if (headerCategorySlug && typeof headerCategorySlug === "string") {
            query.headerCategorySlug = normalizeSlug(headerCategorySlug);
        }

        const updatedProducts = await LowestPricesProduct.find(query)
            .populate("product", "productName mainImage price mrp discount status publish headerCategoryId")
            .sort({ order: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Lowest prices products reordered successfully",
            data: updatedProducts,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error reordering lowest prices products",
            error: error.message,
        });
    }
};
