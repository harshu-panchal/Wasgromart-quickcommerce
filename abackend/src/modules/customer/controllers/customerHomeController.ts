import { Request, Response } from "express";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Shop from "../../../models/Shop";
import HeaderCategory from "../../../models/HeaderCategory";
import HomeSection from "../../../models/HomeSection";
import BestsellerCard from "../../../models/BestsellerCard";
import LowestPricesProduct from "../../../models/LowestPricesProduct";
import PromoStrip from "../../../models/PromoStrip";
import Banner from "../../../models/Banner";
import Promotion from "../../../models/Promotion";
import mongoose from "mongoose";
import { cache } from "../../../utils/cache";
import { findSellersWithinRange } from "../../../utils/locationHelper";
import { withShopPresentation } from "../../../utils/productPresentation";

interface SectionFetchOptions {
  /** Override the effective row cap (defaults to section.limit). */
  limit?: number;
  /** Number of items to skip (only used for `displayType: "products"`). */
  skip?: number;
  /** When true, also return a total row count alongside the data. */
  withTotal?: boolean;
}

interface SectionFetchResult {
  data: any[];
  total: number;
}

/**
 * Build the Mongo query for a "products" home section. Returned separately so
 * we can re-use it both for `find()` and `countDocuments()` (when paginating).
 */
function buildProductSectionQuery(section: any): any {
  const { categories, subCategories } = section;
  const query: any = {
    status: "Active",
    publish: true,
    // Exclude shop-by-store-only products from home sections
    $or: [
      { isShopByStoreOnly: { $ne: true } },
      { isShopByStoreOnly: { $exists: false } },
    ],
  };

  if (categories && categories.length > 0) {
    const categoryIds = categories
      .map((cat: any) => (cat ? cat._id || cat : null))
      .filter((id: any) => id);
    if (categoryIds.length > 0) {
      query.category = { $in: categoryIds };
    }
  }

  if (subCategories && subCategories.length > 0) {
    const subCategoryIds = subCategories
      .map((sub: any) => (sub ? sub._id || sub : null))
      .filter((id: any) => id);
    if (subCategoryIds.length > 0) {
      query.subcategory = { $in: subCategoryIds };
    }
  }

  return query;
}

function shapeProduct(p: any, nearbySellerIds?: mongoose.Types.ObjectId[]): any {
  const isAvailable =
    nearbySellerIds && nearbySellerIds.length > 0 && p.seller
      ? nearbySellerIds.some((id) => id.toString() === (p.seller?._id || p.seller).toString())
      : false;

  const presentation = withShopPresentation(p);

  return {
    id: p._id.toString(),
    productId: p._id.toString(),
    name: p.productName,
    productName: p.productName,
    image: p.mainImage,
    mainImage: p.mainImage,
    price: p.price,
    mrp: p.mrp,
    discount:
      p.discount ||
      (p.mrp && p.price
        ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
        : 0),
    productImages: p.mainImage ? [p.mainImage] : [],
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    reviews: p.reviewsCount || 0,
    pack: p.pack || "",
    type: "product",
    isAvailable,
    seller: p.seller,
    shopName: presentation.shopName,
    storeName: presentation.storeName,
  };
}

