import { Response } from "express";
import prisma from "../../config/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";

const getUserBusinessId = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });

  return user?.businessId;
};

export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const totalCustomers = await prisma.customer.count({
      where: { businessId },
    });

    const totalProducts = await prisma.product.count({
      where: { businessId },
    });

    const totalTransactions = await prisma.transaction.count({
      where: { businessId },
    });

    const revenueResult = await prisma.transaction.aggregate({
      where: {
        businessId,
        status: "PAID",
      },
      _sum: {
        grandTotal: true,
      },
    });

    const products = await prisma.product.findMany({
      where: { businessId },
      select: {
        id: true,
        stock: true,
        minStock: true,
      },
    });

    const lowStockProducts = products.filter(
      (product) => product.stock <= product.minStock
    ).length;

    return res.json({
      success: true,
      message: "Dashboard summary berhasil diambil",
      data: {
        totalCustomers,
        totalProducts,
        totalTransactions,
        totalRevenue: revenueResult._sum.grandTotal || 0,
        lowStockProducts,
      },
    });
  } catch (error) {
    console.error("GET_DASHBOARD_SUMMARY_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getRecentTransactions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const limit = Number(req.query.limit) || 5;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const transactions = await prisma.transaction.findMany({
      where: { businessId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return res.json({
      success: true,
      message: "Recent transactions berhasil diambil",
      data: transactions,
    });
  } catch (error) {
    console.error("GET_RECENT_TRANSACTIONS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTopProducts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = Number(req.query.limit) || 5;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const transactionItems = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          businessId,
          status: "PAID",
        },
      },
      include: {
        product: true,
      },
    });

    const productMap = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string | null;
        totalSold: number;
        totalRevenue: number;
      }
    >();

    for (const item of transactionItems) {
      const productId = item.productId;
      const existing = productMap.get(productId);

      if (existing) {
        existing.totalSold += item.quantity;
        existing.totalRevenue += Number(item.subtotal);
      } else {
        productMap.set(productId, {
          productId,
          name: item.product.name,
          sku: item.product.sku,
          totalSold: item.quantity,
          totalRevenue: Number(item.subtotal),
        });
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);

    return res.json({
      success: true,
      message: "Top products berhasil diambil",
      data: topProducts,
    });
  } catch (error) {
    console.error("GET_TOP_PRODUCTS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getRevenueChart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const days = Number(req.query.days) || 7;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        businessId,
        status: "PAID",
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        grandTotal: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const chartMap = new Map<string, number>();

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const key = date.toISOString().slice(0, 10);
      chartMap.set(key, 0);
    }

    for (const transaction of transactions) {
      const key = transaction.createdAt.toISOString().slice(0, 10);
      chartMap.set(
        key,
        (chartMap.get(key) || 0) + Number(transaction.grandTotal)
      );
    }

    const chart = Array.from(chartMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    return res.json({
      success: true,
      message: "Revenue chart berhasil diambil",
      data: chart,
    });
  } catch (error) {
    console.error("GET_REVENUE_CHART_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};