import React, { useState, useEffect, useRef } from "react";
import { createProduct, getShops, Shop, bulkCreateProducts } from "../../../services/api/productService";
import { uploadImage } from "../../../services/api/uploadService";
import {
  getCategories,
  getSubcategories,
  getSubSubCategories,
  Category,
  SubCategory,
  SubSubCategory,
} from "../../../services/api/categoryService";
import { getActiveTaxes, Tax } from "../../../services/api/taxService";
import { getBrands, Brand } from "../../../services/api/brandService";
import {
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

interface ProductRow {
  id: string;
  productName: string;
  headerCategory: string;
  category: string;
  subcategory: string;
  subSubCategory: string;
  brand: string;
  publish: string;
  popular: string;
  dealOfDay: string;
  variationTitle: string;
  variationType: string;
  price: string;
  discPrice: string;
  stock: string;
  tax: string;
  isReturnable: string;
  maxReturnDays: string;
  fssaiLicNo: string;
  totalAllowedQuantity: string;
  manufacturer: string;
  madeIn: string;
  tags: string;
  hsnCode: string;
  description: string;
  smallDescription: string;
  seoTitle: string;
  seoKeywords: string;
  seoImageAlt: string;
  seoDescription: string;
  mainImageFile: File | null;
  mainImagePreview: string;
  status: "idle" | "uploading" | "success" | "error";
  errorMsg?: string;
  // Row-specific lists
  categoriesList: Category[];
  subcategoriesList: SubCategory[];
  subSubCategoriesList: SubSubCategory[];
}

export default function SellerBulkUpload() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, taxRes, brandRes, hCatRes, shopRes] = await Promise.all([
          getCategories(),
          getActiveTaxes(),
          getBrands(),
          getHeaderCategoriesPublic(),
          getShops(),
        ]);

        if (catRes.success) setAllCategories(catRes.data);
        if (taxRes.success) setTaxes(taxRes.data);
        if (brandRes.success) setBrands(brandRes.data);
        if (shopRes.success) setShops(shopRes.data);

        if (Array.isArray(hCatRes)) {
          let published = hCatRes.filter((hc) => hc.status === "Published");
          if (user && user.userType === "Seller") {
            const rawCategories = user.categories || (user.category ? [user.category] : []);
            const sellerCategories = Array.isArray(rawCategories)
              ? rawCategories.filter(c => typeof c === 'string').map(c => (c as string).toLowerCase())
              : [];

            if (sellerCategories.length > 0) {
              published = published.filter(hc => {
                const hcName = hc.name.toLowerCase();
                return sellerCategories.some((sc: string) =>
                  hcName.includes(sc) || sc.includes(hcName) ||
                  (sc === 'medicine' && (hcName === 'medicines' || hcName === 'pharmacy'))
                );
              });
            }
          }
          setHeaderCategories(published);
        }
        
        // Add initial row
        addNewRow();
      } catch (err) {
        console.error("Error fetching initial data:", err);
        showToast("Failed to load form data", "error");
      }
    };
    fetchData();
  }, []);

  const createEmptyRow = (): ProductRow => ({
    id: Math.random().toString(36).substr(2, 9),
    productName: "",
    headerCategory: "",
    category: "",
    subcategory: "",
    subSubCategory: "",
    brand: "",
    publish: "Yes",
    popular: "No",
    dealOfDay: "No",
    variationTitle: "",
    variationType: "Size",
    price: "",
    discPrice: "0",
    stock: "0",
    tax: "",
    isReturnable: "No",
    maxReturnDays: "",
    fssaiLicNo: "",
    totalAllowedQuantity: "10",
    manufacturer: "",
    madeIn: "",
    tags: "",
    hsnCode: "",
    description: "",
    smallDescription: "",
    seoTitle: "",
    seoKeywords: "",
    seoImageAlt: "",
    seoDescription: "",
    mainImageFile: null,
    mainImagePreview: "",
    status: "idle",
    categoriesList: [],
    subcategoriesList: [],
    subSubCategoriesList: [],
  });

  const addNewRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(row => row.id !== id));
    } else {
      showToast("At least one row is required", "error");
    }
  };

  const updateRow = (id: string, field: keyof ProductRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };

        // Handle cascading dropdowns
        if (field === "headerCategory") {
          updatedRow.category = "";
          updatedRow.subcategory = "";
          updatedRow.subSubCategory = "";
          updatedRow.categoriesList = allCategories.filter(cat => {
            const hId = typeof cat.headerCategoryId === "string" ? cat.headerCategoryId : (cat.headerCategoryId as any)?._id;
            return hId === value;
          });
          updatedRow.subcategoriesList = [];
          updatedRow.subSubCategoriesList = [];
        }

        if (field === "category") {
          updatedRow.subcategory = "";
          updatedRow.subSubCategory = "";
          if (value) {
            getSubcategories(value).then(res => {
              if (res.success) {
                setRows(current => current.map(r => r.id === id ? { ...r, subcategoriesList: res.data } : r));
              }
            });
          }
        }

        if (field === "subcategory") {
          updatedRow.subSubCategory = "";
          if (value) {
            getSubSubCategories(value).then(res => {
              if (res.success) {
                setRows(current => current.map(r => r.id === id ? { ...r, subSubCategoriesList: res.data } : r));
              }
            });
          }
        }

        return updatedRow;
      }
      return row;
    }));
  };

  const handleImageChange = (id: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRows(prev => prev.map(row => 
        row.id === id ? { ...row, mainImageFile: file, mainImagePreview: reader.result as string } : row
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitAll = async () => {
    if (isSubmitting) return;

    // Basic validation
    const pendingRows = rows.filter(r => r.status !== 'success');
    if (pendingRows.length === 0) {
      showToast("No new rows to save", "info");
      return;
    }

    const invalidRows = pendingRows.filter(r => !r.productName || !r.price || !r.headerCategory || !r.category);
    if (invalidRows.length > 0) {
      showToast("Please fill required fields (Name, Price, Category) for all active rows", "error");
      return;
    }

    setIsSubmitting(true);
    
    // Process rows one by one for image uploads and preparation
    const preparedProducts: any[] = [];
    const rowIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "success") continue;

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "uploading" } : r));

      try {
        let mainImageUrl = "";
        if (row.mainImageFile) {
          const uploadRes = await uploadImage(row.mainImageFile, "Wasgro mart/products");
          mainImageUrl = uploadRes.secureUrl;
        }

        const productData = {
          productName: row.productName,
          headerCategoryId: row.headerCategory,
          categoryId: row.category,
          subcategoryId: row.subcategory || undefined,
          subSubCategoryId: row.subSubCategory || undefined,
          brandId: row.brand || undefined,
          publish: row.publish === "Yes",
          popular: row.popular === "Yes",
          dealOfDay: row.dealOfDay === "Yes",
          taxId: row.tax || undefined,
          isReturnable: row.isReturnable === "Yes",
          maxReturnDays: row.maxReturnDays ? parseInt(row.maxReturnDays) : undefined,
          totalAllowedQuantity: parseInt(row.totalAllowedQuantity || "10"),
          fssaiLicNo: row.fssaiLicNo || undefined,
          manufacturer: row.manufacturer || undefined,
          madeIn: row.madeIn || undefined,
          tags: row.tags ? row.tags.split(",").map(t => t.trim()) : [],
          smallDescription: row.smallDescription || undefined,
          description: row.description || undefined,
          hsnCode: row.hsnCode || undefined,
          seoTitle: row.seoTitle || undefined,
          seoKeywords: row.seoKeywords || undefined,
          seoImageAlt: row.seoImageAlt || undefined,
          seoDescription: row.seoDescription || undefined,
          mainImageUrl: mainImageUrl || undefined,
          variations: [
            {
              title: row.variationTitle || "Default",
              price: parseFloat(row.price),
              discPrice: parseFloat(row.discPrice || "0"),
              stock: parseInt(row.stock || "0"),
              status: parseInt(row.stock || "0") > 0 ? "Available" : "Sold out" as any
            }
          ],
          variationType: row.variationType || "Size"
        };

        preparedProducts.push(productData);
        rowIds.push(row.id);
      } catch (err: any) {
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "error", errorMsg: "Image upload failed" } : r));
      }
    }

    if (preparedProducts.length > 0) {
      try {
        const res = await bulkCreateProducts(preparedProducts);
        
        if (res.success) {
          // Update status for each row based on bulk results
          const bulkResults = res.data.errors || [];
          
          setRows(prev => prev.map(row => {
            if (!rowIds.includes(row.id)) return row;
            
            const rowIndex = rowIds.indexOf(row.id) + 1;
            const error = bulkResults.find((e: any) => e.index === rowIndex);
            
            if (error) {
              return { ...row, status: "error", errorMsg: error.error };
            } else if (row.status === "uploading") {
              return { ...row, status: "success" };
            }
            return row;
          }));

          showToast(res.message, "success");
        } else {
          showToast(res.message, "error");
        }
      } catch (err: any) {
        showToast(err.message || "Bulk save failed", "error");
      }
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 bg-neutral-50 min-h-screen w-full max-w-full overflow-hidden box-border">
      {/* Outer Card - Hard Constrained to prevent horizontal stretching */}
      <div className="w-full bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden flex flex-col min-w-0 max-w-full relative">
        
        {/* FIXED HEADER: Locked to Card Width */}
        <div className="w-full bg-teal-700 text-white shrink-0 z-30">
          <div className="px-3 sm:px-6 py-4 flex flex-col md:flex-row justify-between md:items-center gap-3 sm:gap-4 w-full box-border max-w-full overflow-hidden">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-bold truncate">Bulk Manual Product Entry</h2>
              <p className="text-teal-100 text-[10px] sm:text-sm truncate">Add multiple products at once in a horizontal format</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={addNewRow}
                className="bg-white/20 hover:bg-white/30 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-white/30 transition-all flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                <svg width="14" height="14" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add New Row
              </button>
              <button
                onClick={handleSubmitAll}
                disabled={isSubmitting}
                className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap ${
                  isSubmitting ? "bg-neutral-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 text-white animate-pulse-subtle"
                }`}
              >
                {isSubmitting ? "Processing..." : "Save All Products"}
              </button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE BODY: Only this part is allowed to scroll horizontally */}
        <div className="flex-1 overflow-x-auto custom-scrollbar w-full border-t border-neutral-100 bg-white min-w-0">
          <table className="text-sm text-left border-collapse min-w-[5000px] w-full table-fixed">
            <thead>
              <tr className="bg-neutral-100 text-neutral-700 border-b border-neutral-200">
                <th className="px-4 py-4 font-bold sticky left-0 bg-neutral-100 z-10 border-r shadow-sm w-[250px]">Product Name *</th>
                <th className="px-4 py-4 font-bold w-[200px]">Header Category *</th>
                <th className="px-4 py-4 font-bold w-[200px]">Category *</th>
                <th className="px-4 py-4 font-bold w-[200px]">SubCategory</th>
                <th className="px-4 py-4 font-bold w-[200px]">Sub-SubCategory</th>
                <th className="px-4 py-4 font-bold w-[180px]">Brand</th>
                <th className="px-4 py-4 font-bold w-[120px]">Price *</th>
                <th className="px-4 py-4 font-bold w-[120px]">Disc Price</th>
                <th className="px-4 py-4 font-bold w-[100px]">Stock</th>
                <th className="px-4 py-4 font-bold w-[180px]">Variation Title</th>
                <th className="px-4 py-4 font-bold w-[150px]">Variation Type</th>
                <th className="px-4 py-4 font-bold w-[100px]">Publish</th>
                <th className="px-4 py-4 font-bold w-[100px]">Popular</th>
                <th className="px-4 py-4 font-bold w-[100px]">DealOfDay</th>
                <th className="px-4 py-4 font-bold w-[120px]">Tax</th>
                <th className="px-4 py-4 font-bold w-[100px]">Returnable</th>
                <th className="px-4 py-4 font-bold w-[100px]">Max Days</th>
                <th className="px-4 py-4 font-bold w-[180px]">FSSAI No</th>
                <th className="px-4 py-4 font-bold w-[120px]">Max Qty</th>
                <th className="px-4 py-4 font-bold w-[120px]">HSN Code</th>
                <th className="px-4 py-4 font-bold w-[200px]">Manufacturer</th>
                <th className="px-4 py-4 font-bold w-[150px]">Made In</th>
                <th className="px-4 py-4 font-bold w-[300px]">Description</th>
                <th className="px-4 py-4 font-bold w-[250px]">Small Description</th>
                <th className="px-4 py-4 font-bold w-[200px]">Tags</th>
                <th className="px-4 py-4 font-bold w-[150px]">SEO Title</th>
                <th className="px-4 py-4 font-bold w-[150px]">SEO Keywords</th>
                <th className="px-4 py-4 font-bold w-[150px]">SEO Alt</th>
                <th className="px-4 py-4 font-bold w-[200px]">SEO Desc</th>
                <th className="px-4 py-4 font-bold w-[250px]">Main Image</th>
                <th className="px-4 py-4 font-bold w-[150px]">Status</th>
                <th className="px-4 py-4 font-bold w-[80px] sticky right-0 bg-neutral-100 z-10 border-l shadow-sm text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((row) => (
                <tr key={row.id} className={`hover:bg-teal-50/30 transition-colors ${row.status === 'success' ? 'bg-green-50' : row.status === 'error' ? 'bg-red-50' : ''}`}>
                  {/* Product Name */}
                  <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r shadow-sm">
                    <input
                      type="text"
                      value={row.productName}
                      onChange={(e) => updateRow(row.id, "productName", e.target.value)}
                      placeholder="Product Name"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>

                  {/* Header Category */}
                  <td className="px-4 py-3">
                    <select
                      value={row.headerCategory}
                      onChange={(e) => updateRow(row.id, "headerCategory", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    >
                      <option value="">Select Header</option>
                      {headerCategories.map(hc => (
                        <option key={hc._id} value={hc._id}>{hc.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <select
                      value={row.category}
                      onChange={(e) => updateRow(row.id, "category", e.target.value)}
                      disabled={!row.headerCategory}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white disabled:bg-neutral-100"
                    >
                      <option value="">Select Category</option>
                      {row.categoriesList.map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* SubCategory */}
                  <td className="px-4 py-3">
                    <select
                      value={row.subcategory}
                      onChange={(e) => updateRow(row.id, "subcategory", e.target.value)}
                      disabled={!row.category}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white disabled:bg-neutral-100"
                    >
                      <option value="">Select Sub</option>
                      {row.subcategoriesList.map(sub => (
                        <option key={sub._id} value={sub._id}>{sub.subcategoryName}</option>
                      ))}
                    </select>
                  </td>

                  {/* Sub-SubCategory */}
                  <td className="px-4 py-3">
                    <select
                      value={row.subSubCategory}
                      onChange={(e) => updateRow(row.id, "subSubCategory", e.target.value)}
                      disabled={!row.subcategory}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white disabled:bg-neutral-100"
                    >
                      <option value="">Select Sub-Sub</option>
                      {row.subSubCategoriesList.map(subSub => (
                        <option key={subSub._id} value={subSub._id}>{subSub.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3">
                    <select
                      value={row.brand}
                      onChange={(e) => updateRow(row.id, "brand", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    >
                      <option value="">Select Brand</option>
                      {brands.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) => updateRow(row.id, "price", e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>

                  {/* Disc Price */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.discPrice}
                      onChange={(e) => updateRow(row.id, "discPrice", e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.stock}
                      onChange={(e) => updateRow(row.id, "stock", e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>

                  {/* Variation Title */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.variationTitle}
                      onChange={(e) => updateRow(row.id, "variationTitle", e.target.value)}
                      placeholder="e.g. 500g"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>

                  {/* Variation Type */}
                  <td className="px-4 py-3">
                    <select
                      value={row.variationType}
                      onChange={(e) => updateRow(row.id, "variationType", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    >
                      <option value="Size">Size</option>
                      <option value="Weight">Weight</option>
                      <option value="Color">Color</option>
                      <option value="Pack">Pack</option>
                    </select>
                  </td>

                  {/* Publish */}
                  <td className="px-4 py-3 text-center">
                    <select
                      value={row.publish}
                      onChange={(e) => updateRow(row.id, "publish", e.target.value)}
                      className="w-full px-2 py-2 border rounded-lg bg-white"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>

                  {/* Popular */}
                  <td className="px-4 py-3 text-center">
                    <select
                      value={row.popular}
                      onChange={(e) => updateRow(row.id, "popular", e.target.value)}
                      className="w-full px-2 py-2 border rounded-lg bg-white"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* DealOfDay */}
                  <td className="px-4 py-3 text-center">
                    <select
                      value={row.dealOfDay}
                      onChange={(e) => updateRow(row.id, "dealOfDay", e.target.value)}
                      className="w-full px-2 py-2 border rounded-lg bg-white"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* Tax */}
                  <td className="px-4 py-3">
                    <select
                      value={row.tax}
                      onChange={(e) => updateRow(row.id, "tax", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    >
                      <option value="">Tax</option>
                      {taxes.map(t => (
                        <option key={t._id} value={t._id}>{t.percentage}%</option>
                      ))}
                    </select>
                  </td>

                  {/* Returnable */}
                  <td className="px-4 py-3">
                    <select
                      value={row.isReturnable}
                      onChange={(e) => updateRow(row.id, "isReturnable", e.target.value)}
                      className="w-full px-2 py-2 border rounded-lg bg-white"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* Max Days */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.maxReturnDays}
                      onChange={(e) => updateRow(row.id, "maxReturnDays", e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* FSSAI No */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.fssaiLicNo}
                      onChange={(e) => updateRow(row.id, "fssaiLicNo", e.target.value)}
                      placeholder="FSSAI No"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* Max Qty */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.totalAllowedQuantity}
                      onChange={(e) => updateRow(row.id, "totalAllowedQuantity", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* HSN Code */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.hsnCode}
                      onChange={(e) => updateRow(row.id, "hsnCode", e.target.value)}
                      placeholder="HSN"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* Manufacturer */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.manufacturer}
                      onChange={(e) => updateRow(row.id, "manufacturer", e.target.value)}
                      placeholder="Manuf."
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* Made In */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.madeIn}
                      onChange={(e) => updateRow(row.id, "madeIn", e.target.value)}
                      placeholder="India"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3">
                    <textarea
                      value={row.description}
                      onChange={(e) => updateRow(row.id, "description", e.target.value)}
                      rows={1}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                    />
                  </td>

                  {/* Small Description */}
                  <td className="px-4 py-3">
                    <textarea
                      value={row.smallDescription}
                      onChange={(e) => updateRow(row.id, "smallDescription", e.target.value)}
                      rows={1}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                    />
                  </td>

                  {/* Tags */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.tags}
                      onChange={(e) => updateRow(row.id, "tags", e.target.value)}
                      placeholder="tag1, tag2"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* SEO Title */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.seoTitle}
                      onChange={(e) => updateRow(row.id, "seoTitle", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* SEO Keywords */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.seoKeywords}
                      onChange={(e) => updateRow(row.id, "seoKeywords", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* SEO Alt */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.seoImageAlt}
                      onChange={(e) => updateRow(row.id, "seoImageAlt", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* SEO Desc */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.seoDescription}
                      onChange={(e) => updateRow(row.id, "seoDescription", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </td>

                  {/* Main Image */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.mainImagePreview ? (
                        <img src={row.mainImagePreview} alt="Preview" className="w-10 h-10 rounded object-cover border" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-neutral-100 border flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                      )}
                      <button
                        onClick={() => fileInputRefs.current[row.id]?.click()}
                        className="text-xs text-teal-700 hover:underline font-medium"
                      >
                        {row.mainImageFile ? "Change" : "Upload"}
                      </button>
                      <input
                        type="file"
                        ref={el => fileInputRefs.current[row.id] = el}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageChange(row.id, e.target.files?.[0] || null)}
                      />
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 font-medium">
                    {row.status === "uploading" && (
                      <span className="flex items-center gap-2 text-blue-600">
                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </span>
                    )}
                    {row.status === "success" && (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Done
                      </span>
                    )}
                    {row.status === "error" && (
                      <span className="text-red-600 flex flex-col">
                        <span className="flex items-center gap-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          Failed
                        </span>
                        <span className="text-[10px] truncate max-w-[120px]">{row.errorMsg}</span>
                      </span>
                    )}
                    {row.status === "idle" && <span className="text-neutral-400 italic text-xs">Ready</span>}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 sticky right-0 bg-white z-10 border-l shadow-sm text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                      title="Remove row"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FIXED FOOTER: Pinned to Card Width */}
        <div className="w-full bg-neutral-50 shrink-0 border-t border-neutral-200 z-30">
          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 w-full box-border">
            <div className="text-sm text-neutral-600 font-medium">
              Total Products: <span className="text-neutral-900 font-bold">{rows.length}</span>
            </div>
            <div className="flex w-full sm:w-auto">
              <button
                onClick={addNewRow}
                className="w-full sm:w-auto text-teal-700 hover:text-teal-800 font-bold flex items-center justify-center gap-2 px-4 py-2 border border-teal-700/20 rounded-lg hover:bg-teal-50 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Append Another Row
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #0d9488;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0f766e;
        }
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
