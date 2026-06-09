"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const business_routes_1 = __importDefault(require("./modules/business/business.routes"));
const customer_routes_1 = __importDefault(require("./modules/customer/customer.routes"));
const product_routes_1 = __importDefault(require("./modules/product/product.routes"));
const inventory_routes_1 = __importDefault(require("./modules/inventory/inventory.routes"));
const transaction_routes_1 = __importDefault(require("./modules/transaction/transaction.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const ai_routes_1 = __importDefault(require("./modules/ai/ai.routes"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
if (process.env.NODE_ENV === "development") {
    app.use((0, morgan_1.default)("dev"));
}
app.use("/api/ai", ai_routes_1.default);
app.use("/api/dashboard", dashboard_routes_1.default);
app.use("/api/transactions", transaction_routes_1.default);
app.use("/api/inventory", inventory_routes_1.default);
app.use("/api/products", product_routes_1.default);
app.use("/api/customers", customer_routes_1.default);
app.use("/api/businesses", business_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "SmartBiz AI API is running",
    });
});
exports.default = app;
