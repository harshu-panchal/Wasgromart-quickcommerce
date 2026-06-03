import { Request, Response } from "express";
import mongoose from "mongoose";
import * as xlsx from "xlsx";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Shop from "../../../models/Shop";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Create a new product
 */
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const productData = req.body;

    // Ensure sellerId matches authenticated seller
    if (productData.sellerId && productData.sellerId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "You can only create products for your own account",
      });
    }

    // Map fields to match Product model
    const newProductData: any = {
      ...productData,
      seller: sellerId,
      headerCategoryId: productData.headerCategoryId,
      category: productData.categoryId,
      subcategory: productData.subcategoryId,
      subSubCategory: productData.subSubCategoryId,
      brand: productData.brandId,
      mainImage: productData.mainImageUrl,
      galleryImages: productData.galleryImageUrls || [],
      tax: productData.taxId,
      hsnCode: productData.hsnCode,
    };

    // Map variations
    if (newProductData.variations) {
      newProductData.variations = newProductData.variations.map((v: any) => ({
        ...v,
        value: v.value || v.title,
        name: v.name || "Variation",
        discPrice: v.discPrice || 0,
        status: v.status || "Available",
        // Per-variant imagery (accept both *Url and final naming from clients)
        mainImage: v.mainImage || v.mainImageUrl || undefined,
        galleryImages: v.galleryImages || v.galleryImageUrls || [],
      }));
    }

    // Set Price and Stock from Variations
    if (newProductData.variations && newProductData.variations.length > 0) {
      newProductData.price = newProductData.variations[0].price;
      newProductData.discPrice = newProductData.variations[0].discPrice || 0;
      newProductData.stock = newProductData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // Validate Price
    if (newProductData.price === undefined || newProductData.price === null) {
      return res.status(400).json({
        success: false,
        message: "Product price is required (add at least one variation)",
      });
    }

    // Clean up undefined fields
    if (!newProductData.headerCategoryId) delete newProductData.headerCategoryId;
    if (!newProductData.subcategory) delete newProductData.subcategory;
    if (!newProductData.subSubCategory) delete newProductData.subSubCategory;
    if (!newProductData.brand) delete newProductData.brand;

    // Validate variation prices
    if (productData.variations) {
      for (const variation of productData.variations) {
        if (Number(variation.discPrice) > Number(variation.price)) {
          return res.status(400).json({
            success: false,
            message: `Discounted price (${variation.discPrice}) cannot be greater than price (${variation.price}) for variation ${variation.title}`,
          });
        }
      }
    }

    // Set product status
    newProductData.status = "Active";
    newProductData.requiresApproval = false;

    const product = await Product.create(newProductData);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  }
);

/**
 * Create multiple products at once (Manual Bulk Upload)
 */
