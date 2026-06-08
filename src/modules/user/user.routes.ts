import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import upload from "../../middleware/upload.middleware";
import { getMe, updateMe, uploadAvatar } from "./user.controller";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateMe);

router.patch(
    "/avatar",
    authMiddleware,
    upload.single("image"),
    uploadAvatar
)

export default router;