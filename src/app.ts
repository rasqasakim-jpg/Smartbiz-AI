import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./modules/auth/auth.routes"
import userRoutes from "./modules/user/user.routes"
import businessRoutes from "./modules/business/business.routes"
import customerRoutes from "./modules/customer/customer.routes"
import productRoutes from "./modules/product/product.routes"
import inventoryRoutes from "./modules/inventory/inventory.routes"
import transactionRoutes from "./modules/transaction/transaction.routes"
import dashboardRoutes from "./modules/dashboard/dashboard.routes"
import aiRoutes from "./modules/ai/ai.routes"

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api/ai", aiRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/transactions", transactionRoutes)
app.use("/api/inventory", inventoryRoutes)
app.use("/api/products", productRoutes)
app.use("/api/customers", customerRoutes)
app.use("/api/businesses", businessRoutes)
app.use("/api/users", userRoutes)
app.use("/api/auth", authRoutes)
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SmartBiz AI API is running",
  });
});

export default app;