// Helper function to fetch data for a home section based on its configuration.
// Returns both the page of data and (optionally) the total row count so callers
// can compute `hasMore` for client-side pagination.
async function fetchSectionData(
  section: any,
  nearbySellerIds?: mongoose.Types.ObjectId[],
  options: SectionFetchOptions = {},
): Promise<SectionFetchResult> {
  try {
    const { categories, subCategories, displayType } = section;
    const baseLimit = section.limit || 12;
    // Pagination overrides (limit / skip / withTotal) only apply to the
    // "products" display type. Category / subcategory tile sections are
    // always returned whole (capped at the admin's `section.limit`) because
    // the UI renders them with `CategoryTileSection` which has no "See More".
    const isProductsType = displayType === "products";
    const effectiveLimit = isProductsType && options.limit && options.limit > 0
      ? options.limit
      : baseLimit;
    const skip = isProductsType ? Math.max(0, options.skip || 0) : 0;

    // If displayType is "subcategories", fetch subcategories
    if (displayType === "subcategories") {
      const categoryIds = (categories || [])
        .map((cat: any) => (cat ? cat._id || cat : null))
        .filter((id: any) => id);
      const subCategoryIds = (subCategories || [])
        .map((sub: any) => (sub ? sub._id || sub : null))
        .filter((id: any) => id);

      const query: any = { status: "Active" };

      if (categoryIds.length > 0 && subCategoryIds.length > 0) {
        query.$or = [{ parentId: { $in: categoryIds } }, { _id: { $in: subCategoryIds } }];
      } else if (categoryIds.length > 0) {
        query.parentId = { $in: categoryIds };
      } else if (subCategoryIds.length > 0) {
        query._id = { $in: subCategoryIds };
      } else {
        return { data: [], total: 0 };
      }

      const subcategoryDocs = await Category.find(query)
        .select("name image order slug parentId")
        .sort({ order: 1 })
        .limit(effectiveLimit)
        .lean();

      const data: any[] = [];
      if (nearbySellerIds && nearbySellerIds.length > 0) {
        if (subcategoryDocs.length > 0) {
          for (const sub of subcategoryDocs) {
            const productCount = await Product.countDocuments({
              subcategory: sub._id,
              status: "Active",
              publish: true,
              seller: { $in: nearbySellerIds },
            });
            if (productCount > 0) {
              data.push({
                id: sub._id.toString(),
                subcategoryId: sub._id.toString(),
                categoryId: sub.parentId?.toString() || "",
                name: sub.name,
                image: sub.image || "",
                slug: sub.slug || sub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                type: "subcategory",
              });
            }
          }
        } else {
          // Fallback: Try fetching from SubCategory model (legacy)
          const legacySubcategories = await SubCategory.find({
            category: { $in: categoryIds },
          })
            .select("name image order category")
            .sort({ order: 1 })
            .limit(effectiveLimit)
            .lean();

          for (const sub of legacySubcategories) {
            const productCount = await Product.countDocuments({
              subcategory: sub._id,
              status: "Active",
              publish: true,
              seller: { $in: nearbySellerIds },
            });
            if (productCount > 0) {
              data.push({
                id: sub._id.toString(),
                subcategoryId: sub._id.toString(),
                categoryId: sub.category?.toString() || "",
                name: sub.name,
                image: sub.image || "",
                slug: sub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                type: "subcategory",
              });
            }
          }
        }
      }
      return { data, total: data.length };
    }

    // If displayType is "products", fetch products (this is the path that
    // supports pagination via skip + limit).
    if (displayType === "products") {
      const query = buildProductSectionQuery(section);
      const adminCap = section.limit || 200;
      const selectFields = "productName mainImage price mrp discount rating reviewsCount pack seller";

      let products: any[] = [];
      let total = 0;

      if (nearbySellerIds && nearbySellerIds.length > 0) {
        const availQuery = { ...query, seller: { $in: nearbySellerIds } };

        total = await Product.countDocuments(availQuery);
        total = Math.min(total, adminCap);

        products = await Product.find(availQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(effectiveLimit)
          .select(selectFields)
          .populate("seller", "storeName sellerName")
          .lean();
      } else {
        total = 0;
        products = [];
      }

      return {
        data: products.map((p: any) => shapeProduct(p, nearbySellerIds)),
        total: options.withTotal ? total : skip + products.length,
      };
    }

    // If displayType is "categories", fetch the selected categories themselves
    if (displayType === "categories") {
      if (categories && categories.length > 0) {
        const categoryIds = categories.map((cat: any) => cat._id || cat);

        const fetchedCategories = await Category.find({
          _id: { $in: categoryIds },
          status: "Active",
        })
          .select("name image slug")
          .sort({ order: 1 })
          .limit(effectiveLimit)
          .lean();

        const data: any[] = [];
        if (nearbySellerIds && nearbySellerIds.length > 0) {
          for (const c of fetchedCategories) {
            const productCount = await Product.countDocuments({
              category: c._id,
              status: "Active",
              publish: true,
              seller: { $in: nearbySellerIds },
            });
            if (productCount > 0) {
              data.push({
                id: c._id.toString(),
                categoryId: c.slug || c._id.toString(),
                name: c.name,
                image: c.image,
                slug: c.slug,
                type: "category",
              });
            }
          }
        }
        return { data, total: data.length };
      }
      return { data: [], total: 0 };
    }

    return { data: [], total: 0 };
  } catch (error) {
    console.error("Error fetching section data:", error);
    return { data: [], total: 0 };
  }
}

/**
 * Resolves the HomeSection query for a given `headerCategorySlug`.
 * Centralised so the legacy `getHomeContent` and the new paginated
 * `getHomeSections` endpoint stay in sync.
 */
async function buildHomeSectionQuery(
  headerCategorySlug?: string,
): Promise<any> {
  const homeSectionQuery: any = { isActive: true };
  if (headerCategorySlug && headerCategorySlug !== "all") {
    const headerCategory = await HeaderCategory.findOne({
      slug: headerCategorySlug,
      status: "Published",
    }).lean();
    if (headerCategory) {
      homeSectionQuery.pageLocation = "header_category";
      homeSectionQuery.headerCategoryId = headerCategory._id;
    } else {
      homeSectionQuery.pageLocation = "home";
    }
  } else {
    homeSectionQuery.pageLocation = "home";
  }
  return homeSectionQuery;
}

const HOME_CONTENT_CACHE_TTL = 2 * 60 * 1000;

function roundCoord(value: number | null, precision = 2): number {
  if (value === null || isNaN(value)) return 0;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function buildHomeContentCacheKey(
  slug: string,
  userLat: number | null,
  userLng: number | null,
  sectionsLimit: number,
  productsPerSection: number
): string {
  return `home-content-${slug}-${roundCoord(userLat)}-${roundCoord(userLng)}-${sectionsLimit}-${productsPerSection}`;
}

async function fetchPromoStripForSlug(
  slug: string,
  nearbySellerIds: mongoose.Types.ObjectId[]
): Promise<any | null> {
  const promoStripCacheKey = `promoStrip-${slug}`;
  if (cache.has(promoStripCacheKey)) {
    return cache.get(promoStripCacheKey);
  }

  const now = new Date();
  const promoStripDoc = await PromoStrip.findOne({
    headerCategorySlug: slug,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .populate("categoryCards.categoryId", "name slug image")
    .populate(
      "featuredProducts",
      "productName mainImage mainImageUrl galleryImageUrls galleryImages price mrp compareAtPrice discount rating reviewsCount seller"
    )
    .sort({ order: 1 })
    .lean();

  let promoStrip: any = promoStripDoc;

  if (promoStrip?.featuredProducts) {
    promoStrip = {
      ...promoStrip,
      featuredProducts: promoStrip.featuredProducts
        .map((p: any) => {
          const isAvailable =
            nearbySellerIds.length > 0 && p.seller
              ? nearbySellerIds.some(
                  (id) => id.toString() === p.seller.toString()
                )
              : false;
          return { ...p, isAvailable };
        })
        .filter((p: any) => p.isAvailable),
    };
  }

  if (promoStrip) {
    cache.set(promoStripCacheKey, promoStrip, 3 * 60 * 1000);
  } else {
    cache.set(promoStripCacheKey, null, 60 * 1000);
  }

  return promoStrip;
}

// Lightweight promo strip for tab switches (avoids full home payload)
export const getHomePromoStrip = async (req: Request, res: Response) => {
  try {
    const { headerCategorySlug, latitude, longitude } = req.query;
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    const slug = ((headerCategorySlug as string) || "all").toLowerCase();

    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);
    }

    const promoStrip = await fetchPromoStripForSlug(slug, nearbySellerIds);

    res.status(200).json({
      success: true,
      data: {
        promoStrip: promoStrip || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching promo strip",
      error: error.message,
    });
  }
};

// Get Home Page Content
export const getHomeContent = async (req: Request, res: Response) => {
  const {
    headerCategorySlug,
    latitude,
    longitude,
    sectionsLimit,
    productsPerSection,
  } = req.query;

  // Optional caps for chunked loading. Defaults preserve the legacy "fetch
  // everything" behaviour so existing callers (Categories, Search, PromoSection)
  // keep working unchanged.
  const parsedSectionsLimit = Math.max(0, parseInt(String(sectionsLimit ?? "0"), 10) || 0);
  const parsedProductsPerSection = Math.max(
    0,
    parseInt(String(productsPerSection ?? "0"), 10) || 0,
  );

  const currentHeaderCategorySlug = (
    (headerCategorySlug as string) || "all"
  ).toLowerCase();

  const userLat = latitude ? parseFloat(latitude as string) : null;
  const userLng = longitude ? parseFloat(longitude as string) : null;

  const homeCacheKey = buildHomeContentCacheKey(
    currentHeaderCategorySlug,
    userLat,
    userLng,
    parsedSectionsLimit,
    parsedProductsPerSection
  );
  const cachedHome = cache.get<any>(homeCacheKey);
  if (cachedHome) {
    return res.status(200).json(cachedHome);
  }

  try {
    // Find sellers within user's location range
    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);
    }

    // 1. Featured / Bestsellers - Get bestseller cards from admin configuration
    const bestsellerCards = await BestsellerCard.find({
      isActive: true,
    })
      .populate("category", "name slug image")
      .sort({ order: 1 })
      .limit(6)
      .lean();

    // For each bestseller card, get 4 products from the associated category
    const bestsellers = await Promise.all(
      bestsellerCards.map(async (card: any) => {
        const categoryId = card.category?._id || card.category;

        // Build product query for images (ignore location to show category preview)
        const productQuery: any = {
          category: categoryId,
          status: "Active",
          publish: true,
        };

        // Fetch active products from the category for preview images
        // We fetch these irrespective of location radius to show category preview
        const categoryProducts = await Product.find(productQuery)
          .select("productName mainImage galleryImages")
          .sort({ createdAt: -1 })
          .limit(16)
          .lean();

        // Extract product images (prefer mainImage, fallback to galleryImages[0])
        const productImages: string[] = [];
        categoryProducts.forEach((product: any) => {
          if (productImages.length < 16 && product.mainImage) {
            productImages.push(product.mainImage);
          }
        });

        // If we have less than 16 products, try to use gallery images
        if (productImages.length < 16) {
          categoryProducts.forEach((product: any) => {
            if (
              productImages.length < 16 &&
              product.galleryImages &&
              product.galleryImages.length > 0
            ) {
              productImages.push(product.galleryImages[0]);
            }
          });
        }

        // Pad to ensure we have a multiple of 4 images for the grid (pad with first image if needed)
        while (productImages.length > 0 && productImages.length % 4 !== 0) {
          productImages.push(productImages[0]);
        }
        if (productImages.length > 0 && productImages.length < 4) {
          while (productImages.length < 4) {
            productImages.push(productImages[0]);
          }
        }

        return {
          id: card._id.toString(),
          categoryId: categoryId.toString(),
          name: card.name,
          productImages: productImages.slice(0, 16),
          productCount: categoryProducts.length,
        };
      }),
    );

    // 2. Lowest Prices Products - Get admin-selected products for current header category tab
    const lowestPricesProductsQuery: any = {
      isActive: true,
      headerCategorySlug: currentHeaderCategorySlug,
    };

    const lowestPricesProducts = await LowestPricesProduct.find(
      lowestPricesProductsQuery,
    )
      .populate({
        path: "product",
        select:
          "productName mainImage price mrp discount status publish category subcategory seller",
        populate: {
          path: "seller",
          select: "storeName sellerName",
        },
        match: {
          status: "Active",
          publish: true,
          // Removed location filter to show preview images irrespective of radius
        },
      })
      .sort({ order: 1 })
      .lean();

    // Filter out any products that were null (due to match condition) and only keep those available at customer location
    const validLowestPricesProducts = lowestPricesProducts
      .filter((item: any) => item.product !== null)
      .map((item: any) => {
        const product = item.product;
        // Check if the product's seller is within range
        const isAvailable =
          nearbySellerIds && nearbySellerIds.length > 0 && product.seller
            ? nearbySellerIds.some(
              (id) => id.toString() === product.seller.toString(),
            )
            : false;

        const productPresentation = withShopPresentation(product);

        return {
          id: product._id.toString(),
          _id: product._id.toString(),
          productName: product.productName,
          name: product.productName,
          mainImage: product.mainImage,
          imageUrl: product.mainImage,
          price: product.price,
          mrp: product.mrp,
          discount:
            product.discount ||
            (product.mrp && product.price
              ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
              : 0),
          categoryId: product.category?.toString() || "",
          subcategory: product.subcategory?.toString() || "",
          status: product.status,
          publish: product.publish,
          isAvailable,
          seller: product.seller,
          shopName: productPresentation.shopName,
          storeName: productPresentation.storeName,
        };
      })
      .filter((p: any) => p.isAvailable); // ONLY show products in customer location radius!

    // 3. Categories for Tiles (Grocery, Snacks, etc)
    const categories = await Category.find({
      status: "Active",
    })
      .select("name image icon color slug")
      .sort({ order: 1 });

    // 4. Shop By Store - Fetch from database
    const shopDocuments = await Shop.find({ isActive: true })
      .populate("category", "name slug")
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Transform shop data to match frontend expected format and include preview images
    const shops = await Promise.all(
      shopDocuments.map(async (shop: any) => {
        let productImages: string[] = [];

        if (shop.products && shop.products.length > 0) {
          const shopProducts = await Product.find({
            _id: { $in: shop.products.slice(0, 16) },
            status: "Active",
            publish: true,
            seller: { $in: nearbySellerIds }
          })
            .select("mainImage")
            .lean();

          productImages = shopProducts
            .map((p: any) => p.mainImage)
            .filter(Boolean);
            
          // Pad to ensure we have a multiple of 4 images for the grid
          while (productImages.length > 0 && productImages.length % 4 !== 0) {
            productImages.push(productImages[0]);
          }
          if (productImages.length > 0 && productImages.length < 4) {
            while (productImages.length < 4) {
              productImages.push(productImages[0]);
            }
          }
        }

        return {
          id: shop.storeId || shop._id.toString(),
          name: shop.name,
          image: shop.image,
          productImages, // Include preview images within range
          slug: shop.storeId || shop._id.toString(),
          category: shop.category,
          productIds: shop.products?.map((p: any) => p.toString()) || [],
          bgColor: shop.bgColor || "bg-neutral-50",
        };
      }),
    );

    // Only return shops that have products available in the customer's area
    const validShops = shops.filter((s: any) => s.productImages && s.productImages.length > 0);

    // 5. Trending Items (Fetch some popular categories or products)
    const trendingCategories = await Category.find({
      status: "Active",
    })
      .limit(5)
      .select("name image slug");

    const trending = trendingCategories.map((c) => ({
      id: c._id,
      name: c.name,
      image: c.image || `/assets/categories/${c.slug}.jpg`,
      type: "category",
    }));

    // 6. Personal Care Subcategories - Now handled by dynamic sections

    // 7. Cooking Ideas (Fetch some products from 'Food' or 'Grocery' categories)
    // Only fetch products within the customer's location radius
    const foodProductsQuery: any = {
      status: "Active",
      publish: true,
      seller: { $in: nearbySellerIds }
    };

    const foodProducts = await Product.find(foodProductsQuery)
      .limit(3)
      .select("productName mainImage");

    const cookingIdeas = foodProducts.map((p) => ({
      id: p._id,
      title: p.productName,
      image: p.mainImage,
      productId: p._id,
    }));

    // 8. Promo Cards (Dynamic - Categories with headerCategoryId)
    // Fetch root categories (parentId: null) that have a headerCategoryId assigned and are Active
    // If headerCategorySlug is provided, filter by that specific header category
    // Include their child categories (subcategories) with images

    // Build query for categories
    const categoryQuery: any = {
      headerCategoryId: { $exists: true, $ne: null },
      status: "Active",
      parentId: null, // Only root categories (not subcategories themselves)
    };

    // If headerCategorySlug is provided, find the header category and filter by it
    if (headerCategorySlug && headerCategorySlug !== "all") {
      const headerCategory = await HeaderCategory.findOne({
        slug: headerCategorySlug,
        status: "Published",
      }).lean();

      if (headerCategory) {
        categoryQuery.headerCategoryId = headerCategory._id;
      } else {
        // If header category not found, return empty promo cards for this header category
        // The query will still work but won't match any categories
        console.log(
          `Header category with slug "${headerCategorySlug}" not found`,
        );
      }
    }

    const categoriesWithHeaderCategory = await Category.find(categoryQuery)
      .populate("headerCategoryId", "name status")
      .sort({ order: 1 })
      .limit(4) // Limit to 4 promo cards
      .lean();

    const promoCards = await Promise.all(
      categoriesWithHeaderCategory.map(async (category: any) => {
        // Get child categories (subcategories) for this category
        const childCategories = await Category.find({
          parentId: category._id,
          status: "Active",
        })
          .select("name image _id")
          .sort({ order: 1 })
          .limit(4) // Limit to 4 subcategory images
          .lean();

        // Extract subcategory images
        const subcategoryImages = childCategories
          .map((child: any) => child.image)
          .filter((img: string) => img && img.trim() !== "");

        return {
          id: category._id.toString(),
          badge: "Up to 55% OFF", // Default badge, can be customized later
          title: category.name,
          categoryId: category._id.toString(),
          slug: category.slug || category._id.toString(),
          bgColor: "bg-yellow-50",
          subcategoryImages: subcategoryImages.slice(0, 4), // Max 4 images
        };
      }),
    );

    // Fallback to hardcoded cards if no categories with headerCategoryId exist
    const finalPromoCards =
      promoCards.length > 0
        ? promoCards
        : [
          {
            id: "self-care",
            badge: "Up to 55% OFF",
            title: "Self Care & Wellness",
            categoryId: "personal-care",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
          {
            id: "hot-meals",
            badge: "Up to 55% OFF",
            title: "Hot Meals & Drinks",
            categoryId: "breakfast-instant",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
          {
            id: "kitchen-essentials",
            badge: "Up to 55% OFF",
            title: "Kitchen Essentials",
            categoryId: "atta-rice",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
          {
            id: "cleaning-home",
            badge: "Up to 75% OFF",
            title: "Cleaning & Home Needs",
            categoryId: "household",
            bgColor: "bg-yellow-50",
            subcategoryImages: [],
          },
        ];

    // 9. Dynamic Home Sections - Fetch from database
    // Filter by pageLocation: "home" if we are on the main home page
    const homeSectionQuery = await buildHomeSectionQuery(
      headerCategorySlug as string | undefined,
    );

    // Count first so we can return pagination metadata even when paginating.
    const totalSections = await HomeSection.countDocuments(homeSectionQuery);

    const sectionsFindCursor = HomeSection.find(homeSectionQuery)
      .populate("categories", "name slug image")
      .populate("subCategories", "name")
      .populate("headerCategoryId", "name")
      .sort({ order: 1 });

    // When the client opts into chunked loading, cap how many sections we
    // load on this request. `parsedSectionsLimit === 0` preserves the legacy
    // "load everything" behaviour for existing callers.
    if (parsedSectionsLimit > 0) {
      sectionsFindCursor.limit(parsedSectionsLimit);
    }

    const homeSections = await sectionsFindCursor.lean();

    // Fetch data for each section. When the client passed
    // `productsPerSection`, also include the per-section total so the frontend
    // can drive "See More" without an extra round-trip on first paint.
    // NOTE: chunked loading only applies to `displayType: "products"` —
    // category / subcategory tile sections are always returned whole.
    const dynamicSections = await Promise.all(
      homeSections.map(async (section: any) => {
        const wantsPagination =
          parsedProductsPerSection > 0 && section.displayType === "products";
        const { data, total } = await fetchSectionData(
          section,
          nearbySellerIds,
          {
            limit: wantsPagination ? parsedProductsPerSection : undefined,
            skip: 0,
            withTotal: wantsPagination,
          },
        );
        return {
          id: section._id.toString(),
          title: section.title,
          slug: section.slug,
          displayType: section.displayType,
          columns: section.columns,
          data,
          // Only emit per-section pagination for product sections — tile
          // sections never paginate.
          ...(wantsPagination
            ? {
              pagination: {
                page: 1,
                limit: parsedProductsPerSection,
                total,
                hasMore: data.length < total,
              },
            }
            : {}),
        };
      }),
    );

    // Only return sections that have products or items to display
    const filteredDynamicSections = dynamicSections.filter(
      (section: any) => section.data && section.data.length > 0
    );

    const homeSectionsPagination = {
      page: 1,
      limit: parsedSectionsLimit > 0 ? parsedSectionsLimit : totalSections,
      total: totalSections,
      hasMore:
        parsedSectionsLimit > 0 ? homeSections.length < totalSections : false,
    };

    // 10. Fetch PromoStrip for the current header category (with caching)
    const promoStrip = await fetchPromoStripForSlug(
      currentHeaderCategorySlug,
      nearbySellerIds
    );

    // Fetch admin banners
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    // Fetch approved seller promotion banners
    const sellerPromotions = await Promotion.find({
      status: "Approved",
      isActive: true,
    })
      .populate("seller", "storeName sellerName")
      .sort({ order: 1, approvedAt: -1, createdAt: -1 })
      .lean();

    const promoBanners = [...banners, ...sellerPromotions.map((p: any) => ({
      _id: p._id?.toString(),
      title: p.title || p.seller?.storeName || "Store promotion",
      image: p.image,
      link: p.link && p.link.trim().length > 0
        ? p.link
        : `/store/${p.seller?._id?.toString?.() || ""}`,
      order: typeof p.order === "number" ? p.order : 999,
    }))].sort((a: any, b: any) => {
      const orderA = typeof a.order === "number" ? a.order : 999;
      const orderB = typeof b.order === "number" ? b.order : 999;
      return orderA - orderB;
    });

    const responsePayload = {
      success: true,
      data: {
        bestsellers,
        lowestPrices: validLowestPricesProducts,
        categories,
        homeSections: filteredDynamicSections,
        homeSectionsPagination,
        shops: validShops,
        promoBanners:
          promoBanners.length > 0
            ? promoBanners
            : [
              {
                _id: "1",
                id: "1",
                title: "Grocery Sale",
                image:
                  "https://img.freepik.com/free-vector/horizontal-banner-template-grocery-sales_23-2149432421.jpg",
                link: "/category/grocery",
                order: 1,
              },
              {
                _id: "2",
                id: "2",
                title: "Supermarket Offers",
                image:
                  "https://img.freepik.com/free-vector/flat-supermarket-social-media-cover-template_23-2149363385.jpg",
                link: "/category/snacks",
                order: 2,
              },
            ],
        trending,
        cookingIdeas,
        promoCards: finalPromoCards,
        promoStrip: promoStrip || null,
      },
    };

    cache.set(homeCacheKey, responsePayload, HOME_CONTENT_CACHE_TTL);
    res.status(200).json(responsePayload);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching home content",
      error: error.message,
    });
  }
};

/**
 * GET /customer/home/sections
 *
 * Paginated home sections, each populated with the first
 * `productsPerSection` items. Used by the customer home page to load sections
 * in chunks as the user scrolls (e.g. 5 sections per page, 6 products each).
 *
 * Query params:
 *  - page (default 1)
 *  - limit (default 5)
 *  - productsPerSection (default 6)
 *  - headerCategorySlug (default "all")
 *  - latitude, longitude (for the per-product availability flag)
 */
export const getHomeSections = async (req: Request, res: Response) => {
  try {
    const {
      headerCategorySlug,
      latitude,
      longitude,
    } = req.query;

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit ?? "5"), 10) || 5),
    );
    const productsPerSection = Math.min(
      50,
      Math.max(
        1,
        parseInt(String(req.query.productsPerSection ?? "6"), 10) || 6,
      ),
    );
    const skip = (page - 1) * limit;

    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (userLat !== null && userLng !== null) {
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);
    }

    const homeSectionQuery = await buildHomeSectionQuery(
      headerCategorySlug as string | undefined,
    );

    const totalSections = await HomeSection.countDocuments(homeSectionQuery);

    const sections = await HomeSection.find(homeSectionQuery)
      .populate("categories", "name slug image")
      .populate("subCategories", "name")
      .populate("headerCategoryId", "name")
      .sort({ order: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const data = await Promise.all(
      sections.map(async (section: any) => {
        // Only product sections chunk; tile sections always return whole.
        const isProductsType = section.displayType === "products";
        const { data: sectionData, total } = await fetchSectionData(
          section,
          nearbySellerIds,
          isProductsType
            ? { limit: productsPerSection, skip: 0, withTotal: true }
            : {},
        );
        return {
          id: section._id.toString(),
          title: section.title,
          slug: section.slug,
          displayType: section.displayType,
          columns: section.columns,
          data: sectionData,
          ...(isProductsType
            ? {
              pagination: {
                page: 1,
                limit: productsPerSection,
                total,
                hasMore: sectionData.length < total,
              },
            }
            : {}),
        };
      }),
    );

    // Only return sections that have products or items to display
    const filteredSections = data.filter((s: any) => s.data && s.data.length > 0);

    return res.status(200).json({
      success: true,
      data: {
        sections: filteredSections,
        pagination: {
          page,
          limit,
          total: totalSections,
          hasMore: skip + sections.length < totalSections,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching home sections",
      error: error.message,
    });
  }
};

/**
 * GET /customer/home/sections/:sectionId/products
 *
 * Paginated products for a single home section. Used by the "See More" button
 * inside a product section to fetch the next page without re-loading the
 * entire home payload.
 *
 * Query params:
 *  - page (default 1)
 *  - limit (default 6)
 *  - latitude, longitude (for the per-product availability flag)
 */
export const getHomeSectionProducts = async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { latitude, longitude } = req.query;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid section id",
      });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit ?? "6"), 10) || 6),
    );
    const skip = (page - 1) * limit;

    const section = await HomeSection.findById(sectionId)
      .populate("categories", "name slug image")
      .populate("subCategories", "name")
      .lean();

    if (!section || !section.isActive) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    // Category / subcategory tile sections are not paginated by design — the
    // home page fetches them whole. Reject calls that don't make sense rather
    // than silently returning empty pages.
    if (section.displayType !== "products") {
      return res.status(400).json({
        success: false,
        message: `Section "${section.title}" is a ${section.displayType} section and is not paginated`,
      });
    }

    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;
    let nearbySellerIds: mongoose.Types.ObjectId[] = [];
    if (userLat !== null && userLng !== null) {
      nearbySellerIds = await findSellersWithinRange(userLat, userLng);
    }

    const { data, total } = await fetchSectionData(section, nearbySellerIds, {
      limit,
      skip,
      withTotal: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        sectionId: String(section._id),
        title: section.title,
        displayType: section.displayType,
        products: data,
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + data.length < total,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching section products",
      error: error.message,
    });
  }
};

