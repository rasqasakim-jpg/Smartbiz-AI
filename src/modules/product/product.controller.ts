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

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, sku, description, price, stock, minStock } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!name || !sku || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "name, sku, dan price wajib diisi",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const existingProduct = await prisma.product.findFirst({
      where: {
        businessId,
        sku,
      },
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "SKU produk sudah digunakan di bisnis ini",
      });
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        description,
        price,
        stock: stock ?? 0,
        minStock: minStock ?? 5,
        businessId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product berhasil dibuat",
      data: product,
    });
  } catch (error) {
    console.error("CREATE_PRODUCT_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const search = req.query.search ? String(req.query.search) : undefined;

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

    const products = await prisma.product.findMany({
      where: {
        businessId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      message: "List product berhasil diambil",
      data: products,
    });
  } catch (error) {
    console.error("GET_PRODUCTS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getProductById = async (req: AuthRequest, res: Response) => {
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

    const product = await prisma.product.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Detail product berhasil diambil",
      data: product,
    });
  } catch (error) {
    console.error("GET_PRODUCT_BY_ID_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);
    const { name, sku, description, price, stock, minStock } = req.body;

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

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: {
          businessId,
          sku,
          NOT: {
            id,
          },
        },
      });

      if (duplicateSku) {
        return res.status(409).json({
          success: false,
          message: "SKU produk sudah digunakan di bisnis ini",
        });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sku && { sku }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(stock !== undefined && { stock }),
        ...(minStock !== undefined && { minStock }),
      },
    });

    return res.json({
      success: true,
      message: "Product berhasil diupdate",
      data: product,
    });
  } catch (error) {
    console.error("UPDATE_PRODUCT_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
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

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "Product berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE_PRODUCT_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};