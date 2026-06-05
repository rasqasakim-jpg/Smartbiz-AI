import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
    getDashboardSummary,
    getRecentTransactions,
    getRevenueChart,
    getTopProducts,
} from "./dashboard.controller"

const router = Router()

router.get("/summary", authMiddleware, getDashboardSummary)
router.get("/recent-transactions", authMiddleware, getRecentTransactions)
router.get("/top-products", authMiddleware, getTopProducts)
router.get("/revenue-chart", authMiddleware, getRevenueChart)

export default router