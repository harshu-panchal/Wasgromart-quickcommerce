import { Request, Response } from "express";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Product from "../../../models/Product";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Get all categories (parent categories only by default)
 */
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { includeSubcategories, search } = req.query;

    // Build query - by default, get only parent categories (no parentId)
    const query: any = { parentId: null };

    // If includeSubcategories is true, get all categories
    if (includeSubcategories === "true") {
      delete query.parentId;
    }

    // Search filter
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(query)
      .populate("headerCategoryId", "name slug")
      .sort({ name: 1 });

    // Get subcategory and product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const subcategoryCountOld = await SubCategory.countDocuments({
          category: category._id,
        });
        const subcategoryCountNew = await Category.countDocuments({
          parentId: category._id,
        });
        const subcategoryCount = subcategoryCountOld + subcategoryCountNew;

        const productCount = await Product.countDocuments({
          category: category._id, // Note: Product model uses 'category', not 'categoryId'
        });

        return {
          ...category.toObject(),
          totalSubcategory: subcategoryCount,
          totalProduct: productCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categoriesWithCounts,
    });
  }
);

/**
 * Get category by ID
 */
export const getCategoryById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get counts
    const subcategoryCount = await Category.countDocuments({
      parentId: category._id,
    });

    const productCount = await Product.countDocuments({
      categoryId: category._id,
    });

    const categoryWithCounts = {
      ...category.toObject(),
      totalSubcategory: subcategoryCount,
      totalProduct: productCount,
    };

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: categoryWithCounts,
    });
  }
);

/**
 * Get subcategories by parent category ID
 * Supports both old SubCategory model and new Category model (with parentId)
 */
