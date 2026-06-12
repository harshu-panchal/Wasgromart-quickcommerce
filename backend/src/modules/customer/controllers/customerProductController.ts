import { Request, Response } from "express";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import mongoose from "mongoose";
import { findSellersWithinRange } from "../../../utils/locationHelper";

// Get products with filtering options (public)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      subcategory,
      search,
      page = 1,
      limit = 20,
      sort,
      minPrice,
      maxPrice,
      brand,
      minDiscount,
      latitude, // User location latitude
      longitude, // User location longitude
    } = req.query;

    // Base query: only active and published products
    // Also exclude shop-by-store-only products from category pages
    const query: any = {
      $and: [
        { status: "Active" },
        { publish: true },
        {
          $or: [
            { isShopByStoreOnly: { $ne: true } },
            { isShopByStoreOnly: { $exists: false } },
          ],
        }
      ]
    };

    // Location-based filtering: Only show products from sellers within user's range
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    let nearbySellerIds: any[] = [];
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      // Find sellers within user's location range
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);

      if (nearbySellerIds.length === 0) {
        // No sellers within range, but we will still fetch products and mark them as unavailable (out of range)
      }
    } else {
      // If no location provided, return empty result (strictly enforce location)
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          pages: 0,
        },
        message: "Please provide your location to see products available in your area.",
      });
    }

    // Helper to resolve category/subcategory ID from slug or ID
    const resolveId = async (
      model: any,
      value: string,
      modelName: string = ""
    ) => {
      if (!value) return null;
      if (mongoose.Types.ObjectId.isValid(value)) return value;

      const trimmedValue = value.trim();

      // Build query - only check status if model has status field (Category has it, SubCategory might not)
      const baseQuery: any = {};
      if (modelName === "Category") {
        baseQuery.status = "Active";
      }

      // Try exact slug match first
      let item = await model
        .findOne({ ...baseQuery, slug: trimmedValue })
        .select("_id")
        .lean();
      if (item) return item._id;

      // Try case-insensitive slug match
      item = await model
        .findOne({
          ...baseQuery,
          slug: { $regex: new RegExp(`^${trimmedValue}$`, "i") },
        })
        .select("_id")
        .lean();
      if (item) return item._id;

      // Try name match as fallback (case-insensitive) - replace hyphens/underscores with spaces
      let namePattern = trimmedValue.replace(/[-_]/g, " ");
      item = await model
        .findOne({
          ...baseQuery,
          name: { $regex: new RegExp(`^${namePattern}$`, "i") },
        })
        .select("_id")
        .lean();
      if (item) return item._id;

      // Very broad name match as last resort
      item = await model
        .findOne({
          ...baseQuery,
          name: { $regex: new RegExp(namePattern, "i") },
        })
        .select("_id")
        .lean();
      if (item) return item._id;

      // Special handling for Category and "and" -> "&"
      if (modelName === "Category" && trimmedValue.includes("and")) {
         const withAmpersand = trimmedValue.replace(/-and-/g, " & ").replace(/-/g, " ");
         item = await model
           .findOne({
             ...baseQuery,
             name: { $regex: new RegExp(`^${withAmpersand}$`, "i") },
           })
           .select("_id")
           .lean();
         if (item) return item._id;
      }

      return null;
    };

    // Handle Category and Subcategory resolving
    let resolvedCategoryId = null;
    let resolvedSubcategoryId = null;

    if (category) {
      resolvedCategoryId = await resolveId(Category, category as string, "Category");
      console.log(`DEBUG: resolveId result for category "${category}":`, resolvedCategoryId);
    }

    if (subcategory) {
      // Try Category model first (new system), then SubCategory (old system)
      resolvedSubcategoryId = await resolveId(Category, subcategory as string, "Category");
      if (!resolvedSubcategoryId) {
        resolvedSubcategoryId = await resolveId(SubCategory, subcategory as string, "SubCategory");
      }
      console.log(`DEBUG: resolveId result for subcategory "${subcategory}":`, resolvedSubcategoryId);
    }

    // Flexible filtering: if we have a target ID, check BOTH category and subcategory fields
    // This handles hierarchical leveling differences across products/sellers
    const targetId = resolvedSubcategoryId || resolvedCategoryId;
    if (targetId) {
      query.$and.push({
        $or: [
          { category: targetId },
          { subcategory: targetId }
        ]
      });
    }

    if (brand) {
      query.$and.push({ brand });
    }

    if (minPrice || maxPrice) {
      const priceFilter: any = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      query.$and.push({ price: priceFilter });
    }

    if (minDiscount) {
      query.$and.push({ discount: { $gte: Number(minDiscount) } });
    }

    if (search) {
      // Use text search for broad matching
      query.$and.push({ $text: { $search: search as string } });
    }

    // Calculate skip for pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Build sort object
    let sortOptions: any = { createdAt: -1 }; // Default new to old
    if (sort === "price_asc") sortOptions = { price: 1 };
    if (sort === "price_desc") sortOptions = { price: -1 };
    if (sort === "discount") sortOptions = { discount: -1 };
    if (sort === "popular") sortOptions = { popular: -1, dealOfDay: -1 };

    // Add debug logging for development
    console.log("DEBUG: getProducts Query:", JSON.stringify(query, null, 2));
    console.log("DEBUG: Nearby Seller IDs:", nearbySellerIds);

    let products: any[] = [];
    let total = 0;
    const effectiveLimit = Number(limit);

    if (nearbySellerIds && nearbySellerIds.length > 0) {
      const availQuery = { ...query, $and: [...query.$and, { seller: { $in: nearbySellerIds } }] };
      const unavailQuery = { ...query, $and: [...query.$and, { seller: { $nin: nearbySellerIds } }] };

      const availCount = await Product.countDocuments(availQuery);
      const unavailCount = await Product.countDocuments(unavailQuery);
      total = availCount + unavailCount;

      if (skip < availCount) {
        const availProducts = await Product.find(availQuery)
          .populate("category", "name icon image")
          .populate("subcategory", "name")
          .populate("brand", "name")
          .populate("seller", "storeName status")
          .sort(sortOptions)
          .skip(skip)
          .limit(effectiveLimit);
        
        products = availProducts.map((p: any) => ({ ...p.toObject(), isAvailable: true }));

        if (products.length < effectiveLimit) {
          const remainder = effectiveLimit - products.length;
          const unavailProducts = await Product.find(unavailQuery)
            .populate("category", "name icon image")
            .populate("subcategory", "name")
            .populate("brand", "name")
            .populate("seller", "storeName status")
            .sort(sortOptions)
            .limit(remainder);
          products = [...products, ...unavailProducts.map((p: any) => ({ ...p.toObject(), isAvailable: false }))];
        }
      } else {
        const unavailSkip = skip - availCount;
        const unavailProducts = await Product.find(unavailQuery)
          .populate("category", "name icon image")
          .populate("subcategory", "name")
          .populate("brand", "name")
          .populate("seller", "storeName status")
          .sort(sortOptions)
          .skip(unavailSkip)
          .limit(effectiveLimit);
        products = unavailProducts.map((p: any) => ({ ...p.toObject(), isAvailable: false }));
      }
    } else {
      total = await Product.countDocuments(query);
      const allProducts = await Product.find(query)
        .populate("category", "name icon image")
        .populate("subcategory", "name")
        .populate("brand", "name")
        .populate("seller", "storeName status")
        .sort(sortOptions)
        .skip(skip)
        .limit(effectiveLimit);
      products = allProducts.map((p: any) => ({ ...p.toObject(), isAvailable: false }));
    }

    // --- IMPROVED DIAGNOSTICS FOR EMPTY RESULTS ---
    let extraMessage = "";
    if (total === 0 && targetId) {
       // Check if products exist for this category but were filtered by seller state
       const rawCount = await Product.countDocuments({
         $or: [{ category: targetId }, { subcategory: targetId }],
         publish: true
       });

       if (rawCount > 0) {
          // Check if it's due to seller status
          const productsWithSellers = await Product.find({
            $or: [{ category: targetId }, { subcategory: targetId }],
            publish: true
          }).populate('seller', 'status storeName');

          const pendingSellers = productsWithSellers
            .filter((p: any) => p.seller && p.seller.status === 'Pending')
            .map((p: any) => p.seller.storeName);

          if (pendingSellers.length > 0) {
            extraMessage = `Found ${rawCount} products, but they are hidden because the seller(s) [${[...new Set(pendingSellers)].join(', ')}] are still 'Pending' admin approval.`;
          } else {
            extraMessage = `Products found, but they might be outside your current location range (${nearbySellerIds.length} sellers nearby).`;
          }
       }
    }

    return res.status(200).json({
      success: true,
      message: extraMessage || (total === 0 ? "No products found matches your criteria." : undefined),
      data: products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// Get single product by ID (public)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.query; // User location

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      status: "Active",
      publish: true,
    })
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate(
        "seller",
        "storeName city fssaiLicNo address location serviceRadiusKm"
      );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable",
      });
    }

    // Parse location
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    const seller = product.seller as any;

    // Initialize availability flag
    let isAvailableAtLocation = false;

    // Safely get seller ID - handle both populated and unpopulated cases
    let sellerId: mongoose.Types.ObjectId | null = null;
    if (seller) {
      if (typeof seller === "object" && seller._id) {
        // Seller is populated
        sellerId = seller._id;
      } else if (seller instanceof mongoose.Types.ObjectId) {
        // Seller is an ObjectId (not populated)
        sellerId = seller;
      } else if (typeof seller === "string") {
        // Seller is a string ID
        sellerId = new mongoose.Types.ObjectId(seller);
      }
    }

    // Check location availability if coordinates are provided
    if (
      userLat &&
      userLng &&
      !isNaN(userLat) &&
      !isNaN(userLng) &&
      sellerId &&
      seller?.location
    ) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      isAvailableAtLocation = nearbySellerIds.some(
        (id) => id.toString() === sellerId!.toString()
      );
    }

    // Find similar products (by category)
    // Filter by location
    const similarProductsQuery: any = {
      _id: { $ne: product._id },
      status: "Active",
      publish: true,
      // Exclude shop-by-store-only products from similar products
      $or: [
        { isShopByStoreOnly: { $ne: true } },
        { isShopByStoreOnly: { $exists: false } },
      ],
    };

    // Safely get category ID - handle both populated and unpopulated cases
    let categoryId: mongoose.Types.ObjectId | null = null;
    if (product.category) {
      if (
        typeof product.category === "object" &&
        (product.category as any)._id
      ) {
        // Category is populated
        categoryId = (product.category as any)._id;
      } else if (product.category instanceof mongoose.Types.ObjectId) {
        // Category is an ObjectId (not populated)
        categoryId = product.category;
      } else if (typeof product.category === "string") {
        // Category is a string ID
        categoryId = new mongoose.Types.ObjectId(product.category);
      }
    }

    // Only add category filter if we have a valid category ID
    if (categoryId) {
      similarProductsQuery.category = categoryId;
    }

    // Filter similar products by location
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      if (nearbySellerIds.length > 0) {
        similarProductsQuery.seller = { $in: nearbySellerIds };
      } else {
        // No sellers nearby, return empty similar products
        similarProductsQuery.seller = { $in: [] };
      }
    }

    const similarProducts = await Product.find(similarProductsQuery)
      .limit(6)
      .select(
        "productName price mrp variations mainImage pack discount _id rating reviewsCount"
      );

    return res.status(200).json({
      success: true,
      data: {
        ...product.toObject(),
        similarProducts,
        isAvailableAtLocation, // Add availability flag to response
      },
    });
  } catch (error: any) {
    console.error("Error in getProductById:", {
      productId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Error fetching product details",
      error: error.message,
    });
  }
};
