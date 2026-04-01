import { useState, useRef } from "react";

export default function BannerUpload() {
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size exceeds 5MB limit.");
        return;
      }
      const url = URL.createObjectURL(file);
      setImage(url);
    }
  };

  const handleRemove = () => {
    if (image) {
      URL.revokeObjectURL(image);
    }
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-teal-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-neutral-800">
            Upload Promotion Banner
          </h3>
        </div>
        {image && (
          <button
            onClick={handleRemove}
            className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 px-2 py-1 rounded-md transition-colors">
            REMOVE
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {!image ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 border-2 border-dashed border-teal-200 rounded-lg p-4 text-center bg-teal-50/50 cursor-pointer hover:bg-teal-50 transition-colors flex flex-col items-center justify-center min-h-[120px]">
          <svg
            className="w-8 h-8 text-teal-400 mb-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-xs text-teal-600 font-medium">
            Drag & drop or click to upload
          </p>
          <p className="text-[10px] text-neutral-400 mt-1">
            PNG, JPG up to 5MB
          </p>
        </div>
      ) : (
        <div className="flex-1 relative rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 min-h-[120px]">
          <img
            src={image}
            alt="Promotion Banner Preview"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
            <button
               onClick={() => fileInputRef.current?.click()}
               className="bg-white/90 text-teal-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
               Change Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
