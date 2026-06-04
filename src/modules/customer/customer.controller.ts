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

export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, phone, email, address, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Nama customer wajib diisi",
      });
    }

    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Buat business profile terlebih dahulu",
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email,
        address,
        notes,
        businessId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Customer berhasil dibuat",
      data: customer,
    });
  } catch (error) {
    console.error("CREATE_CUSTOMER_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { search } = req.query;

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

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        ...(search && {
          OR: [
            { name: { contains: String(search), mode: "insensitive" } },
            { phone: { contains: String(search), mode: "insensitive" } },
            { email: { contains: String(search), mode: "insensitive" } },
          ],
        }),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      message: "List customer berhasil diambil",
      data: customers,
    });
  } catch (error) {
    console.error("GET_CUSTOMERS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getCustomerById = async (req: AuthRequest, res: Response) => {
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

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Detail customer berhasil diambil",
      data: customer,
    });
  } catch (error) {
    console.error("GET_CUSTOMER_BY_ID_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = String(req.params.id);
    const { name, phone, email, address, notes } = req.body;

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

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer tidak ditemukan",
      });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email && { email }),
        ...(address && { address }),
        ...(notes && { notes }),
      },
    });

    return res.json({
      success: true,
      message: "Customer berhasil diupdate",
      data: customer,
    });
  } catch (error) {
    console.error("UPDATE_CUSTOMER_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
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

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer tidak ditemukan",
      });
    }

    await prisma.customer.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "Customer berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE_CUSTOMER_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};