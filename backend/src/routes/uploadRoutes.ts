import { Router, Request, Response } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadDocument,
  uploadMultipleDocuments,
  handleUploadError,
} from "../middleware/upload";
import {
  uploadImageFromBuffer,
  uploadDocumentFromBuffer,
  deleteImage,
} from "../services/storageService";
import { UPLOAD_FOLDERS, sanitizeUploadFolder } from "../config/storage";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All upload routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/upload/image
 * Upload a single image
 */
router.post(
  "/image",
  requireUserType("Admin", "Seller"),
  uploadSingleImage.single("image"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const file = (req as any).file;
    const folder = sanitizeUploadFolder(
      req.body.folder as string,
      UPLOAD_FOLDERS.PRODUCTS
    );

    const result = await uploadImageFromBuffer(file.buffer, {
      folder,
      mimetype: file.mimetype,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/upload/images
 * Upload multiple images
 */
router.post(
  "/images",
  requireUserType("Admin", "Seller"),
  uploadMultipleImages.array("images", 10),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).files || ((req as any).files as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided",
      });
    }

    const folder = sanitizeUploadFolder(
      req.body.folder as string,
      UPLOAD_FOLDERS.PRODUCTS
    );
    const files = (req as any).files as any[];

    const uploadPromises = files.map((file) =>
      uploadImageFromBuffer(file.buffer, {
        folder,
        mimetype: file.mimetype,
      })
    );

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * POST /api/v1/upload/document
 * Upload a document (image or PDF)
 */
router.post(
  "/document",
  authenticate,
  uploadDocument.single("document"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No document file provided",
      });
    }

    let folder: string = UPLOAD_FOLDERS.SELLER_DOCUMENTS;
    const userType = (req as any).user?.userType;

    if (userType === "Delivery") {
      folder = UPLOAD_FOLDERS.DELIVERY_DOCUMENTS;
    } else if (userType === "Seller") {
      folder = UPLOAD_FOLDERS.SELLER_DOCUMENTS;
    }

    const file = (req as any).file;
    const isImage = file.mimetype.startsWith("image/");

    const result = await uploadDocumentFromBuffer(file.buffer, {
      folder,
      mimetype: file.mimetype,
      resourceType: isImage ? "image" : "raw",
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/upload/documents
 * Upload multiple documents
 */
router.post(
  "/documents",
  authenticate,
  uploadMultipleDocuments.array("documents", 5),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).files || ((req as any).files as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No document files provided",
      });
    }

    let folder: string = UPLOAD_FOLDERS.SELLER_DOCUMENTS;
    const userType = (req as any).user?.userType;

    if (userType === "Delivery") {
      folder = UPLOAD_FOLDERS.DELIVERY_DOCUMENTS;
    } else if (userType === "Seller") {
      folder = UPLOAD_FOLDERS.SELLER_DOCUMENTS;
    }

    const files = (req as any).files as any[];

    const uploadPromises = files.map((file) => {
      const isImage = file.mimetype.startsWith("image/");
      return uploadDocumentFromBuffer(file.buffer, {
        folder,
        mimetype: file.mimetype,
        resourceType: isImage ? "image" : "raw",
      });
    });

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * DELETE /api/v1/upload
 * Delete a file by storage path (body: { path: "products/uuid.webp" })
 */
router.delete(
  "/",
  requireUserType("Admin", "Seller"),
  asyncHandler(async (req: Request, res: Response) => {
    const storagePath = req.body?.path as string;

    if (!storagePath || typeof storagePath !== "string") {
      return res.status(400).json({
        success: false,
        message: "Storage path is required (body.path)",
      });
    }

    await deleteImage(storagePath);

    return res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  })
);

export default router;
