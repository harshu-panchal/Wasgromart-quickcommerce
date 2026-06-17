import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadImage, uploadImages } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
} from "../../../utils/imageUpload";
import {
  updateProduct,
  getProductById,
  getCategories,
  getBrands,
  getSellers,
  type Product,
  type Category,
  type Brand,
  type Seller,
} from "../../../services/api/admin/adminProductService";
import { getActiveTaxes, Tax } from "../../../services/api/taxService";
import {
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";

import { useAuth } from "../../../context/AuthContext";

export default function AdminEditProduct() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();

  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [variations, setVariations] = useState<any[]>([]);

  // Image states
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string>("");
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([]);
  const [galleryImagePreviews, setGalleryImagePreviews] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const [variationForm, setVariationForm] = useState({
    name: "",
    value: "",
    price: "",
    stock: "0",
    sku: "",
  });

  const [formData, setFormData] = useState({
    productName: "",
    headerCategory: "",
    category: "",
    subcategory: "",
    brand: "",
    tags: "",
    manufacturer: "",
    madeIn: "",
    variationType: "",
    tax: "",
    description: "",
    smallDescription: "",
    seoTitle: "",
    seoKeywords: "",
    seoImageAlt: "",
    seoDescription: "",
    isReturnable: "No",
    maxReturnDays: "",
    fssaiLicNo: "",
    totalAllowedQuantity: "10",
    publish: "Yes",
    popular: "No",
    dealOfDay: "No",
    mainImageUrl: "",
    galleryImageUrls: [] as string[],
    seller: "",
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const results = await Promise.allSettled([
          getActiveTaxes(),
          getBrands(),
          getHeaderCategoriesPublic(),
          getSellers(),
        ]);

        if (results[0].status === "fulfilled" && results[0].value.success) {
          setTaxes(results[0].value.data);
        }

        if (results[1].status === "fulfilled" && results[1].value.success) {
          setBrands(results[1].value.data);
        }

        if (results[2].status === "fulfilled") {
          const headerCatRes = results[2].value;
          if (headerCatRes && Array.isArray(headerCatRes)) {
            setHeaderCategories(headerCatRes.filter((hc: HeaderCategory) => hc.status === "Published"));
          }
        }

        if (results[3].status === "fulfilled" && results[3].value.success) {
          setSellers(results[3].value.data);
        }
      } catch (err) {
        console.error("Error fetching form data:", err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchProduct = async () => {
        try {
          setLoading(true);
          const response = await getProductById(id);
          if (response.success && response.data) {
            const product = response.data;
            setFormData({
              productName: product.productName,
              headerCategory: (product as any).headerCategoryId?._id || (product as any).headerCategoryId || "",
              category: typeof product.category === 'object' ? product.category?._id : product.category || "",
              subcategory: typeof product.subcategory === 'object' ? product.subcategory?._id : product.subcategory || "",
              publish: product.publish ? "Yes" : "No",
              popular: product.popular ? "Yes" : "No",
              dealOfDay: product.dealOfDay ? "Yes" : "No",
              brand: typeof product.brand === 'object' ? product.brand?._id : product.brand || "",
              tags: product.tags?.join(", ") || "",
              smallDescription: product.smallDescription || "",
              seoTitle: product.seoTitle || "",
              seoKeywords: product.seoKeywords || "",
              seoImageAlt: product.seoImageAlt || "",
              seoDescription: product.seoDescription || "",
              variationType: product.variationType || "",
              manufacturer: product.manufacturer || "",
              madeIn: product.madeIn || "",
              tax: product.tax || "",
              isReturnable: product.isReturnable ? "Yes" : "No",
              maxReturnDays: product.maxReturnDays?.toString() || "",
              fssaiLicNo: product.fssaiLicNo || "",
              totalAllowedQuantity: product.totalAllowedQuantity?.toString() || "10",
              mainImageUrl: product.mainImage || "",
              galleryImageUrls: product.galleryImages || [],
              description: product.description || "",
              seller: typeof product.seller === 'object' ? (product.seller as any)._id : product.seller || "",
            });
            setVariations(product.variations || []);
            if (product.mainImage) {
              setMainImagePreview(product.mainImage);
            }
            if (product.galleryImages) {
              setGalleryImagePreviews(product.galleryImages);
            }
          }
        } catch (err) {
          console.error("Error fetching product:", err);
          setUploadError("Failed to fetch product details");
        } finally {
          setLoading(false);
        }
      };
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    const fetchCats = async () => {
      if (formData.headerCategory) {
        try {
          const res = await getCategories({ headerCategoryId: formData.headerCategory, status: "Active" });
          if (res.success) setCategories(res.data);
        } catch (err) {
          console.error("Error fetching categories:", err);
        }
      } else {
        setCategories([]);
      }
    };
    fetchCats();
  }, [formData.headerCategory]);

  useEffect(() => {
    const fetchSubs = async () => {
      if (formData.category) {
        try {
          const res = await getCategories({ parentId: formData.category, status: "Active" });
          if (res.success) setSubcategories(res.data);
        } catch (err) {
          console.error("Error fetching subcategories:", err);
        }
      } else {
        setSubcategories([]);
      }
    };
    fetchSubs();
  }, [formData.category]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (name === "headerCategory") {
      setFormData((prev) => ({
        ...prev,
        headerCategory: value,
        category: "",
        subcategory: "",
      }));
    } else if (name === "category") {
      setFormData((prev) => ({
        ...prev,
        category: value,
        subcategory: "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleMainImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image file");
      return;
    }

    setMainImageFile(file);
    setUploadError("");

    try {
      const preview = await createImagePreview(file);
      setMainImagePreview(preview);
    } catch (error) {
      setUploadError("Failed to create image preview");
    }
  };

  const handleGalleryImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidFiles = files.filter((file) => !validateImageFile(file).valid);
    if (invalidFiles.length > 0) {
      setUploadError("Some files are invalid. Please check file types and sizes.");
      return;
    }

    setGalleryImageFiles(files);
    setUploadError("");

    try {
      const previews = await Promise.all(
        files.map((file) => createImagePreview(file))
      );
      setGalleryImagePreviews(previews);
    } catch (error) {
      setUploadError("Failed to create image previews");
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImagePreviews((prev) => prev.filter((_, i) => i !== index));
    // If it's a new file
    if (index < galleryImageFiles.length) {
      setGalleryImageFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      // If it was an existing image
      setFormData(prev => ({
        ...prev,
        galleryImageUrls: prev.galleryImageUrls.filter((_, i) => i !== (index - galleryImageFiles.length))
      }));
    }
  };

  const addVariation = () => {
    if (!variationForm.name || !variationForm.value || !variationForm.price) {
      setUploadError("Please fill in variation name, value and price");
      return;
    }

    const newVariation = {
      name: variationForm.name,
      value: variationForm.value,
      price: parseFloat(variationForm.price),
      stock: parseInt(variationForm.stock || "0"),
      sku: variationForm.sku,
    };

    setVariations([...variations, newVariation]);
    setVariationForm({
      name: "",
      value: "",
      price: "",
      stock: "0",
      sku: "",
    });
    setUploadError("");
  };

  const removeVariation = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    if (!formData.productName.trim()) {
      setUploadError("Please enter a product name.");
      return;
    }

    setUploading(true);

    try {
      let mainImage = formData.mainImageUrl;
      let galleryImages = [...formData.galleryImageUrls];

      if (mainImageFile) {
        const mainImageResult = await uploadImage(mainImageFile, "products");
        mainImage = mainImageResult.secureUrl;
      }

      if (galleryImageFiles.length > 0) {
        const galleryResults = await uploadImages(galleryImageFiles, "products/gallery");
        galleryImages = [...galleryImages, ...galleryResults.map((result) => result.secureUrl)];
      }

      const tagsArray = formData.tags
        ? formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [];

      const productData: any = {
        productName: formData.productName,
        headerCategoryId: formData.headerCategory || undefined,
        category: formData.category || undefined,
        subcategory: formData.subcategory || undefined,
        brand: formData.brand || undefined,
        publish: formData.publish === "Yes",
        popular: formData.popular === "Yes",
        dealOfDay: formData.dealOfDay === "Yes",
        seoTitle: formData.seoTitle || undefined,
        seoKeywords: formData.seoKeywords || undefined,
        seoImageAlt: formData.seoImageAlt || undefined,
        seoDescription: formData.seoDescription || undefined,
        smallDescription: formData.smallDescription || undefined,
        tags: tagsArray,
        manufacturer: formData.manufacturer || undefined,
        madeIn: formData.madeIn || undefined,
        tax: formData.tax || undefined,
        isReturnable: formData.isReturnable === "Yes",
        maxReturnDays: formData.maxReturnDays ? parseInt(formData.maxReturnDays) : undefined,
        totalAllowedQuantity: parseInt(formData.totalAllowedQuantity || "10"),
        fssaiLicNo: formData.fssaiLicNo || undefined,
        mainImage: mainImage || undefined,
        galleryImages,
        variations: variations,
        variationType: formData.variationType || undefined,
        description: formData.description || undefined,
        seller: formData.seller || undefined,
      };

      const response = await updateProduct(id as string, productData);

      if (response.success) {
        setSuccessMessage("Product updated successfully!");
        setTimeout(() => {
          navigate("/admin/product/list");
        }, 1500);
      } else {
        setUploadError(response.message || "Failed to update product");
      }
    } catch (error: any) {
      setUploadError(error.response?.data?.message || error.message || "Failed to update product.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-teal-800">Edit Product</h1>
        <div className="text-sm">
          <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => navigate("/admin")}>Home</span>
          <span className="text-neutral-400 mx-2">/</span>
          <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => navigate("/admin/product/list")}>Products</span>
          <span className="text-neutral-400 mx-2">/</span>
          Edit Product
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-6 py-4">
            <h2 className="text-lg font-semibold">Product Information</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Product Name</label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Seller</label>
                <select
                  name="seller"
                  value={formData.seller}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="">Select Seller</option>
                  {sellers.map((s) => (
                    <option key={s._id} value={s._id}>{s.storeName || s.sellerName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Header Category</label>
                <select
                  name="headerCategory"
                  value={formData.headerCategory}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="">Select Header Category</option>
                  {headerCategories.map((hc) => (
                    <option key={hc._id} value={hc._id}>{hc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Sub Category</label>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="">Select Sub Category</option>
                  {subcategories.map((sc) => (
                    <option key={sc._id} value={sc._id}>{sc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Brand</label>
                <select
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="">Select Brand</option>
                  {brands.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Variation Type (e.g. Size, Color)</label>
                <input
                  type="text"
                  name="variationType"
                  value={formData.variationType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Size"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Publish</label>
                <select
                  name="publish"
                  value={formData.publish}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Popular</label>
                <select
                  name="popular"
                  value={formData.popular}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Deal of Day</label>
                <select
                  name="dealOfDay"
                  value={formData.dealOfDay}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="Enter product description"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Images Section */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-6 py-4">
            <h2 className="text-lg font-semibold">Product Images</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Main Image</label>
                <input
                  type="file"
                  onChange={handleMainImageChange}
                  accept="image/*"
                  className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
                {mainImagePreview && (
                  <div className="mt-4">
                    <img src={mainImagePreview} alt="Main Preview" className="w-32 h-32 object-cover rounded-lg border" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Gallery Images</label>
                <input
                  type="file"
                  multiple
                  onChange={handleGalleryImagesChange}
                  accept="image/*"
                  className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
                <div className="mt-4 flex flex-wrap gap-4">
                  {galleryImagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img src={preview} alt={`Gallery ${index}`} className="w-24 h-24 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Variations Section */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-6 py-4">
            <h2 className="text-lg font-semibold">Product Variations</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Name (e.g. Size)"
                value={variationForm.name}
                onChange={(e) => setVariationForm({ ...variationForm, name: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg outline-none"
              />
              <input
                type="text"
                placeholder="Value (e.g. XL)"
                value={variationForm.value}
                onChange={(e) => setVariationForm({ ...variationForm, value: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg outline-none"
              />
              <input
                type="number"
                placeholder="Price"
                value={variationForm.price}
                onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg outline-none"
              />
              <input
                type="number"
                placeholder="Stock"
                value={variationForm.stock}
                onChange={(e) => setVariationForm({ ...variationForm, stock: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg outline-none"
              />
              <button
                type="button"
                onClick={addVariation}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              >
                Add Variation
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b">
                    <th className="p-4">Name</th>
                    <th className="p-4">Value</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {variations.map((v, index) => (
                    <tr key={index} className="border-b text-sm">
                      <td className="p-4">{v.name}</td>
                      <td className="p-4">{v.value}</td>
                      <td className="p-4">₹{v.price}</td>
                      <td className="p-4">{v.stock}</td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => removeVariation(index)}
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {variations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-neutral-400">No variations added.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {uploadError && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{uploadError}</div>}
        {successMessage && <div className="p-4 bg-green-100 text-green-700 rounded-lg">{successMessage}</div>}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/product/list")}
            className="px-6 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className={`px-8 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
          >
            {uploading ? "Updating..." : "Update Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
