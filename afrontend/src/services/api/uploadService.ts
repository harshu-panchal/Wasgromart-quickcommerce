import api from "./config";

export interface UploadResult {
  url: string;
  /** Relative storage path, e.g. products/uuid.webp (used by DELETE) */
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface UploadResponse {
  success: boolean;
  data: UploadResult | UploadResult[];
  message?: string;
}

/**
 * Upload a single image to server storage via backend
 */
export async function uploadImage(
  file: File,
  folder?: string
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("image", file);
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await api.post<UploadResponse>("/upload/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (response.data.success && response.data.data) {
    return Array.isArray(response.data.data)
      ? response.data.data[0]
      : response.data.data;
  }

  throw new Error(response.data.message || "Failed to upload image");
}

/**
 * Upload multiple images to server storage via backend
 */
export async function uploadImages(
  files: File[],
  folder?: string
): Promise<UploadResult[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await api.post<UploadResponse>("/upload/images", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (response.data.success && response.data.data) {
    return Array.isArray(response.data.data)
      ? response.data.data
      : [response.data.data];
  }

  throw new Error(response.data.message || "Failed to upload images");
}

/**
 * Upload a document (image or PDF) to server storage via backend
 */
export async function uploadDocument(
  file: File,
  folder?: string
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("document", file);
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await api.post<UploadResponse>(
    "/upload/document",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  if (response.data.success && response.data.data) {
    return Array.isArray(response.data.data)
      ? response.data.data[0]
      : response.data.data;
  }

  throw new Error(response.data.message || "Failed to upload document");
}

/**
 * Upload a delivery signup document before the user is authenticated.
 */
export async function uploadDeliverySignupDocument(
  file: File
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("document", file);

  const response = await api.post<UploadResponse>(
    "/auth/delivery/signup-document",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  if (response.data.success && response.data.data) {
    return Array.isArray(response.data.data)
      ? response.data.data[0]
      : response.data.data;
  }

  throw new Error(response.data.message || "Failed to upload document");
}

/**
 * Upload multiple documents to server storage via backend
 */
export async function uploadDocuments(
  files: File[],
  folder?: string
): Promise<UploadResult[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("documents", file);
  });
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await api.post<UploadResponse>(
    "/upload/documents",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  if (response.data.success && response.data.data) {
    return Array.isArray(response.data.data)
      ? response.data.data
      : [response.data.data];
  }

  throw new Error(response.data.message || "Failed to upload documents");
}

/**
 * Delete an uploaded file by storage path (publicId from upload response)
 */
export async function deleteImage(storagePath: string): Promise<void> {
  const response = await api.delete<{ success: boolean; message?: string }>(
    "/upload",
    { data: { path: storagePath } }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to delete image");
  }
}
