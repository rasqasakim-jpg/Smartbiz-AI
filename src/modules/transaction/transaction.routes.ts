import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
    createTransaction,
    getTransactionById,
    getTransactions,
} from "./transaction.controller"

const router = Router()

router.post("/", authMiddleware, createTransaction)
router.get("/", authMiddleware, getTransactions)
router.get("/:id", authMiddleware, getTransactionById)

export default router