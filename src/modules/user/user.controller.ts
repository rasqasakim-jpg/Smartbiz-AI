import { Response } from "express";
import prisma from "../../config/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      success: true,
      message: "Profile berhasil diambil",
      data: user,
    });
  } catch (error) {
    console.error("GET_ME_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { fullName } = req.body;

    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: "fullName wajib diisi",
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { fullName },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return res.json({
      success: true,
      message: "Profile berhasil diupdate",
      data: user,
    });
  } catch (error) {
    console.error("UPDATE_ME_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};