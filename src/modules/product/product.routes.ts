import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
  uploadProductImage,
} from "./product.controller";
import upload from "../../middleware/upload.middleware";

const router = Router();

router.post("/", authMiddleware, createProduct);
router.get("/", authMiddleware, getProducts);
router.get("/:id", authMiddleware, getProductById);
router.patch("/:id", authMiddleware, updateProduct);
router.patch(
  "/:id/image",
  authMiddleware,
  upload.single("image"),
  uploadProductImage
);
router.delete("/:id", authMiddleware, deleteProduct);

export default router;