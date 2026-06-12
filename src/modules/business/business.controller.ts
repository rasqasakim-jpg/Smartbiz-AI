import { Response } from "express";
import prisma from "../../config/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";
import cloudinary from "../../config/cloudinary";
import streamifier from "streamifier"

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

export const createBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, type, phone, address, description } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Nama bisnis wajib diisi",
      });
    }

    const existingBusiness = await prisma.business.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (existingBusiness) {
      return res.status(409).json({
        success: false,
        message: "Kamu sudah memiliki business profile",
      });
    }

    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          name,
          type: type || "OTHER",
          phone,
          address,
          description,
          ownerId: userId,
        },
      });

      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          businessId: createdBusiness.id,
        },
      });

      return createdBusiness;
    });

    return res.status(201).json({
      success: true,
      message: "Business profile berhasil dibuat",
      data: business,
    });
  } catch (error) {
    console.error("CREATE_BUSINESS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getMyBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const business = await prisma.business.findFirst({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { id: userId } } }],
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business profile belum dibuat",
      });
    }

    return res.json({
      success: true,
      message: "Business profile berhasil diambil",
      data: business,
    });
  } catch (error) {
    console.error("GET_MY_BUSINESS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const uploadBusinessLogo = async (
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image wajib diupload",
      });
    }

    const file = req.file;

    const business = await prisma.business.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business profile belum dibuat atau kamu bukan owner",
      });
    }

    const uploadResult = await uploadBufferToCloudinary(
      file.buffer,
      "smartbiz-ai/business-logos"
    );

    const updatedBusiness = await prisma.business.update({
      where: {
        id: business.id,
      },
      data: {
        logoUrl: uploadResult.secure_url,
      },
    });

    return res.json({
      success: true,
      message: "Logo business berhasil diupload",
      data: updatedBusiness,
    });
  } catch (error) {
    console.error("UPLOAD_BUSINESS_LOGO_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateMyBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, type, phone, address, description } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const business = await prisma.business.findUnique({
      where: {
        ownerId: userId,
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business profile belum dibuat atau kamu bukan owner",
      });
    }

    const updatedBusiness = await prisma.business.update({
      where: {
        id: business.id,
      },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(description && { description }),
      },
    });

    return res.json({
      success: true,
      message: "Business profile berhasil diupdate",
      data: updatedBusiness,
    });
  } catch (error) {
    console.error("UPDATE_MY_BUSINESS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};