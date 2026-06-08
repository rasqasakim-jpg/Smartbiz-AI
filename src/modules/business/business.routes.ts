import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import upload from "../../middleware/upload.middleware";
import {
    createBusiness,
    getMyBusiness,
    updateMyBusiness,
    uploadBusinessLogo
} from "./business.controller"

const router = Router()

router.post("/", authMiddleware, createBusiness)
router.get("/me", authMiddleware, getMyBusiness)
router.patch("/me", authMiddleware, updateMyBusiness)

router.patch(
    "/logo",
    authMiddleware,
    upload.single("image"),
    uploadBusinessLogo
)

export default router