// Get Products for a specific "Store" (Campaign/Collection)
// Fetch products based on store configuration from database
export const getStoreProducts = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { latitude, longitude } = req.query; // User location for filtering
    let query: any = {
      status: "Active",
      publish: true,
      // Only show shop-by-store-only products in shop by store section
      isShopByStoreOnly: true,
    };

    console.log(`[getStoreProducts] Looking for shop with storeId: ${storeId}`);

    // Build shop query - only include _id if storeId is a valid ObjectId
    const shopQuery: any = { isActive: true };
    if (mongoose.Types.ObjectId.isValid(storeId)) {
      shopQuery.$or = [
        { storeId: storeId.toLowerCase() },
        { _id: new mongoose.Types.ObjectId(storeId) },
      ];
    } else {
      shopQuery.storeId = storeId.toLowerCase();
    }

    // Find the shop by storeId or _id
    const shop = await Shop.findOne(shopQuery)
      .populate("category", "_id name slug image")
      .populate("subCategory", "_id name")
      .lean();

    console.log(
      `[getStoreProducts] Shop found:`,
      shop
        ? {
          name: shop.name,
          productsCount: shop.products?.length || 0,
          category: shop.category,
          image: shop.image,
        }
        : "NOT FOUND",
    );

    let shopData: any = null;

    if (shop) {
      shopData = {
        name: shop.name,
        image: shop.image,
        description: shop.description || "",
        category: shop.category,
      };

      // Convert products array to ObjectIds if needed
      // When using .lean(), products array contains ObjectIds directly
      let productIds: mongoose.Types.ObjectId[] = [];
      if (shop.products && shop.products.length > 0) {
        productIds = shop.products
          .map((p: any) => {
            // Handle different formats: ObjectId, string, or object with _id
            if (mongoose.Types.ObjectId.isValid(p)) {
              return typeof p === "string" ? new mongoose.Types.ObjectId(p) : p;
            }
            return p._id
              ? typeof p._id === "string"
                ? new mongoose.Types.ObjectId(p._id)
                : p._id
              : p;
          })
          .filter(Boolean);
      }

      console.log(
        `[getStoreProducts] Shop has ${productIds.length} products assigned`,
      );

      // Get shop ID for filtering
      const shopId = (shop as any)._id;

      // If shop has specific products assigned, use those
      if (productIds.length > 0) {
        query._id = { $in: productIds };
        // Also filter by shopId to ensure products belong to this shop
        query.shopId = shopId;
        console.log(
          `[getStoreProducts] Filtering by product IDs: ${productIds.length} products and shopId: ${shopId}`,
        );
      }
      // Otherwise, filter by shopId and category/subcategory
      else {
        // Filter by shopId to show only products assigned to this shop
        query.shopId = shopId;
        console.log(`[getStoreProducts] Filtering by shopId: ${shopId}`);

        if (shop.category) {
          const categoryId =
            (shop.category as any)._id || (shop.category as any);
          query.category = categoryId;
          console.log(
            `[getStoreProducts] Also filtering by category: ${categoryId}`,
          );

          // If subcategory is also specified, filter by both
          if (shop.subCategory) {
            const subCategoryId =
              (shop.subCategory as any)._id || (shop.subCategory as any);
            query.$or = [
              { category: categoryId, shopId: shopId },
              { subcategory: subCategoryId, shopId: shopId },
            ];
            console.log(
              `[getStoreProducts] Also filtering by subcategory: ${subCategoryId}`,
            );
          }
        }
      }
    } else {
      // Fallback: try to match by category name (legacy support)
      const categoryId = await getCategoryIdByName(storeId);
      if (categoryId) {
        query.category = categoryId;
        // Try to get category details for shop data
        const category = await Category.findById(categoryId)
          .select("name slug image")
          .lean();
        if (category) {
          shopData = {
            name: category.name,
            image: category.image || "",
            description: "",
            category: category,
          };
        }
      } else {
        // No matching shop or category found
        return res.status(200).json({
          success: true,
          data: [],
          shop: null,
          message: "Store not found",
        });
      }
    }

    // Location-based filtering: Only show products from sellers within user's range
    const userLat = latitude ? parseFloat(latitude as string) : null;
    const userLng = longitude ? parseFloat(longitude as string) : null;

    console.log(
      `[getStoreProducts] User location: lat=${userLat}, lng=${userLng}`,
    );

    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      const nearbySellerIds = await findSellersWithinRange(userLat, userLng);
      console.log(
        `[getStoreProducts] Found ${nearbySellerIds.length} sellers within range`,
      );

      if (nearbySellerIds.length === 0) {
        // No sellers within range, return shop data but empty products
        console.log(
          `[getStoreProducts] No sellers in range, returning empty products`,
        );
        return res.status(200).json({
          success: true,
          data: [],
          shop: shopData,
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            pages: 0,
          },
          message:
            "No sellers available in your area. Please update your location.",
        });
      }

      // Filter products by sellers within range
      query.seller = { $in: nearbySellerIds };
      console.log(`[getStoreProducts] Added seller filter to query`);
    } else {
      // If no location provided, return empty (require location for marketplace)
      console.log(
        `[getStoreProducts] No location provided, returning empty products`,
      );
      return res.status(200).json({
        success: true,
        data: [],
        shop: shopData,
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
        },
        message:
          "Location is required to view products. Please enable location access.",
      });
    }

    console.log(
      `[getStoreProducts] Final query:`,
      JSON.stringify(query, null, 2),
    );

    const products = await Product.find(query)
      .populate("category", "name icon image")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .populate("seller", "storeName")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean({ virtuals: true });

    const total = await Product.countDocuments(query);

    console.log(
      `[getStoreProducts] Found ${total} products matching query, returning ${products.length}`,
    );

    return res.status(200).json({
      success: true,
      data: products.map((p) => ({ ...p, isAvailable: true })),
      shop: shopData,
      pagination: {
        page: 1,
        limit: 50,
        total,
        pages: Math.ceil(total / 50),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching store products",
      error: error.message,
    });
  }
};

// Helper
async function getCategoryIdByName(name: string) {
  const cat = await Category.findOne({
    name: { $regex: new RegExp(name, "i") },
  });
  return cat ? cat._id : null;
}
