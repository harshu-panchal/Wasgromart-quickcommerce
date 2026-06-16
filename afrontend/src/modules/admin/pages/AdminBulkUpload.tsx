import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { uploadImage, uploadImages } from "../../../services/api/uploadService";
import { validateImageFile, createImagePreview } from "../../../utils/imageUpload";
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
import {
  getSellers,
  bulkImportProducts,
  type Seller,
} from "../../../services/api/admin/adminProductService";

export type BulkVariantDraft = {
  name: string;
  value: string;
  price?: number;
  discPrice?: number;
  stock?: number;
  sku?: string;
  status?: string;
  mainImage?: string;
  galleryImages?: string[];
  _mainImageFile?: File | null;
  _mainImagePreview?: string;
  _galleryImageFiles?: File[];
  _galleryImagePreviews?: string[];
};

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
  galleryFiles: (File | null)[];
  galleryPreviews: string[];
  images: string[];
  previewImages: string[];
  variants: BulkVariantDraft[];
  status: "idle" | "uploading" | "success" | "error";
  errorMsg?: string;
  categoriesList: Category[];
  subcategoriesList: SubCategory[];
  subSubCategoriesList: SubSubCategory[];
  seller: string; // Specific seller selected for this row
}

export default function AdminBulkUpload() {
  const { showToast } = useToast();
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'select' | 'manual' | 'excel' | 'preview'>('select');
  const [excelUploaded, setExcelUploaded] = useState(false);
  const [globalSellerId, setGlobalSellerId] = useState<string>("");
  const [variantManagerRowId, setVariantManagerRowId] = useState<string | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          getCategories(),
          getActiveTaxes(),
          getBrands(),
          getHeaderCategoriesPublic(),
          getSellers(),
        ]);

        if (results[0].status === "fulfilled" && results[0].value.success) {
          setAllCategories(results[0].value.data);
        }
        if (results[1].status === "fulfilled" && results[1].value.success) {
          setTaxes(results[1].value.data);
        }
        if (results[2].status === "fulfilled" && results[2].value.success) {
          setBrands(results[2].value.data);
        }
        if (results[3].status === "fulfilled") {
          const hCatRes = results[3].value;
          if (Array.isArray(hCatRes)) {
            setHeaderCategories(hCatRes.filter((hc) => hc.status === "Published"));
          }
        }
        if (results[4].status === "fulfilled" && results[4].value.success) {
          setSellers(results[4].value.data);
        }
        
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
    galleryFiles: [null, null, null, null, null],
    galleryPreviews: ["", "", "", "", ""],
    images: [],
    previewImages: [],
    variants: [],
    status: "idle",
    categoriesList: [],
    subcategoriesList: [],
    subSubCategoriesList: [],
    seller: "", // Inherits globalSellerId
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
    if (!globalSellerId) {
      showToast("Please select a default Seller first.", "error");
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rowsParsed = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (rowsParsed.length < 2) {
          showToast("Excel file is empty or missing data rows", "error");
          return;
        }

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rowsParsed.length, 10); i++) {
          const row = rowsParsed[i] || [];
          if (row.some(cell => cell && cell.toString().toLowerCase().includes("product name"))) {
            headerRowIndex = i;
            break;
          }
        }

        const fileHeaders = (rowsParsed[headerRowIndex] || []).map(h => 
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

        const dataRows = rowsParsed.slice(headerRowIndex + 1).filter(r => r.length > 0 && r.some(cell => cell !== null && cell !== ""));
        
        const newRows = dataRows.map((r: any[]) => {
          const getCell = (i: number) => (i !== -1 && r[i] !== undefined && r[i] !== null) ? r[i].toString() : "";

          const row = createEmptyRow();
          row.seller = globalSellerId;
          row.productName = getCell(idx.productName);
          
          const headerCatName = getCell(idx.headerCategory).toLowerCase();
          const hCat = headerCategories.find(h => h.name.toLowerCase() === headerCatName);
          
          if (hCat) {
            row.headerCategory = hCat._id;
            row.categoriesList = allCategories.filter(cat => {
              const hId = typeof cat.headerCategoryId === "string" ? cat.headerCategoryId : (cat.headerCategoryId as any)?._id;
              return hId === hCat._id;
            });

            const catName = getCell(idx.category).toLowerCase();
            const cat = row.categoriesList.find(c => c.name.toLowerCase() === catName);
            if (cat) {
              row.category = cat._id;
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
          
          const externalUrl = getCell(idx.imageUrl);
          if (externalUrl && externalUrl.startsWith('http')) {
            row.images = [externalUrl];
            row.previewImages = [externalUrl];
            row.mainImagePreview = externalUrl;
          }

          return row;
        });

        setRows(newRows);
        setExcelUploaded(true);
        setMode('preview');
        showToast(`Successfully imported ${newRows.length} products. Please review before publishing.`, "success");

      } catch (err) {
        console.error("Excel parse error:", err);
        showToast("Failed to parse Excel file. Please ensure it follows the template.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
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

  const handleGalleryImageChange = (rowId: string, index: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRows(prev => prev.map(row => {
        if (row.id === rowId) {
          const newFiles = [...row.galleryFiles];
          const newPreviews = [...row.galleryPreviews];
          newFiles[index] = file;
          newPreviews[index] = reader.result as string;
          return { ...row, galleryFiles: newFiles, galleryPreviews: newPreviews };
        }
        return row;
      }));
    };
    reader.readAsDataURL(file);
  };

  // ---------- Per-row variant manager helpers ----------
  const setVariantsForRow = (rowId: string, updater: (vs: BulkVariantDraft[]) => BulkVariantDraft[]) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, variants: updater(r.variants || []) } : r));
  };

  const addVariantToRow = (rowId: string) => {
    setVariantsForRow(rowId, (vs) => [
      ...vs,
      {
        name: "Default",
        value: "",
        price: 0,
        discPrice: 0,
        stock: 0,
        status: "Available",
      } as BulkVariantDraft,
    ]);
  };

  const removeVariantFromRow = (rowId: string, idx: number) => {
    setVariantsForRow(rowId, (vs) => vs.filter((_, i) => i !== idx));
  };

  const updateVariantField = (rowId: string, idx: number, patch: Partial<BulkVariantDraft>) => {
    setVariantsForRow(rowId, (vs) => vs.map((v, i) => i === idx ? { ...v, ...patch } : v));
  };

  const handleBulkVariantMainImage = async (rowId: string, idx: number, file: File | null) => {
    if (!file) return;
    const v = validateImageFile(file);
    if (!v.valid) {
      showToast(v.error || "Invalid image", "error");
      return;
    }
    try {
      const preview = await createImagePreview(file);
      updateVariantField(rowId, idx, { _mainImageFile: file, _mainImagePreview: preview });
    } catch {
      showToast("Could not preview the image", "error");
    }
  };

  const handleBulkVariantGalleryAdd = async (rowId: string, idx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: File[] = [];
    const previews: string[] = [];
    for (const f of Array.from(files)) {
      const v = validateImageFile(f);
      if (!v.valid) continue;
      try {
        previews.push(await createImagePreview(f));
        valid.push(f);
      } catch {
        // skip files we cannot preview
      }
    }
    setVariantsForRow(rowId, (vs) =>
      vs.map((variant, i) => {
        if (i !== idx) return variant;
        return {
          ...variant,
          _galleryImageFiles: [...(variant._galleryImageFiles || []), ...valid],
          _galleryImagePreviews: [...(variant._galleryImagePreviews || []), ...previews],
        };
      })
    );
  };

  const removeBulkVariantGalleryPending = (rowId: string, idx: number, imgIdx: number) => {
    setVariantsForRow(rowId, (vs) =>
      vs.map((variant, i) => {
        if (i !== idx) return variant;
        return {
          ...variant,
          _galleryImageFiles: (variant._galleryImageFiles || []).filter((_, k) => k !== imgIdx),
          _galleryImagePreviews: (variant._galleryImagePreviews || []).filter((_, k) => k !== imgIdx),
        };
      })
    );
  };

  const removeBulkVariantMainImage = (rowId: string, idx: number) => {
    updateVariantField(rowId, idx, {
      _mainImageFile: null,
      _mainImagePreview: "",
      mainImage: "",
    });
  };

  const uploadVariantDraft = async (draft: BulkVariantDraft): Promise<any> => {
    let mainImage = draft.mainImage || "";
    let galleryImages: string[] = Array.isArray(draft.galleryImages) ? [...draft.galleryImages] : [];

    if (draft._mainImageFile) {
      try {
        const res = await uploadImage(draft._mainImageFile, "products/variants");
        mainImage = res.secureUrl;
      } catch (err) {
        console.error("Variant main image upload failed", err);
      }
    }
    if (draft._galleryImageFiles && draft._galleryImageFiles.length > 0) {
      try {
        const res = await uploadImages(draft._galleryImageFiles, "products/variants/gallery");
        galleryImages = [...galleryImages, ...res.map(r => r.secureUrl)];
      } catch (err) {
        console.error("Variant gallery upload failed", err);
      }
    }

    const { _mainImageFile, _mainImagePreview, _galleryImageFiles, _galleryImagePreviews, ...clean } = draft;
    void _mainImageFile; void _mainImagePreview; void _galleryImageFiles; void _galleryImagePreviews;
    return {
      ...clean,
      mainImage: mainImage || undefined,
      galleryImages,
    };
  };

  const handleSubmitAll = async () => {
    if (isSubmitting) return;

    const pendingRows = rows.filter(r => r.status !== 'success');
    if (pendingRows.length === 0) {
      showToast("No new rows to save", "info");
      return;
    }

    const invalidRows = pendingRows.filter(r => {
      const activeSeller = r.seller || globalSellerId;
      if (!r.productName || !r.category || !activeSeller) return true;
      if (r.variants && r.variants.length > 0) {
        return !r.variants.some(v => Number(v.price) > 0);
      }
      return !r.price;
    });

    if (invalidRows.length > 0) {
      showToast("Please fill all required fields (Name, Price/Variants, Category, and Seller) for all rows", "error");
      return;
    }

    setIsSubmitting(true);
    
    const preparedProducts: any[] = [];
    const rowIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "success") continue;

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "uploading" } : r));

      try {
        let mainImageUrl = "";
        const galleryUrls: string[] = [];
        
        if (row.mainImageFile) {
          const uploadRes = await uploadImage(row.mainImageFile, "products");
          mainImageUrl = uploadRes.secureUrl;
        } else if (row.images && row.images.length > 0) {
          mainImageUrl = row.images[0];
        }

        if (!mainImageUrl) {
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "error", errorMsg: "Main Image required" } : r));
          continue;
        }

        for (const file of row.galleryFiles) {
          if (file) {
            try {
              const res = await uploadImage(file, "products");
              galleryUrls.push(res.secureUrl);
            } catch (err) {
              console.error("Gallery image upload failed", err);
            }
          }
        }

        if (row.images && row.images.length > 1) {
           row.images.slice(1).forEach(url => {
             if (!galleryUrls.includes(url)) galleryUrls.push(url);
           });
        }

        let finalVariations: any[];
        if (row.variants && row.variants.length > 0) {
          finalVariations = [];
          for (const draft of row.variants) {
            const uploaded = await uploadVariantDraft(draft);
            finalVariations.push({
              ...uploaded,
              name: uploaded.name || "Default",
              title: uploaded.value || "Standard",
              price: Number(uploaded.price) || 0,
              discPrice: Number(uploaded.discPrice) || 0,
              stock: Number(uploaded.stock) || 0,
              status: uploaded.status || "Available",
            });
          }
        } else {
          finalVariations = [
            {
              name: "Default",
              value: row.variationTitle || "Standard",
              price: parseFloat(row.price),
              discPrice: parseFloat(row.discPrice || "0"),
              stock: parseInt(row.stock || "0"),
              status: (parseInt(row.stock || "0") >= 0 ? "Available" : "Sold out") as any,
            },
          ];
        }

        const productData = {
          productName: row.productName,
          headerCategoryId: row.headerCategory || undefined,
          category: row.category,
          subcategory: row.subcategory || undefined,
          subSubCategory: row.subSubCategory || undefined,
          brand: row.brand || undefined,
          publish: row.publish === "Yes",
          popular: row.popular === "Yes",
          dealOfDay: row.dealOfDay === "Yes",
          tax: row.tax || undefined,
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
          mainImage: mainImageUrl,
          galleryImages: galleryUrls,
          variations: finalVariations,
          variationType: row.variationType || "Size",
          seller: row.seller || globalSellerId,
          price: finalVariations[0]?.price || 0,
          stock: finalVariations.reduce((acc, curr) => acc + (parseInt(curr.stock) || 0), 0),
        };

        preparedProducts.push(productData);
        rowIds.push(row.id);
      } catch (err: any) {
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "error", errorMsg: "Upload failed" } : r));
      }
    }

    if (preparedProducts.length > 0) {
      try {
        const res = await bulkImportProducts({ products: preparedProducts });
        
        if (res.success) {
          const bulkErrors = res.data.errors || [];
          
          setRows(prev => prev.map(row => {
            if (!rowIds.includes(row.id)) return row;
            
            const rowIndex = rowIds.indexOf(row.id);
            const error = bulkErrors.find((e: any) => e.index === rowIndex);
            
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
          <h2 className="text-3xl font-extrabold text-neutral-800">Admin Bulk Product Entry</h2>
          <p className="text-neutral-500">Choose how you want to add products on behalf of sellers today</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border w-full max-w-md flex flex-col gap-4">
          <label className="text-sm font-bold text-neutral-700">1. Select Default Seller *</label>
          <select
            value={globalSellerId}
            onChange={(e) => {
              setGlobalSellerId(e.target.value);
              setRows(current => current.map(r => ({ ...r, seller: e.target.value })));
            }}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white font-medium text-sm"
          >
            <option value="">Select Seller</option>
            {sellers.map((s) => (
              <option key={s._id} value={s._id}>{s.storeName || s.sellerName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* Manual Card */}
          <button
            onClick={() => {
              if (!globalSellerId) {
                showToast("Please select a Seller first.", "error");
                return;
              }
              const firstRow = createEmptyRow();
              firstRow.seller = globalSellerId;
              setRows([firstRow]);
              setExcelUploaded(false);
              setMode('manual');
            }}
            className={`group relative bg-white p-10 rounded-3xl shadow-xl border-2 border-transparent transition-all duration-300 flex flex-col items-center text-center gap-6 ${
              globalSellerId ? "hover:border-teal-600 hover:shadow-2xl hover:-translate-y-2" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="w-24 h-24 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-all duration-300 shadow-inner">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-800">Manual Entry</h3>
              <p className="text-neutral-500 max-w-xs">Spreadsheet-style horizontal grid. Add products with individual details and override sellers per row.</p>
            </div>
            {globalSellerId && (
              <div className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-full font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Get Started
              </div>
            )}
          </button>

          {/* Excel Card */}
          <button
            onClick={() => {
              if (!globalSellerId) {
                showToast("Please select a Seller first.", "error");
                return;
              }
              setRows([]);
              setExcelUploaded(false);
              setMode('excel');
            }}
            className={`group relative bg-white p-10 rounded-3xl shadow-xl border-2 border-transparent transition-all duration-300 flex flex-col items-center text-center gap-6 ${
              globalSellerId ? "hover:border-orange-500 hover:shadow-2xl hover:-translate-y-2" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-inner">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-800">Excel Upload</h3>
              <p className="text-neutral-500 max-w-xs">Upload an existing Excel or CSV file. Best for large product datasets.</p>
            </div>
            {globalSellerId && (
              <div className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Start Upload
              </div>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 bg-neutral-50 min-h-screen w-full max-w-full overflow-hidden box-border">
      
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => setMode('select')}
          className="flex items-center gap-2 text-neutral-600 hover:text-teal-700 font-medium transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Selection
        </button>

        <div className="flex items-center gap-3 bg-white px-4 py-2 border rounded-lg shadow-sm">
          <label className="text-xs font-bold text-neutral-700">Global Seller Override:</label>
          <select
            value={globalSellerId}
            onChange={(e) => {
              setGlobalSellerId(e.target.value);
              setRows(current => current.map(r => ({ ...r, seller: e.target.value })));
            }}
            className="px-3 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none bg-white font-medium text-xs cursor-pointer min-w-[150px]"
          >
            <option value="">Select Seller</option>
            {sellers.map((s) => (
              <option key={s._id} value={s._id}>{s.storeName || s.sellerName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="w-full bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden flex flex-col min-w-0 max-w-full relative">
        
        {/* Fixed Header */}
        <div className="w-full bg-teal-700 text-white shrink-0 z-30">
          <div className="px-3 sm:px-6 py-4 flex flex-col md:flex-row justify-between md:items-center gap-3 sm:gap-4 w-full box-border max-w-full overflow-hidden">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-bold truncate">
                {mode === 'manual' ? 'Manual Horizontal Entry' : mode === 'preview' ? 'Review & Publish' : 'Excel Bulk Upload'}
              </h2>
              <p className="text-teal-100 text-[10px] sm:text-sm truncate">
                {mode === 'manual' 
                  ? 'Add multiple products at once' 
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
                  onClick={() => {
                    const row = createEmptyRow();
                    row.seller = globalSellerId;
                    setRows(prev => [...prev, row]);
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-white/30 transition-all flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
                <p className="text-neutral-500">First, download the template, fill it with product details, and upload it below. They will be added for the selected seller.</p>
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
                    <p className="text-teal-700 text-xs">Verify details, ensure each product has a seller and main image before publishing.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <div className="px-3 py-1 bg-white border border-teal-200 rounded-full text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                     Source: Excel File
                   </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-x-auto custom-scrollbar w-full border-t border-neutral-100 bg-white min-w-0">
              <table className="text-sm text-left border-collapse min-w-[5200px] w-full table-fixed">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 border-b border-neutral-200">
                    <th className="px-4 py-4 font-bold sticky left-0 bg-neutral-100 z-10 border-r shadow-sm w-[250px]">Product Name *</th>
                    <th className="px-4 py-4 font-bold w-[220px]">Seller *</th>
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
                    <th className="px-4 py-4 font-bold w-[200px]">Main Image</th>
                    <th className="px-4 py-4 font-bold w-[450px]">Gallery Images (Max 5)</th>
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

                      {/* Seller */}
                      <td className="px-4 py-3">
                        <select
                          value={row.seller || globalSellerId}
                          onChange={(e) => updateRow(row.id, "seller", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white font-medium text-xs cursor-pointer"
                        >
                          <option value="">Select Seller</option>
                          {sellers.map(s => (
                            <option key={s._id} value={s._id}>{s.storeName || s.sellerName}</option>
                          ))}
                        </select>
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
                          disabled={row.variants.length > 0}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                        />
                        {row.variants.length > 0 && (
                          <div className="text-[10px] text-neutral-400 mt-1 italic">Set in modal</div>
                        )}
                      </td>

                      {/* Disc Price */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.discPrice}
                          onChange={(e) => updateRow(row.id, "discPrice", e.target.value)}
                          placeholder="0.00"
                          disabled={row.variants.length > 0}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                        />
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.stock}
                          onChange={(e) => updateRow(row.id, "stock", e.target.value)}
                          placeholder="0"
                          disabled={row.variants.length > 0}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                        />
                        <div className="text-[10px] text-green-600 mt-1 font-medium">0 = Unlimited</div>
                      </td>

                      {/* Variation Title */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={row.variationTitle}
                            onChange={(e) => updateRow(row.id, "variationTitle", e.target.value)}
                            placeholder="e.g. 500g"
                            disabled={row.variants.length > 0}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (row.variants.length === 0) {
                                setVariantsForRow(row.id, () => [
                                  {
                                    name: "Default",
                                    value: row.variationTitle || "Standard",
                                    price: parseFloat(row.price || "0") || 0,
                                    discPrice: parseFloat(row.discPrice || "0") || 0,
                                    stock: parseInt(row.stock || "0") || 0,
                                    status: "Available",
                                  } as BulkVariantDraft,
                                ]);
                              }
                              setVariantManagerRowId(row.id);
                            }}
                            className="w-full text-[11px] font-semibold text-teal-700 hover:text-white hover:bg-teal-700 border border-teal-700/30 rounded-md px-2 py-1 transition-colors flex items-center justify-center gap-1"
                          >
                            Manage Variants
                            {row.variants.length > 0 && (
                              <span className="ml-1 bg-teal-700 text-white rounded-full px-1.5 text-[10px]">
                                {row.variants.length}
                              </span>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Variation Type */}
                      <td className="px-4 py-3">
                        <select
                          value={row.variationType}
                          onChange={(e) => updateRow(row.id, "variationType", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        >
                          <option value="Size">Size</option>
                          <option value="Color">Color</option>
                          <option value="Weight">Weight</option>
                          <option value="Volume">Volume</option>
                        </select>
                      </td>

                      {/* Publish */}
                      <td className="px-4 py-3">
                        <select
                          value={row.publish}
                          onChange={(e) => updateRow(row.id, "publish", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>

                      {/* Popular */}
                      <td className="px-4 py-3">
                        <select
                          value={row.popular}
                          onChange={(e) => updateRow(row.id, "popular", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>

                      {/* Deal of Day */}
                      <td className="px-4 py-3">
                        <select
                          value={row.dealOfDay}
                          onChange={(e) => updateRow(row.id, "dealOfDay", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>

                      {/* Tax */}
                      <td className="px-4 py-3">
                        <select
                          value={row.tax}
                          onChange={(e) => updateRow(row.id, "tax", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        >
                          <option value="">Select Tax</option>
                          {taxes.map(t => (
                            <option key={t._id} value={t._id}>{t.name} ({t.percentage}%)</option>
                          ))}
                        </select>
                      </td>

                      {/* Returnable */}
                      <td className="px-4 py-3">
                        <select
                          value={row.isReturnable}
                          onChange={(e) => updateRow(row.id, "isReturnable", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>

                      {/* Max Return Days */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.maxReturnDays}
                          onChange={(e) => updateRow(row.id, "maxReturnDays", e.target.value)}
                          placeholder="e.g. 7"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* FSSAI No */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.fssaiLicNo}
                          onChange={(e) => updateRow(row.id, "fssaiLicNo", e.target.value)}
                          placeholder="FSSAI Lic No"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* Max Allowed Qty */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.totalAllowedQuantity}
                          onChange={(e) => updateRow(row.id, "totalAllowedQuantity", e.target.value)}
                          placeholder="10"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* HSN Code */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.hsnCode}
                          onChange={(e) => updateRow(row.id, "hsnCode", e.target.value)}
                          placeholder="HSN Code"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* Manufacturer */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.manufacturer}
                          onChange={(e) => updateRow(row.id, "manufacturer", e.target.value)}
                          placeholder="Mfg Name"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* Made In */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.madeIn}
                          onChange={(e) => updateRow(row.id, "madeIn", e.target.value)}
                          placeholder="Country"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <textarea
                          value={row.description}
                          onChange={(e) => updateRow(row.id, "description", e.target.value)}
                          placeholder="Detailed description..."
                          rows={2}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                        ></textarea>
                      </td>

                      {/* Small Description */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.smallDescription}
                          onChange={(e) => updateRow(row.id, "smallDescription", e.target.value)}
                          placeholder="Short description..."
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* Tags */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.tags}
                          onChange={(e) => updateRow(row.id, "tags", e.target.value)}
                          placeholder="tag1, tag2"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </td>

                      {/* Main Image */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageChange(row.id, e.target.files?.[0] || null)}
                            className="text-xs w-full"
                          />
                          {row.mainImagePreview && (
                            <img src={row.mainImagePreview} alt="Preview" className="w-12 h-16 object-cover rounded border" />
                          )}
                        </div>
                      </td>

                      {/* Gallery Images */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-5 gap-1">
                            {[0, 1, 2, 3, 4].map(idx => (
                              <div key={idx} className="flex flex-col items-center gap-1 border p-1 rounded bg-neutral-50">
                                <label className="text-[9px] font-bold text-neutral-500">Img {idx+1}</label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGalleryImageChange(row.id, idx, e.target.files?.[0] || null)}
                                  className="hidden"
                                  id={`file-${row.id}-${idx}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => document.getElementById(`file-${row.id}-${idx}`)?.click()}
                                  className="p-1 border rounded bg-white hover:bg-neutral-100"
                                >
                                  📷
                                </button>
                                {row.galleryPreviews[idx] && (
                                  <img src={row.galleryPreviews[idx]} alt="Preview" className="w-6 h-8 object-cover rounded" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Status column */}
                      <td className="px-4 py-3">
                        {row.status === 'uploading' && <span className="text-blue-600 font-bold animate-pulse">Uploading...</span>}
                        {row.status === 'success' && <span className="text-green-600 font-bold flex items-center gap-1">✓ Success</span>}
                        {row.status === 'error' && (
                          <div className="flex flex-col gap-1">
                            <span className="text-red-600 font-bold">⚠️ Error</span>
                            <span className="text-[10px] text-red-500 font-medium whitespace-pre-wrap">{row.errorMsg}</span>
                          </div>
                        )}
                        {row.status === 'idle' && <span className="text-neutral-400">Ready</span>}
                      </td>

                      {/* Action column */}
                      <td className="px-4 py-3 sticky right-0 bg-white z-10 border-l shadow-sm text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-red-500 hover:text-red-700 font-bold"
                          title="Remove Row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Variation Manager Modal */}
      {variantManagerRowId && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-teal-700 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div>
                <h3 className="text-lg font-bold">Manage Product Variations</h3>
                <p className="text-teal-100 text-xs">Define multiple options (Price, Stock, Images) for this product row.</p>
              </div>
              <button
                type="button"
                onClick={() => setVariantManagerRowId(null)}
                className="text-white hover:text-neutral-200 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-neutral-500">
                  Total Variations added: {rows.find(r => r.id === variantManagerRowId)?.variants?.length || 0}
                </span>
                <button
                  type="button"
                  onClick={() => addVariantToRow(variantManagerRowId)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  ＋ Add New Variant
                </button>
              </div>

              <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-700 font-bold border-b text-xs uppercase tracking-wider">
                      <th className="p-4 w-[120px]">Name (e.g. Size)</th>
                      <th className="p-4 w-[180px]">Value (e.g. Medium)</th>
                      <th className="p-4 w-[130px]">Price *</th>
                      <th className="p-4 w-[130px]">Disc Price</th>
                      <th className="p-4 w-[110px]">Stock</th>
                      <th className="p-4 w-[160px]">Main Image</th>
                      <th className="p-4 w-[280px]">Gallery</th>
                      <th className="p-4 w-[120px]">Status</th>
                      <th className="p-4 w-[85px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {(rows.find(r => r.id === variantManagerRowId)?.variants || []).map((variant, vIdx) => (
                      <tr key={vIdx} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="p-4">
                          <input
                            type="text"
                            value={variant.name}
                            onChange={(e) => updateVariantField(variantManagerRowId, vIdx, { name: e.target.value })}
                            placeholder="Size"
                            className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={variant.value}
                            onChange={(e) => updateVariantField(variantManagerRowId, vIdx, { value: e.target.value })}
                            placeholder="M, L, XL"
                            className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={variant.price || ""}
                            onChange={(e) => updateVariantField(variantManagerRowId, vIdx, { price: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={variant.discPrice || ""}
                            onChange={(e) => updateVariantField(variantManagerRowId, vIdx, { discPrice: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={variant.stock || ""}
                            onChange={(e) => updateVariantField(variantManagerRowId, vIdx, { stock: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleBulkVariantMainImage(variantManagerRowId, vIdx, e.target.files?.[0] || null)}
                              className="hidden"
                              id={`var-main-${vIdx}`}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById(`var-main-${vIdx}`)?.click()}
                              className="p-1.5 border rounded hover:bg-neutral-100 text-xs shrink-0"
                            >
                              📷 Upload
                            </button>
                            {variant._mainImagePreview && (
                              <div className="relative">
                                <img src={variant._mainImagePreview} alt="Var main preview" className="w-8 h-10 object-cover rounded" />
                                <button
                                  type="button"
                                  onClick={() => removeBulkVariantMainImage(variantManagerRowId, vIdx)}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => handleBulkVariantGalleryAdd(variantManagerRowId, vIdx, e.target.files)}
                              className="hidden"
                              id={`var-gall-${vIdx}`}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById(`var-gall-${vIdx}`)?.click()}
                              className="p-1.5 border rounded hover:bg-neutral-100 text-xs mr-2 self-start"
                            >
                              📷 Add gallery
                            </button>
                            <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                              {(variant._galleryImagePreviews || []).map((prev, imgIdx) => (
                                <div key={`pending-${imgIdx}`} className="relative shrink-0 border rounded">
                                  <img src={prev} alt="Pending gallery" className="w-6 h-8 object-cover rounded" />
                                  <button
                                    type="button"
                                    onClick={() => removeBulkVariantGalleryPending(variantManagerRowId, vIdx, imgIdx)}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-3 h-3 text-[7px] flex items-center justify-center"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <select
                            value={variant.status || "Available"}
                            onChange={(e) => updateVariantField(variantManagerRowId, vIdx, { status: e.target.value })}
                            className="px-2 py-1.5 border rounded-lg focus:ring-1 focus:ring-teal-500 outline-none bg-white text-xs"
                          >
                            <option value="Available">Available</option>
                            <option value="Sold out">Sold out</option>
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => removeVariantFromRow(variantManagerRowId, vIdx)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(rows.find(r => r.id === variantManagerRowId)?.variants || []).length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-neutral-400">
                          No variants added. Click "Add New Variant" to create customized sizes/colors.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-neutral-50 px-6 py-4 flex justify-end shrink-0 border-t">
              <button
                type="button"
                onClick={() => setVariantManagerRowId(null)}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm px-6 py-2 rounded-xl transition-all"
              >
                Close & Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
