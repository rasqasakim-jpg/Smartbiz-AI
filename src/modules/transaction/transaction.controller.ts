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

const generateInvoiceNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(100000 + Math.random() * 900000);

  return `INV-${date}-${random}`;
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { customerId, items, discountTotal, paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items transaksi wajib diisi",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId },
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer tidak ditemukan",
        });
      }
    }

    const productIds = items.map((item) => String(item.productId));

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId,
      },
    });

    if (products.length !== productIds.length) {
      return res.status(404).json({
        success: false,
        message: "Ada product yang tidak ditemukan",
      });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    let subtotal = 0;

    for (const item of items) {
      const productId = String(item.productId);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity item harus angka bulat lebih dari 0",
        });
      }

      const product = productMap.get(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product tidak ditemukan",
        });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock ${product.name} tidak mencukupi`,
        });
      }

      subtotal += Number(product.price) * quantity;
    }

    const numberDiscountTotal = Number(discountTotal || 0);

    if (Number.isNaN(numberDiscountTotal) || numberDiscountTotal < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount total tidak valid",
      });
    }

    if (numberDiscountTotal > subtotal) {
      return res.status(400).json({
        success: false,
        message: "Discount tidak boleh lebih besar dari subtotal",
      });
    }

    const grandTotal = subtotal - numberDiscountTotal;
    const invoiceNumber = generateInvoiceNumber();

    const transaction = await prisma.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          subtotal,
          discountTotal: numberDiscountTotal,
          grandTotal,
          paymentMethod: paymentMethod || "CASH",
          customerId: customerId || null,
          businessId,
          createdById: userId,
        },
      });

      for (const item of items) {
        const productId = String(item.productId);
        const quantity = Number(item.quantity);
        const product = productMap.get(productId)!;
        const itemSubtotal = Number(product.price) * quantity;

        await tx.transactionItem.create({
          data: {
            transactionId: createdTransaction.id,
            productId,
            quantity,
            price: product.price,
            subtotal: itemSubtotal,
          },
        });

        await tx.product.update({
          where: { id: productId },
          data: {
            stock: {
              decrement: quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            type: "OUT",
            quantity,
            note: `Penjualan invoice ${invoiceNumber}`,
            productId,
            businessId,
          },
        });
      }

      return tx.transaction.findUnique({
        where: { id: createdTransaction.id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Transaction berhasil dibuat",
      data: transaction,
    });
  } catch (error) {
    console.error("CREATE_TRANSACTION_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
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
    });

    return res.json({
      success: true,
      message: "List transaction berhasil diambil",
      data: transactions,
    });
  } catch (error) {
    console.error("GET_TRANSACTIONS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTransactionById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Detail transaction berhasil diambil",
      data: transaction,
    });
  } catch (error) {
    console.error("GET_TRANSACTION_BY_ID_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};