export const getSubcategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      search,
      page = "1",
      limit = "10",
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Verify parent category exists
    const parentCategory = await Category.findById(id);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    const sortField =
      sortBy === "subcategoryName" ? "name" : (sortBy as string);
    sort[sortField] = sortOrder === "asc" ? 1 : -1;

    // Build search query
    const searchQuery = search
      ? { $regex: search as string, $options: "i" }
      : undefined;

    // 1. Get subcategories from new Category model (where parentId = category id)
    const categorySubcategoriesQuery: any = {
      parentId: id,
      status: "Active", // Only active subcategories
    };
    if (searchQuery) {
      categorySubcategoriesQuery.name = searchQuery;
    }

    const categorySubcategories = await Category.find(
      categorySubcategoriesQuery
    )
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 2. Get subcategories from old SubCategory model (for backward compatibility)
    const oldSubcategoryQuery: any = { category: id };
    if (searchQuery) {
      oldSubcategoryQuery.name = searchQuery;
    }

    const oldSubcategories = await SubCategory.find(oldSubcategoryQuery)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Combine both results
    const allSubcategories = [
      ...categorySubcategories.map((cat) => ({
        _id: cat._id,
        name: cat.name,
        subcategoryName: cat.name, // Map name to subcategoryName for frontend compatibility
        categoryName: parentCategory.name,
        image: cat.image,
        subcategoryImage: cat.image,
        order: cat.order || 0,
        totalProduct: 0, // Will be calculated below
        isNewModel: true, // Flag to identify new model
      })),
      ...oldSubcategories.map((sub) => ({
        _id: sub._id,
        name: sub.name,
        subcategoryName: sub.name,
        categoryName: parentCategory.name,
        image: sub.image,
        subcategoryImage: sub.image,
        order: sub.order || 0,
        totalProduct: 0, // Will be calculated below
        isNewModel: false, // Flag to identify old model
      })),
    ];

    // Remove duplicates (in case same subcategory exists in both models)
    const uniqueSubcategories = Array.from(
      new Map(
        allSubcategories.map((item) => [item._id.toString(), item])
      ).values()
    );

    // Sort combined results
    uniqueSubcategories.sort((a, b) => {
      const aValue = (a as any)[sortField] || "";
      const bValue = (b as any)[sortField] || "";
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination to combined results
    const paginatedSubcategories = uniqueSubcategories.slice(
      skip,
      skip + limitNum
    );

    // Get product counts for each subcategory
    const subcategoriesWithCounts = await Promise.all(
      paginatedSubcategories.map(async (subcategory) => {
        // Count products - check both old and new models
        const productCountOld = await Product.countDocuments({
          subcategory: subcategory._id,
        });

        // For new model, products might reference category directly
        const productCountNew = await Product.countDocuments({
          category: subcategory._id,
        });

        const totalProduct = productCountOld + productCountNew;

        return {
          ...subcategory,
          totalProduct,
        };
      })
    );

    // Get total count for pagination
    const totalCategorySubs = await Category.countDocuments(
      categorySubcategoriesQuery
    );
    const totalOldSubs = await SubCategory.countDocuments(oldSubcategoryQuery);
    const total = totalCategorySubs + totalOldSubs;

    return res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: subcategoriesWithCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get all categories with their subcategories nested
 */
export const getAllCategoriesWithSubcategories = asyncHandler(
  async (_req: Request, res: Response) => {
    // Get all parent categories
    const parentCategories = await Category.find({ parentId: null }).sort({
      name: 1,
    });

    // Get all subcategories grouped by parent
    const categoriesWithSubcategories = await Promise.all(
      parentCategories.map(async (category) => {
        // Fetch from new model (Category with parentId)
        const subcategoriesNew = await Category.find({
          parentId: category._id,
          status: "Active"
        }).sort({ name: 1 }).lean();

        // Fetch from old model (SubCategory)
        const subcategoriesOld = await SubCategory.find({
          category: category._id,
        }).sort({ name: 1 }).lean();

        // Combine
        const combinedSubcategories = [
          ...subcategoriesNew.map(cat => ({
            _id: cat._id,
            name: cat.name,
            category: category._id,
            image: cat.image,
            order: cat.order || 0,
            isNewModel: true
          })),
          ...subcategoriesOld.map(sub => ({
            _id: sub._id,
            name: sub.name,
            category: sub.category,
            image: sub.image,
            order: sub.order || 0,
            isNewModel: false
          }))
        ];

        // Deduplicate
        const uniqueSubcategories = Array.from(
          new Map(
            combinedSubcategories.map((item) => [item._id.toString(), item])
          ).values()
        );

        uniqueSubcategories.sort((a, b) => a.name.localeCompare(b.name));

        // Get product counts for combined subcategories
        const subcategoriesWithCounts = await Promise.all(
          uniqueSubcategories.map(async (subcategory) => {
            const productCountOld = await Product.countDocuments({
              subcategory: subcategory._id,
            });
            const productCountNew = await Product.countDocuments({
              category: subcategory._id,
            });
            const productCount = productCountOld + productCountNew;

            return {
              ...subcategory,
              totalProduct: productCount,
            };
          })
        );

        const productCount = await Product.countDocuments({
          category: category._id,
        });

        return {
          ...category.toObject(),
          totalSubcategory: uniqueSubcategories.length,
          totalProduct: productCount,
          subcategories: subcategoriesWithCounts,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Categories with subcategories fetched successfully",
      data: categoriesWithSubcategories,
    });
  }
);

/**
 * Get all subcategories (across all categories)
 */
export const getAllSubcategories = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      search,
      page = "1",
      limit = "10",
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // 1. Fetch subcategories from new Category model (where parentId != null)
    const categoryQuery: any = { parentId: { $ne: null } };
    if (search) {
      categoryQuery.name = { $regex: search as string, $options: "i" };
    }
    const categorySubcategories = await Category.find(categoryQuery)
      .populate("parentId", "name")
      .lean();

    // 2. Fetch subcategories from old SubCategory model
    const subcategoryQuery: any = {};
    if (search) {
      subcategoryQuery.name = { $regex: search as string, $options: "i" };
    }
    const oldSubcategories = await SubCategory.find(subcategoryQuery)
      .populate("category", "name")
      .lean();

    // 3. Combine both lists
    const allSubcategories = [
      ...categorySubcategories.map((cat) => ({
        _id: cat._id.toString(),
        id: cat._id.toString(),
        categoryName: (cat.parentId as any)?.name || "Unknown",
        subcategoryName: cat.name,
        subcategoryImage: cat.image || "",
        order: cat.order || 0,
        isNewModel: true,
      })),
      ...oldSubcategories.map((sub) => ({
        _id: sub._id.toString(),
        id: sub._id.toString(),
        categoryName: (sub.category as any)?.name || "Unknown",
        subcategoryName: sub.name,
        subcategoryImage: sub.image || "",
        order: sub.order || 0,
        isNewModel: false,
      })),
    ];

    // Deduplicate
    const uniqueSubcategories = Array.from(
      new Map(
        allSubcategories.map((item) => [item._id, item])
      ).values()
    );

    // Sort
    const sortField =
      sortBy === "subcategoryName" ? "subcategoryName" : sortBy === "categoryName" ? "categoryName" : "order";
    
    uniqueSubcategories.sort((a: any, b: any) => {
      const aValue = a[sortField] !== undefined ? a[sortField] : "";
      const bValue = b[sortField] !== undefined ? b[sortField] : "";

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "desc"
          ? bValue.localeCompare(aValue)
          : aValue.localeCompare(bValue);
      } else {
        return sortOrder === "desc"
          ? (aValue < bValue ? 1 : -1)
          : (aValue > bValue ? 1 : -1);
      }
    });

    const total = uniqueSubcategories.length;

    // Paginate
    const paginatedSubcategories = uniqueSubcategories.slice(
      skip,
      skip + limitNum
    );

    // Get product counts
    const subcategoriesWithCounts = await Promise.all(
      paginatedSubcategories.map(async (subcategory: any) => {
        const productCountOld = await Product.countDocuments({
          subcategory: subcategory._id,
        });
        const productCountNew = await Product.countDocuments({
          category: subcategory._id,
        });
        const productCount = productCountOld + productCountNew;

        return {
          ...subcategory,
          totalProduct: productCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: subcategoriesWithCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get sub-subcategories by subcategory ID
 */
export const getSubSubCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { subCategoryId } = req.params;
    const { search, isActive } = req.query;

    // Query Category model where parentId is the subcategory ID
    const query: any = { parentId: subCategoryId };

    if (isActive === "true") {
      query.status = "Active";
    }

    if (search) {
      query.name = { $regex: search as string, $options: "i" };
    }

    const subSubCategories = await Category.find(query)
      .sort({ order: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Sub-subcategories fetched successfully",
      data: subSubCategories,
    });
  }
);
