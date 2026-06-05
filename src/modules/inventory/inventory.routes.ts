import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  adjustment,
  getLowStockProducts,
  getMovements,
  stockIn,
  stockOut,
} from "./inventory.controller";

const router = Router()

router.post("/stock-in", authMiddleware, stockIn)
router.post("/stock-out", authMiddleware, stockOut)
router.post("/adjusment", authMiddleware, adjustment)
router.get("/movements", authMiddleware, getMovements)
router.get("/low-stock", authMiddleware, getLowStockProducts)

export default router