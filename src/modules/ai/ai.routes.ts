import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { 
    getRestockSuggestion,
    getBusinessSummary,
    generatePromoContent 
} from "./ai.controller";

const router = Router()

router.post(
    "/restock-sugesstion", 
    authMiddleware, 
    getRestockSuggestion
)
router.post(
    "/business-summary",
    authMiddleware,
    getBusinessSummary
)

router.post(
    "/promo-generator",
    authMiddleware,
    generatePromoContent
)

export default router