import { useState, useEffect } from "react";
import {
  Banner,
  BannerFormData,
} from "../../../services/api/admin/adminBannerService";
import { uploadImage } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
} from "../../../utils/imageUpload";

interface BannerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BannerFormData) => Promise<void>;
  banner?: Banner | null;
  mode: "create" | "edit";
}

export default function BannerFormModal({
  isOpen,
  onClose,
  onSubmit,
  banner,
  mode,
}: BannerFormModalProps) {
  const [formData, setFormData] = useState<BannerFormData>({
    title: "",
    image: "",
    link: "",
    order: 0,
    isActive: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && banner) {
        setFormData({
          title: banner.title,
          image: banner.image,
          link: banner.link || "",
          order: banner.order,
          isActive: banner.isActive,
        });
        setImagePreview(banner.image);
      } else {
        setFormData({
          title: "",
          image: "",
          link: "",
          order: 0,
          isActive: true,
        });
        setImagePreview("");
        setImageFile(null);
      }
      setErrors({});
    }
  }, [isOpen, mode, banner]);

  const handleImageChange = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors({ ...errors, image: validation.error || "Invalid image" });
      return;
    }

    setImageFile(file);
    try {
      const previewUrl = await createImagePreview(file);
      setImagePreview(previewUrl);
      setErrors({ ...errors, image: "" });
    } catch (err) {
      console.error("Error creating preview:", err);
      setErrors({ ...errors, image: "Failed to create preview" });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageChange(e.dataTransfer.files[0]);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.image && !imageFile) newErrors.image = "Image is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      let imageUrl = formData.image;

      if (imageFile) {
        setUploading(true);
        try {
          const uploadResult = await uploadImage(imageFile, "Wasgro mart/banners");
          imageUrl = uploadResult.secureUrl;
        } catch (error: any) {
          setErrors({
            ...errors,
            image: error.message || "Failed to upload image",
          });
          setUploading(false);
          setSubmitting(false);
          return;
        }
        setUploading(false);
      }

      await onSubmit({ ...formData, image: imageUrl });
      onClose();
    } catch (error) {
      console.error("Error submitting banner:", error);
      setErrors({ ...errors, submit: "Failed to save banner" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === "create" ? "Add New Banner" : "Edit Banner"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Banner Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className={`w-full px-4 py-2.5 bg-gray-50 border ${errors.title ? "border-red-300 ring-red-100" : "border-gray-200 ring-green-100"} rounded-xl focus:ring-4 focus:border-green-500 outline-none transition-all`}
                placeholder="Summer Sale Banner"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Image *
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative group h-48 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden bg-gray-50 ${
                  isDragging
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200"
                } ${errors.image ? "border-red-300" : ""}`}>
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium cursor-pointer hover:bg-gray-50 transition-colors">
                        Change Image
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files?.[0] &&
                            handleImageChange(e.target.files[0])
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-gray-400">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      SVG, PNG, JPG or WEBP
                    </p>
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        handleImageChange(e.target.files[0])
                      }
                    />
                  </>
                )}
              </div>
              {errors.image && (
                <p className="mt-1 text-sm text-red-500">{errors.image}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Link (Optional)
                </label>
                <input
                  type="text"
                  value={formData.link}
                  onChange={(e) =>
                    setFormData({ ...formData, link: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 outline-none transition-all"
                  placeholder="/category/grocery"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Order
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 outline-none transition-all"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, isActive: !formData.isActive })
                }
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.isActive ? "bg-green-600" : "bg-gray-200"
                }`}>
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                Active Status
              </span>
            </div>
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2">
              {submitting || uploading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {uploading ? "Uploading..." : "Saving..."}
                </>
              ) : mode === "create" ? (
                "Create Banner"
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