export const bulkCreateProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { products } = req.body;

    if (!Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: "Payload must be an array of products",
      });
    }

    const results = {
      total: products.length,
      inserted: 0,
      failed: 0,
      errors: [] as any[],
    };

    const productsToInsert: any[] = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const rowIndex = i + 1;

      try {
        // Map fields (same logic as createProduct)
        const mappedData: any = {
          ...p,
          seller: sellerId,
          headerCategoryId: p.headerCategoryId,
          category: p.categoryId,
          subcategory: p.subcategoryId,
          subSubCategory: p.subSubCategoryId,
          brand: p.brandId,
          mainImage: p.mainImageUrl,
          galleryImages: p.galleryImageUrls || [],
          tax: p.taxId,
          hsnCode: p.hsnCode,
          status: "Active",
          requiresApproval: false,
          publish: p.publish !== undefined ? p.publish : true,
          isShopByStoreOnly: false, // Default to false for bulk creation
        };

        // Handle Variations
        if (mappedData.variations) {
          mappedData.variations = mappedData.variations.map((v: any) => ({
            ...v,
            value: v.value || v.title,
            name: v.name || "Variation",
            discPrice: v.discPrice || 0,
            status: v.status || "Available",
            mainImage: v.mainImage || v.mainImageUrl || undefined,
            galleryImages: v.galleryImages || v.galleryImageUrls || [],
          }));

          // Sync Price/Stock
          if (mappedData.variations.length > 0) {
            mappedData.price = mappedData.variations[0].price;
            mappedData.discPrice = mappedData.variations[0].discPrice || 0;
            mappedData.stock = mappedData.variations.reduce(
              (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
              0
            );
          }
        }

        // Basic Validation
        if (!mappedData.productName) throw new Error("Product name is required");
        if (mappedData.price === undefined || mappedData.price === null) throw new Error("Price is required");
        if (!mappedData.category) throw new Error("Category is required");

        productsToInsert.push(mappedData);
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          index: rowIndex,
          product: p.productName || "Unknown",
          error: err.message,
        });
      }
    }

    if (productsToInsert.length > 0) {
      try {
        const inserted = await Product.insertMany(productsToInsert, { ordered: false });
        results.inserted = inserted.length;
      } catch (bulkError: any) {
        if (bulkError.insertedDocs) results.inserted = bulkError.insertedDocs.length;
        if (bulkError.writeErrors) {
          results.failed += bulkError.writeErrors.length;
          bulkError.writeErrors.forEach((we: any) => {
            results.errors.push({
              index: "DB",
              product: "Multiple",
              error: we.errmsg || "Database error",
            });
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.total} products: ${results.inserted} saved, ${results.failed} failed`,
      data: results,
    });
  }
);

/**
 * Get seller's products with filters
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const {
    search,
    category,
    status,
    stock,
    page = "1",
    limit = "10",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build query
  const query: any = { seller: sellerId };

  // Search filter
  if (search) {
    query.$or = [
      { productName: { $regex: search, $options: "i" } },
      { smallDescription: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search as string, "i")] } },
    ];
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Status filter (publish, popular, dealOfDay)
  if (status) {
    if (status === "published") {
      query.publish = true;
    } else if (status === "unpublished") {
      query.publish = false;
    } else if (status === "popular") {
      query.popular = true;
    } else if (status === "dealOfDay") {
      query.dealOfDay = true;
    }
  }

  // Stock filter
  if (stock === "inStock") {
    query["variations.stock"] = { $gt: 0 };
  } else if (stock === "outOfStock") {
    query["variations.stock"] = 0;
    query["variations.status"] = "Sold out";
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const products = await Product.find(query)
    .populate("category", "name")
    .populate("subcategory", "name")
    .populate("brand", "name")
    .populate("tax", "name rate")
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  const total = await Product.countDocuments(query);

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    // Prevent reserved route names from being treated as product IDs
    const reservedRoutes = ["shops", "brands"];
    if (reservedRoutes.includes(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
      .populate("category", "name")
      .populate("subcategory", "subcategoryName")
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name rate");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  }
);

/**
 * Update product
 */
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const updateData = req.body;

    console.log("DEBUG updateProduct: sellerId from token:", sellerId);
    console.log("DEBUG updateProduct: productId:", id);

    // Remove sellerId from update data if present (cannot change owner)
    delete updateData.sellerId;

    // Map frontend field names to model field names (same as createProduct)
    if (updateData.headerCategoryId !== undefined) {
      // Allow null/empty to clear header category
      updateData.headerCategoryId = updateData.headerCategoryId || null;
    }
    if (updateData.categoryId) {
      updateData.category = updateData.categoryId;
      delete updateData.categoryId;
    }
    if (updateData.subcategoryId) {
      updateData.subcategory = updateData.subcategoryId;
      delete updateData.subcategoryId;
    }
    if (updateData.brandId) {
      updateData.brand = updateData.brandId;
      delete updateData.brandId;
    }
    if (updateData.taxId) {
      updateData.tax = updateData.taxId;
      delete updateData.taxId;
    }
    if (updateData.mainImageUrl) {
      updateData.mainImage = updateData.mainImageUrl;
      delete updateData.mainImageUrl;
    }
    if (updateData.galleryImageUrls) {
      updateData.galleryImages = updateData.galleryImageUrls;
      delete updateData.galleryImageUrls;
    }

    // Validate variations if provided
    if (updateData.variations) {
      if (updateData.variations.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Product must have at least one variation",
        });
      }

      // Map variations and validate prices
      updateData.variations = updateData.variations.map((v: any) => ({
        ...v,
        value: v.value || v.title,
        name: v.name || "Variation",
        discPrice: v.discPrice || 0,
        status: v.status || "Available",
        mainImage: v.mainImage || v.mainImageUrl || undefined,
        galleryImages: v.galleryImages || v.galleryImageUrls || [],
      }));

      for (const variation of updateData.variations) {
        if (Number(variation.discPrice) > Number(variation.price)) {
          return res.status(400).json({
            success: false,
            message: `Discounted price cannot be greater than price for variation ${
              variation.title || variation.value
            }`,
          });
        }
      }

      // Sync top-level price and stock from variations (same as createProduct)
      updateData.price = updateData.variations[0].price;
      updateData.discPrice = updateData.variations[0].discPrice || 0;
      updateData.stock = updateData.variations.reduce(
        (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
        0
      );
    }

    // Handle Shop by Store fields
    if (updateData.isShopByStoreOnly !== undefined) {
      updateData.isShopByStoreOnly = updateData.isShopByStoreOnly === true || updateData.isShopByStoreOnly === "true";
    }
    if (updateData.shopId !== undefined) {
      // Allow null to clear shopId
      updateData.shopId = updateData.shopId || null;
    } else if (updateData.isShopByStoreOnly === false) {
      // If shop by store only is false, clear shopId
      updateData.shopId = null;
    }

    // Use findOne and then save to trigger pre-save hooks
    const product = await Product.findOne({ _id: id, seller: sellerId });

    if (!product) {
      // Check if product exists at all
      const existingProduct = await Product.findById(id).select("seller");
      if (existingProduct) {
        console.log(
          "DEBUG updateProduct: product exists but owned by:",
          existingProduct.seller
        );
      }
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Apply updates
    Object.assign(product, updateData);

    // If variations were updated, mark as modified
    if (updateData.variations) {
      product.markModified("variations");
    }

    await product.save();

    // Re-populate for response
    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name")
      .populate("subcategory", "subcategoryName")
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name rate");

    console.log("DEBUG updateProduct: product updated successfully");

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: populatedProduct,
    });
  }
);

/**
 * Delete product
 */
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    console.log("DEBUG deleteProduct: sellerId from token:", sellerId);
    console.log("DEBUG deleteProduct: productId:", id);

    const product = await Product.findOneAndDelete({
      _id: id,
      seller: sellerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

/**
 * Update stock for a product variation
 */
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { id, variationId } = req.params;
  const { stock, status } = req.body;

  const product = await Product.findOne({ _id: id, seller: sellerId });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const variation: any = product.variations?.find(
    (v: any) => v._id?.toString() === variationId
  );
  if (!variation) {
    return res.status(404).json({
      success: false,
      message: "Variation not found",
    });
  }

  if (stock !== undefined) {
    variation.stock = stock;
    // Automatically update status based on stock
    if (stock === 0) {
      variation.status = "Sold out";
    } else if (stock > 0 && variation.status === "Sold out") {
      variation.status = "Available";
    }
  }
  if (status) {
    variation.status = status;
  }

  // Mark variations as modified since we updated a sub-document field
  product.markModified("variations");
  await product.save();

  return res.status(200).json({
    success: true,
    message: "Stock updated successfully",
    data: product,
  });
});

/**
 * Update product status (publish, popular, dealOfDay)
 */
export const updateProductStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { publish, popular, dealOfDay } = req.body;

    const updateData: any = {};
    if (publish !== undefined) updateData.publish = publish;
    if (popular !== undefined) updateData.popular = popular;
    if (dealOfDay !== undefined) updateData.dealOfDay = dealOfDay;

    const product = await Product.findOneAndUpdate(
      { _id: id, seller: sellerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  }
);

/**
 * Bulk update stock for multiple products/variations
 */
export const bulkUpdateStock = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { updates } = req.body; // Array of { productId, variationId, stock }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Updates must be an array",
      });
    }

    const results = [];
    for (const update of updates) {
      const { productId, variationId, stock } = update;

      const product = await Product.findOne({
        _id: productId,
        seller: sellerId,
      });
      if (product) {
        const variation: any = product.variations?.find(
          (v: any) => v._id?.toString() === variationId
        );
        if (variation) {
          variation.stock = stock;
          if (stock === 0) variation.status = "Sold out";
          else if (stock > 0 && variation.status === "Sold out")
            variation.status = "In stock";

          await product.save();
          results.push({ productId, variationId, success: true });
        } else {
          results.push({
            productId,
            variationId,
            success: false,
            message: "Variation not found",
          });
        }
      } else {
        results.push({
          productId,
          variationId,
          success: false,
          message: "Product not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk stock update processed",
      data: results,
    });
  }
);

/**
 * Get all active shops (for seller to select when creating shop-by-store-only products)
 */
export const getShops = asyncHandler(async (_req: Request, res: Response) => {
  const shops = await Shop.find({ isActive: true })
    .select("_id name storeId image")
    .sort({ order: 1, name: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    message: "Shops fetched successfully",
    data: shops || [],
  });
});

/**
 * Bulk upload products from Excel/CSV
 */
export const bulkUpload = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;

  if (!(req as any).file) {
    return res.status(400).json({
      success: false,
      message: "Please upload an Excel or CSV file",
    });
  }

  try {
    // Read the file buffer
    const workbook = xlsx.read((req as any).file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet) as any[];

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is empty",
      });
    }

    const results = {
      total: rows.length,
      inserted: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Get all categories and subcategories to map names/IDs
    const [categories, subCategories] = await Promise.all([
      Category.find({}).select("_id name status"),
      SubCategory.find({}).select("_id name category"),
    ]);

    const categoryNameMap = new Map();
    const categoryIdMap = new Map();
    const subCategoryNameMap = new Map();
    const subCategoryIdMap = new Map();

    categories.forEach((cat: any) => {
      const name = cat.name.toLowerCase().trim();
      categoryNameMap.set(name, cat);
      categoryIdMap.set(cat._id.toString(), cat);
    });

    subCategories.forEach((sub: any) => {
      const name = sub.name.toLowerCase().trim();
      subCategoryNameMap.set(name, sub);
      subCategoryIdMap.set(sub._id.toString(), sub);
    });

    const productsToInsert: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // +1 for 0-indexed, +1 for header row

      const name = row.name || row.productName || row.Name;
      const price = parseFloat(row.price || row.Price);
      const stock = parseInt(row.stock || row.Stock);
      const categoryInput = (row.category || row.Category || "").toString().trim();
      const categoryInputLower = categoryInput.toLowerCase();
      const description = row.description || row.Description || "";

      // Basic validation
      const rowErrors: string[] = [];
      if (!name) rowErrors.push("Product name is missing");
      if (isNaN(price)) rowErrors.push("Invalid or missing price");
      if (isNaN(stock)) rowErrors.push("Invalid or missing stock");
      if (!categoryInput) rowErrors.push("Category/Subcategory is missing");

      let categoryId: any = null;
      let subcategoryId: any = null;

      // 1. Try to match as SubCategory (by Name or ID)
      let matchedSubCategory = subCategoryNameMap.get(categoryInputLower);
      if (!matchedSubCategory && mongoose.Types.ObjectId.isValid(categoryInput)) {
        matchedSubCategory = subCategoryIdMap.get(categoryInput);
      }

      if (matchedSubCategory) {
        subcategoryId = matchedSubCategory._id;
        categoryId = matchedSubCategory.category; // Parent category
      } else {
        // 2. Try to match as Category (by Name or ID)
        let matchedCategory = categoryNameMap.get(categoryInputLower);
        if (!matchedCategory && mongoose.Types.ObjectId.isValid(categoryInput)) {
          matchedCategory = categoryIdMap.get(categoryInput);
        }

        if (matchedCategory) {
          if (matchedCategory.status !== "Active") {
            rowErrors.push(`Category '${categoryInput}' is inactive`);
          } else {
            categoryId = matchedCategory._id;
          }
        } else if (categoryInput) {
          rowErrors.push(`Category/Subcategory '${categoryInput}' not found. Use a valid name (e.g., 'Oil', 'Ice Cream') or a valid ID from the system.`);
        }
      }

      if (rowErrors.length > 0) {
        results.failed++;
        results.errors.push({
          row: rowIndex,
          product: name || "Unknown",
          errors: rowErrors,
        });
        continue;
      }

      // Prepare product data
      productsToInsert.push({
        productName: name,
        price: price,
        compareAtPrice: price, // Default MRP to price if not provided
        stock: stock,
        category: categoryId,
        subcategory: subcategoryId,
        description: description,
        smallDescription: description.substring(0, 150),
        seller: sellerId,
        publish: true,
        status: "Active",
        requiresApproval: false,
        rating: 0,
        reviewsCount: 0,
        discount: 0,
        tags: [],
        variations: [
          {
            name: "Default",
            value: "Standard",
            price: price,
            stock: stock,
            status: (stock >= 0) ? "Available" : "Sold out",
          },
        ],
        isShopByStoreOnly: false,
      });
    }

    if (productsToInsert.length > 0) {
      try {
        const insertedProducts = await Product.insertMany(productsToInsert, { ordered: false });
        results.inserted = insertedProducts.length;
      } catch (bulkError: any) {
        // Handle partial success with insertMany
        if (bulkError.insertedDocs) {
          results.inserted = bulkError.insertedDocs.length;
        }
        if (bulkError.writeErrors) {
          results.failed += bulkError.writeErrors.length;
          bulkError.writeErrors.forEach((we: any) => {
            results.errors.push({
              row: "DB",
              product: "Multiple",
              errors: [we.errmsg || "Database constraint error"],
            });
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk upload completed: ${results.inserted} inserted, ${results.failed} failed`,
      data: results,
    });
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the file",
      error: error.message,
    });
  }
});
