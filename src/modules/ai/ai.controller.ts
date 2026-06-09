import { GoogleGenAI } from "@google/genai";
import { Response } from "express";
import prisma from "../../config/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const getUserBusinessId = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });

  return user?.businessId;
};

export const getRestockSuggestion = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "GEMINI_API_KEY belum dikonfigurasi",
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
      where: { businessId },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        price: true,
      },
      orderBy: {
        stock: "asc",
      },
    });

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Belum ada product untuk dianalisis",
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactionItems = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          businessId,
          status: "PAID",
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    const salesMap = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string | null;
        totalSold30Days: number;
      }
    >();

    for (const item of transactionItems) {
      const existing = salesMap.get(item.productId);

      if (existing) {
        existing.totalSold30Days += item.quantity;
      } else {
        salesMap.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          totalSold30Days: item.quantity,
        });
      }
    }

    const analysisData = products.map((product) => {
      const sales = salesMap.get(product.id);

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        currentStock: product.stock,
        minimumStock: product.minStock,
        price: Number(product.price),
        soldLast30Days: sales?.totalSold30Days || 0,
      };
    });

    const prompt = `
Kamu adalah AI inventory analyst untuk aplikasi SmartBiz AI.

Tugas kamu:
Analisis data produk berikut dan berikan saran restock yang praktis untuk pemilik UMKM.

Data produk:
${JSON.stringify(analysisData, null, 2)}

Instruksi jawaban:
- Gunakan bahasa Indonesia.
- Jangan terlalu panjang.
- Fokus pada produk yang stoknya rendah atau penjualannya tinggi.
- Berikan alasan singkat.
- Berikan rekomendasi jumlah restock.
- Jika data penjualan masih sedikit, jelaskan bahwa rekomendasi masih perkiraan.
- Format jawaban rapi dengan bullet point.

Output yang diharapkan:
1. Ringkasan kondisi stok
2. Produk prioritas restock
3. Rekomendasi tindakan
`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      success: true,
      message: "AI restock suggestion berhasil dibuat",
      data: {
        analysisData,
        suggestion: result.text,
      },
    });
  } catch (error) {
    console.error("AI_RESTOCK_SUGGESTION_ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBusinessSummary = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "GEMINI_API_KEY belum dikonfigurasi",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business belum dibuat",
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        type: true,
      },
    });

    const totalCustomers = await prisma.customer.count({
      where: { businessId },
    });

    const totalProducts = await prisma.product.count({
      where: { businessId },
    });

    const totalTransactions = await prisma.transaction.count({
      where: { businessId, status: "PAID" },
    });

    const revenue = await prisma.transaction.aggregate({
      where: {
        businessId,
        status: "PAID",
      },
      _sum: {
        grandTotal: true,
      },
    });

    const lowStockProductsRaw = await prisma.product.findMany({
      where: {
        businessId,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
      },
    });

    const lowStockProducts = lowStockProductsRaw
      .filter((product) => product.stock <= product.minStock)
      .map((product) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        currentStock: product.stock,
        minimumStock: product.minStock,
      }));

    const transactionItems = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          businessId,
          status: "PAID",
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    const productSalesMap = new Map<
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
      const existing = productSalesMap.get(item.productId);

      if (existing) {
        existing.totalSold += item.quantity;
        existing.totalRevenue += Number(item.subtotal);
      } else {
        productSalesMap.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          totalSold: item.quantity,
          totalRevenue: Number(item.subtotal),
        });
      }
    }

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    const summaryData = {
      business,
      totalCustomers,
      totalProducts,
      totalTransactions,
      totalRevenue: Number(revenue._sum.grandTotal || 0),
      lowStockProducts,
      topProducts,
    };

    const prompt = `
Kamu adalah konsultan bisnis UMKM untuk aplikasi SmartBiz AI.

Analisis data bisnis berikut:
${JSON.stringify(summaryData, null, 2)}

Tugas kamu:
Berikan laporan bisnis singkat yang mudah dipahami owner UMKM.

Instruksi:
- Gunakan bahasa Indonesia.
- Jangan terlalu panjang.
- Jangan membuat angka baru di luar data.
- Kalau data masih sedikit, katakan bahwa insight masih awal/perkiraan.
- Fokus pada insight yang bisa ditindaklanjuti.
- Format rapi dengan heading dan bullet point.

Output:
1. Ringkasan bisnis
2. Insight penting
3. Produk yang perlu perhatian
4. Saran peningkatan penjualan
5. Saran operasional
`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      success: true,
      message: "AI business summary berhasil dibuat",
      data: {
        summaryData,
        insight: result.text,
      },
    });
  } catch (error) {
    console.error("AI_BUSINESS_SUMMARY_ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const generatePromoContent = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    const {
      productId,
      promoText,
      channel = "instagram",
      tone = "ramah",
    } = req.body;

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

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business belum dibuat",
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        price: true,
        stock: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product tidak ditemukan",
      });
    }

    const prompt = `
Kamu adalah copywriter UMKM.

Data Produk:
${JSON.stringify(product, null, 2)}

Channel:
${channel}

Tone:
${tone}

Promo Resmi:
${promoText || "Tidak ada promo"}

ATURAN PENTING:
- Jangan mengarang diskon.
- Jangan mengarang bonus.
- Jangan mengarang gratis ongkir.
- Jangan mengarang garansi.
- Jangan mengarang promo yang tidak ada di input.
- Jika promo kosong, buat caption promosi biasa tanpa menyebut diskon atau bonus.
- Gunakan bahasa Indonesia.

Buat:
1. Headline
2. Caption promosi
3. Call To Action
`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      success: true,
      message: "Promo berhasil dibuat",
      data: {
        product: {
          id: product.id,
          name: product.name,
        },
        channel,
        tone,
        promoText,
        content: result.text,
      },
    });
  } catch (error) {
    console.error("AI_PROMO_GENERATOR_ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};