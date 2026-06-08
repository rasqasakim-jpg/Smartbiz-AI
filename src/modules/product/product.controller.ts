import { Response } from "express";
import prisma from "../../config/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";
import cloudinary from "../../config/cloudinary";
import streamifier from "streamifier";

const getUserBusinessId = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });

  return user?.businessId;
};

const generateSku = () => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `PRD-${datePart}-${randomPart}`;
};

const validateNumberField = (
  value: unknown,
  fieldName: string
): string | null => {
  if (value === undefined) return null;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return `${fieldName} harus berupa angka`;
  }

  if (numberValue < 0) {
    return `${fieldName} tidak boleh negatif`;
  }

  return null;
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, sku, description, price, stock, minStock } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "name dan price wajib diisi",
      });
    }

    if (!String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama product tidak boleh kosong",
      });
    }

    const priceError = validateNumberField(price, "Price");
    const stockError = validateNumberField(stock, "Stock");
    const minStockError = validateNumberField(minStock, "Min stock");

    if (priceError || stockError || minStockError) {
      return res.status(400).json({
        success: false,
        message: priceError || stockError || minStockError,
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const finalSku = sku ? String(sku).trim() : generateSku();

    const existingProduct = await prisma.product.findFirst({
      where: {
        businessId,
        sku: finalSku,
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
        name: String(name).trim(),
        sku: finalSku,
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

export const uploadProductImage = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const productId = String(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image wajib diupload",
      });
    }

    const file = req.file;

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business tidak ditemukan",
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "smartbiz-ai/products",
        },
        (error, result) => {
          if (error) return reject(error);

          resolve(result);
        }
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        imageUrl: uploadResult.secure_url,
      },
    });

    return res.json({
      success: true,
      message: "Image product berhasil diupload",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("UPLOAD_PRODUCT_IMAGE_ERROR:", error);

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
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama product tidak boleh kosong",
      });
    }

    const priceError = validateNumberField(price, "Price");
    const stockError = validateNumberField(stock, "Stock");
    const minStockError = validateNumberField(minStock, "Min stock");

    if (priceError || stockError || minStockError) {
      return res.status(400).json({
        success: false,
        message: priceError || stockError || minStockError,
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

    const trimmedSku = sku !== undefined ? String(sku).trim() : undefined;

    if (trimmedSku && trimmedSku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: {
          businessId,
          sku: trimmedSku,
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
        ...(name !== undefined && { name: String(name).trim() }),
        ...(trimmedSku !== undefined && { sku: trimmedSku || generateSku() }),
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