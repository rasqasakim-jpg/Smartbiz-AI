import { Response } from "express";
import prisma from "../../config/prisma";
import cloudinary from "../../config/cloudinary";
import streamifier from "streamifier";
import { AuthRequest } from "../../middleware/auth.middleware";

const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  folder: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isVerified: true,
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
    const { fullName, phone } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (fullName !== undefined && !String(fullName).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama tidak boleh kosong",
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName !== undefined && { fullName: String(fullName).trim() }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isVerified: true,
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

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const uploadResult = await uploadBufferToCloudinary(
      file.buffer,
      "smartbiz-ai/avatars"
    );

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: uploadResult.secure_url,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    return res.json({
      success: true,
      message: "Avatar berhasil diupload",
      data: updatedUser,
    });
  } catch (error) {
    console.error("UPLOAD_AVATAR_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};