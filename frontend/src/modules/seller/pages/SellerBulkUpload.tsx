import React, { useState } from "react";
import { bulkUploadProducts } from "../../../services/api/productService";
import * as xlsx from "xlsx";
import { getCategories } from "../../../services/api/categoryService";

interface BulkUploadResult {
  total: number;
  inserted: number;
  failed: number;
  errors: Array<{
    row: number;
    product: string;
    errors: string[];
  }>;
}

export default function SellerBulkUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const response = await getCategories();
        if (response.success) {
          setCategories(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch categories for sample:", err);
      }
    };
    fetchCats();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.name.endsWith(".xlsx") ||
        selectedFile.name.endsWith(".xls") ||
        selectedFile.name.endsWith(".csv")
      ) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please select a valid Excel (.xlsx, .xls) or CSV file.");
        setFile(null);
      }
    }
  };

  const downloadSample = () => {
    // Get first few valid categories names for sample data
    const catName1 = categories[0]?.name || "Oil";
    const catName2 = categories[1]?.name || "Ice Cream";

    const sampleData = [
      {
        name: "Test Product 1",
        price: 199,
        stock: 50,
        category: catName1,
        description: "This is a test product description.",
      },
      {
        name: "Test Product 2",
        price: 450,
        stock: 100,
        category: catName2,
        description: "This is another test product description.",
      },
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);

    // Add a helper text row or sheet with valid categories
    const validCats = categories.map(c => c.name).slice(0, 10).join(", ");
    if (validCats) {
      console.log("Valid categories for sample:", validCats);
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Products");
    xlsx.writeFile(workbook, "Wasgro_Bulk_Upload_Sample.xlsx");
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await bulkUploadProducts(file);
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.message || "Failed to upload products.");
        if (response.data) setResult(response.data);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "An error occurred during upload.";
      setError(errorMsg);
      
      // If the error response contains partial results, show them
      if (err.response?.data?.data) {
        setResult(err.response.data.data);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-teal-700 text-white px-4 sm:px-6 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Bulk Product Upload</h2>
          <button
            onClick={downloadSample}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md border border-white/30 transition-colors flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Sample Excel
          </button>
        </div>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-10 bg-neutral-50 hover:bg-neutral-100 transition-colors">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mb-2">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span className="text-sm font-medium text-neutral-700">
                {file ? file.name : "Click to select or drag & drop file"}
              </span>
              <span className="text-xs text-neutral-500">
                Supports Excel (.xlsx, .xls) and CSV
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`px-6 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all ${
                !file || uploading
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  : "bg-teal-600 text-white hover:bg-teal-700 active:scale-95"
              } flex items-center gap-2`}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                "Start Upload"
              )}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden animate-fade-in">
          <div className="bg-neutral-800 text-white px-4 sm:px-6 py-3">
            <h3 className="text-lg font-semibold">Upload Results</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-center">
                <div className="text-2xl font-bold text-neutral-900">
                  {result.total}
                </div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                  Total Rows
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {result.inserted}
                </div>
                <div className="text-xs text-green-600 uppercase tracking-wider font-semibold">
                  Successful
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {result.failed}
                </div>
                <div className="text-xs text-red-600 uppercase tracking-wider font-semibold">
                  Failed
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Error Details
                </h4>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="px-4 py-2 border-b font-semibold">Row</th>
                        <th className="px-4 py-2 border-b font-semibold">Product</th>
                        <th className="px-4 py-2 border-b font-semibold">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="px-4 py-2 font-medium text-neutral-900">
                            {err.row}
                          </td>
                          <td className="px-4 py-2 text-neutral-700">
                            {err.product}
                          </td>
                          <td className="px-4 py-2">
                            <ul className="list-disc list-inside text-red-600 text-xs">
                              {err.errors.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
