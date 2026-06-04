import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
    createCustomer,
    deleteCustomer,
    getCustomerById,
    getCustomers,
    updateCustomer,
} from "./customer.controller"

const router = Router()

router.post("/", authMiddleware, createCustomer)
router.get("/", authMiddleware, getCustomers)
router.get("/:id", authMiddleware, getCustomerById)
router.patch("/:id", authMiddleware, updateCustomer)
router.delete("/:id", authMiddleware, deleteCustomer)

export default router