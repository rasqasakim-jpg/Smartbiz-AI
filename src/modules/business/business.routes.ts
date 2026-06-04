import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
    createBusiness,
    getMyBusiness,
    updateMyBusiness
} from "./business.controller"

const router = Router()

router.post("/", authMiddleware, createBusiness)
router.get("/me", authMiddleware, getMyBusiness)
router.patch("/me", authMiddleware, updateMyBusiness)

export default router