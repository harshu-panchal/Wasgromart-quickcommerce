import React, { useState, useEffect, useRef } from "react";
import { createProduct, getShops, Shop, bulkCreateProducts } from "../../../services/api/productService";
import * as XLSX from "xlsx";

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
  const [mode, setMode] = useState<'select' | 'manual' | 'excel' | 'preview'>('select');
  const [excelUploaded, setExcelUploaded] = useState(false);
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

  const downloadTemplate = () => {
    const headers = [
      "Product Name", "Header Category", "Category", "SubCategory", "Sub-SubCategory",
      "Brand", "Price", "Discount Price", "Stock", "Variation Title", "Variation Type",
      "Publish", "Popular", "DealOfDay", "Tax %", "Returnable", "Max Return Days",
      "FSSAI No", "Max Allowed Quantity", "HSN Code", "Manufacturer", "Made In",
      "Description", "Small Description", "Tags", "SEO Title", "SEO Keywords",
      "SEO Image Alt", "SEO Description", "Image URL"
    ];


    const sampleData = [
      {
        "Product Name": "Sample Product",
        "Header Category": headerCategories[0]?.name || "Electronics",
        "Category": "Mobile Phones",
        "SubCategory": "Android",
        "Sub-SubCategory": "",
        "Brand": brands[0]?.name || "Samsung",
        "Price": "1000",
        "Discount Price": "900",
        "Stock": "50",
        "Variation Title": "Default",
        "Variation Type": "Size",
        "Publish": "Yes",
        "Popular": "No",
        "DealOfDay": "No",
        "Tax %": taxes[0]?.percentage || "18",
        "Returnable": "No",
        "Max Return Days": "7",
        "FSSAI No": "",
        "Max Allowed Quantity": "10",
        "HSN Code": "",
        "Manufacturer": "Manuf Name",
        "Made In": "India",
        "Description": "Detailed product description here",
        "Small Description": "Short summary",
        "Tags": "tag1, tag2",
        "SEO Title": "SEO Title",
        "SEO Keywords": "key1, key2",
        "SEO Image Alt": "Alt text",
        "SEO Description": "SEO Description",
        "Image URL": "https://example.com/product-image.jpg"
      }
    ];


    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "WasgroMart_Bulk_Upload_Template.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Get raw data as array of arrays
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (rows.length < 2) {
          showToast("Excel file is empty or missing data rows", "error");
          return;
        }

        // Get headers and normalize them
        // Robust Header Detection: Find the first row that actually looks like a header row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i] || [];
          if (row.some(cell => cell && cell.toString().toLowerCase().includes("product name"))) {
            headerRowIndex = i;
            break;
          }
        }

        const fileHeaders = (rows[headerRowIndex] || []).map(h => 
          (h || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "")
        );

        const getIdx = (name: string) => {
          const target = name.toLowerCase().replace(/[^a-z0-9]/g, "");
          return fileHeaders.indexOf(target);
        };

        const idx = {

          productName: getIdx("Product Name"),
          headerCategory: getIdx("Header Category"),
          category: getIdx("Category"),
          subCategory: getIdx("SubCategory"),
          subSubCategory: getIdx("Sub-SubCategory"),
          brand: getIdx("Brand"),
          price: getIdx("Price"),
          discPrice: getIdx("Discount Price"),
          stock: getIdx("Stock"),
          variationTitle: getIdx("Variation Title"),
          variationType: getIdx("Variation Type"),
          publish: getIdx("Publish"),
          popular: getIdx("Popular"),
          dealOfDay: getIdx("DealOfDay"),
          tax: getIdx("Tax %"),
          returnable: getIdx("Returnable"),
          maxReturnDays: getIdx("Max Return Days"),
          fssai: getIdx("FSSAI No"),
          maxQty: getIdx("Max Allowed Quantity"),
          hsn: getIdx("HSN Code"),
          manufacturer: getIdx("Manufacturer"),
          madeIn: getIdx("Made In"),
          description: getIdx("Description"),
          smallDesc: getIdx("Small Description"),
          tags: getIdx("Tags"),
          seoTitle: getIdx("SEO Title"),
          seoKeywords: getIdx("SEO Keywords"),
          seoAlt: getIdx("SEO Image Alt"),
          seoDesc: getIdx("SEO Description"),
          imageUrl: getIdx("Image URL")
        };


        const dataRows = rows.slice(headerRowIndex + 1).filter(r => r.length > 0 && r.some(cell => cell !== null && cell !== ""));

        
        const newRows = dataRows.map((r: any[]) => {
          const getCell = (i: number) => (i !== -1 && r[i] !== undefined && r[i] !== null) ? r[i].toString() : "";

          const row = createEmptyRow();
          row.productName = getCell(idx.productName);
          
          // Map Header Category
          const headerCatName = getCell(idx.headerCategory).toLowerCase();
          const hCat = headerCategories.find(h => h.name.toLowerCase() === headerCatName);
          
          if (hCat) {
            row.headerCategory = hCat._id;
            row.categoriesList = allCategories.filter(cat => {
              const hId = typeof cat.headerCategoryId === "string" ? cat.headerCategoryId : (cat.headerCategoryId as any)?._id;
              return hId === hCat._id;
            });

            // Map Category
            const catName = getCell(idx.category).toLowerCase();
            const cat = row.categoriesList.find(c => c.name.toLowerCase() === catName);
            if (cat) {
              row.category = cat._id;
              // Fetch subcategories
              getSubcategories(cat._id).then(res => {
                if (res.success) {
                  setRows(current => current.map(currR => currR.id === row.id ? { ...currR, subcategoriesList: res.data } : currR));
                }
              });
            }
          }

          row.brand = brands.find(b => b.name.toLowerCase() === getCell(idx.brand).toLowerCase())?._id || "";
          row.price = getCell(idx.price);
          row.discPrice = getCell(idx.discPrice) || "0";
          row.stock = getCell(idx.stock) || "0";
          row.variationTitle = getCell(idx.variationTitle) || "Default";
          row.variationType = getCell(idx.variationType) || "Size";
          row.publish = getCell(idx.publish).toLowerCase() === "no" ? "No" : "Yes";
          row.popular = getCell(idx.popular).toLowerCase() === "yes" ? "Yes" : "No";
          row.dealOfDay = getCell(idx.dealOfDay).toLowerCase() === "yes" ? "Yes" : "No";
          
          const taxVal = getCell(idx.tax);
          row.tax = taxes.find(t => t.percentage.toString() === taxVal)?._id || "";

          row.isReturnable = getCell(idx.returnable).toLowerCase() === "yes" ? "Yes" : "No";
          row.maxReturnDays = getCell(idx.maxReturnDays);
          row.fssaiLicNo = getCell(idx.fssai);
          row.totalAllowedQuantity = getCell(idx.maxQty) || "10";
          row.hsnCode = getCell(idx.hsn);
          row.manufacturer = getCell(idx.manufacturer);
          row.madeIn = getCell(idx.madeIn);
          row.description = getCell(idx.description);
          row.smallDescription = getCell(idx.smallDesc);
          row.tags = getCell(idx.tags);
          row.seoTitle = getCell(idx.seoTitle);
          row.seoKeywords = getCell(idx.seoKeywords);
          row.seoImageAlt = getCell(idx.seoAlt);
          row.seoDescription = getCell(idx.seoDesc);
          
          // Handle External Image URL
          const externalUrl = getCell(idx.imageUrl);
          if (externalUrl && externalUrl.startsWith('http')) {
            row.images = [externalUrl];
            row.previewImages = [externalUrl];
          }

          return row;
        });

        setRows(newRows);
        setExcelUploaded(true);
        setMode('preview'); // Switch to preview mode
        showToast(`Successfully imported ${newRows.length} products. Please review before publishing.`, "success");


      } catch (err) {
        console.error("Excel parse error:", err);
        showToast("Failed to parse Excel file. Please ensure it follows the template.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = "";
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
        
        // Use external URL if provided, otherwise upload the file
        if (row.mainImageFile) {
          const uploadRes = await uploadImage(row.mainImageFile, "Wasgro mart/products");
          mainImageUrl = uploadRes.secureUrl;
        } else if (row.images && row.images.length > 0) {
          mainImageUrl = row.images[0];
        }

        if (!mainImageUrl) {
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "error", errorMsg: "Image required for publication" } : r));
          continue;
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
          mainImageUrl: mainImageUrl,
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

  if (mode === 'select') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-4 bg-neutral-50">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-neutral-800">Bulk Product Entry</h2>
          <p className="text-neutral-500">Choose how you want to add your products today</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* Manual Card */}
          <button
            onClick={() => {
              setRows([createEmptyRow()]);
              setExcelUploaded(false);
              setMode('manual');
            }}
            className="group relative bg-white p-10 rounded-3xl shadow-xl border-2 border-transparent hover:border-teal-600 transition-all duration-300 flex flex-col items-center text-center gap-6 hover:shadow-2xl hover:-translate-y-2"
          >
            <div className="w-24 h-24 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-all duration-300 shadow-inner">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-800">Manual Entry</h3>
              <p className="text-neutral-500 max-w-xs">Spreadsheet-style horizontal grid. Best for adding a few products with full control.</p>
            </div>
            <div className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-full font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Get Started
            </div>
          </button>

          {/* Excel Card */}
          <button
            onClick={() => {
              setRows([]);
              setExcelUploaded(false);
              setMode('excel');
            }}
            className="group relative bg-white p-10 rounded-3xl shadow-xl border-2 border-transparent hover:border-orange-500 transition-all duration-300 flex flex-col items-center text-center gap-6 hover:shadow-2xl hover:-translate-y-2"
          >

            <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-inner">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-800">Excel Upload</h3>
              <p className="text-neutral-500 max-w-xs">Upload an existing Excel or CSV file. Best for large inventories and bulk updates.</p>
            </div>
            <div className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Start Upload
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 bg-neutral-50 min-h-screen w-full max-w-full overflow-hidden box-border">
      
      {/* Back Button and Context */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setMode('select')}
          className="flex items-center gap-2 text-neutral-600 hover:text-teal-700 font-medium transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Selection
        </button>
      </div>

      {/* Outer Card - Hard Constrained to prevent horizontal stretching */}
      <div className="w-full bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden flex flex-col min-w-0 max-w-full relative">
        
        {/* FIXED HEADER: Locked to Card Width */}
        <div className="w-full bg-teal-700 text-white shrink-0 z-30">
          <div className="px-3 sm:px-6 py-4 flex flex-col md:flex-row justify-between md:items-center gap-3 sm:gap-4 w-full box-border max-w-full overflow-hidden">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-bold truncate">
                {mode === 'manual' ? 'Manual Horizontal Entry' : mode === 'preview' ? 'Review & Publish' : 'Excel Bulk Upload'}
              </h2>
              <p className="text-teal-100 text-[10px] sm:text-sm truncate">
                {mode === 'manual' 
                  ? 'Add multiple products at once in a horizontal format' 
                  : mode === 'preview'
                  ? `Verify ${rows.length} products before instant publication`
                  : 'Import products from an Excel/CSV file'
                }
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {mode === 'excel' && (
                <>
                  <button
                    onClick={downloadTemplate}
                    className="bg-white/10 hover:bg-white/20 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-white/20 transition-all flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Template
                  </button>
                  <label className="bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg shadow-lg transition-all flex items-center justify-center gap-1 sm:gap-2 font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Choose Excel File
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleExcelUpload} />
                  </label>
                </>
              )}
              
              {mode === 'manual' && (
                <button
                  onClick={addNewRow}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-white/30 transition-all flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm whitespace-nowrap"
                >
                  <svg width="14" height="14" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Row
                </button>
              )}

              <button
                onClick={handleSubmitAll}
                disabled={isSubmitting || rows.length === 0 || (rows.length === 1 && !rows[0].productName)}
                className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap ${
                  isSubmitting || rows.length === 0 || (rows.length === 1 && !rows[0].productName)
                    ? "bg-neutral-400 cursor-not-allowed" 
                    : "bg-teal-600 hover:bg-teal-700 text-white animate-pulse-subtle"
                }`}
              >
                {isSubmitting ? "Publishing..." : mode === 'preview' ? "Confirm & Publish All" : "Save All"}
              </button>

            </div>
          </div>
        </div>

        {mode === 'excel' && !excelUploaded ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-neutral-50/50">
            <div className="w-full max-w-xl p-12 bg-white rounded-3xl shadow-sm border-2 border-dashed border-neutral-300 flex flex-col items-center gap-6 text-center">
              <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-neutral-800">Upload your product list</h3>
                <p className="text-neutral-500">First, download the template, fill it with your product details (including Image URLs), and then upload it here.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={downloadTemplate}
                  className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl font-bold text-neutral-600 hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download Template
                </button>
                <label className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-600/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Select File
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleExcelUpload} />
                </label>
              </div>
              <p className="text-xs text-neutral-400 mt-4">Supported formats: .xlsx, .xls, .csv</p>
            </div>
          </div>
        ) : (
          <>
            {mode === 'preview' && (
              <div className="bg-teal-50 border-b border-teal-100 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold">
                    {rows.length}
                  </div>
                  <div>
                    <h4 className="font-bold text-teal-900 text-sm">Bulk Review Summary</h4>
                    <p className="text-teal-700 text-xs">Verify details and ensure each product has an image before publishing.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <div className="px-3 py-1 bg-white border border-teal-200 rounded-full text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                     Excel Source: Active
                   </div>
                </div>
              </div>
            )}
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
                    <div className="text-[10px] text-green-600 mt-1 font-medium">0 = Unlimited</div>
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
      </>
      )}
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
