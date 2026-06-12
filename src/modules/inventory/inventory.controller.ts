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

const validateQuantity = (quantity: unknown): string | null => {
  if (quantity === undefined || quantity === null) {
    return "Quantity wajib diisi";
  }

  const numberQuantity = Number(quantity);

  if (Number.isNaN(numberQuantity)) {
    return "Quantity harus berupa angka";
  }

  if (!Number.isInteger(numberQuantity)) {
    return "Quantity harus berupa angka bulat";
  }

  if (numberQuantity <= 0) {
    return "Quantity harus lebih dari 0";
  }

  return null;
};

const getProductInBusiness = async (productId: string, businessId: string) => {
  return prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
    },
  });
};

export const stockIn = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId, quantity, note } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId wajib diisi",
      });
    }

    const quantityError = validateQuantity(quantity);

    if (quantityError) {
      return res.status(400).json({
        success: false,
        message: quantityError,
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const product = await getProductInBusiness(productId, businessId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          type: "IN",
          quantity: Number(quantity),
          note,
          productId,
          businessId,
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            increment: Number(quantity),
          },
        },
      });

      return {
        movement,
        product: updatedProduct,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Stock in berhasil",
      data: result,
    });
  } catch (error) {
    console.error("STOCK_IN_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const stockOut = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId, quantity, note } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId wajib diisi",
      });
    }

    const quantityError = validateQuantity(quantity);

    if (quantityError) {
      return res.status(400).json({
        success: false,
        message: quantityError,
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const product = await getProductInBusiness(productId, businessId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    if (product.stock < Number(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Stock tidak mencukupi",
      });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          type: "OUT",
          quantity: Number(quantity),
          note,
          productId,
          businessId,
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            decrement: Number(quantity),
          },
        },
      });

      return {
        movement,
        product: updatedProduct,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Stock out berhasil",
      data: result,
    });
  } catch (error) {
    console.error("STOCK_OUT_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const adjustment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId, newStock, note } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId wajib diisi",
      });
    }

    if (newStock === undefined || newStock === null) {
      return res.status(400).json({
        success: false,
        message: "newStock wajib diisi",
      });
    }

    const numberNewStock = Number(newStock);

    if (Number.isNaN(numberNewStock)) {
      return res.status(400).json({
        success: false,
        message: "newStock harus berupa angka",
      });
    }

    if (!Number.isInteger(numberNewStock)) {
      return res.status(400).json({
        success: false,
        message: "newStock harus berupa angka bulat",
      });
    }

    if (numberNewStock < 0) {
      return res.status(400).json({
        success: false,
        message: "newStock tidak boleh negatif",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const product = await getProductInBusiness(productId, businessId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    const difference = numberNewStock - product.stock;

    const result = await prisma.$transaction(async (tx: any) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          type: "ADJUSTMENT",
          quantity: Math.abs(difference),
          note:
            note ||
            `Adjustment stock dari ${product.stock} menjadi ${numberNewStock}`,
          productId,
          businessId,
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stock: numberNewStock,
        },
      });

      return {
        movement,
        product: updatedProduct,
        difference,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Stock adjustment berhasil",
      data: result,
    });
  } catch (error) {
    console.error("ADJUSTMENT_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getMovements = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const productId = req.query.productId
      ? String(req.query.productId)
      : undefined;

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

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        businessId,
        ...(productId && { productId }),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      message: "Inventory movements berhasil diambil",
      data: movements,
    });
  } catch (error) {
    console.error("GET_MOVEMENTS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getLowStockProducts = async (req: AuthRequest, res: Response) => {
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

    const products = await prisma.product.findMany({
      where: {
        businessId,
      },
      orderBy: {
        stock: "asc",
      },
    });

    const lowStockProducts = products.filter(
      (product: any) => product.stock <= product.minStock
    );

    return res.json({
      success: true,
      message: "Low stock products berhasil diambil",
      data: lowStockProducts,
    });
  } catch (error) {
    console.error("GET_LOW_STOCK_PRODUCTS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};