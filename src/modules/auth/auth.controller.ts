import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../../config/prisma";
import { transporter } from "../../config/mailer";

export const register = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "fullName, email, dan password wajib diisi",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email sudah terdaftar",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        isVerified: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    const otpCode = generateOtp();

    await prisma.otp.create({
      data: {
        code: otpCode,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await sendOtpEmail(email, otpCode);

    return res.status(201).json({
      success: true,
      message: "Register berhasil. Silakan cek email untuk OTP.",
      data: user,
    });
  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOtpEmail = async (email: string, code: string) => {
  await transporter.sendMail({
    from: `"SmartBiz AI"<${process.env.EMAIL_USER}>`,
    to: email,
    subject: "SmartBiz AI - Kode OTP",
    html: `
      <h2>SmartBiz AI Verification</h2>
      <p>Kode OTP kamu:</p>
      <h1>${code}</h1>
      <p>Kode ini berlaku selama 10 menit.</p>
    `,
  });
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email dan kode OTP wajib diisi",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const otp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        code,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP tidak valid atau expired",
      });
    }

    await prisma.$transaction([
      prisma.otp.update({
        where: { id: otp.id },
        data: { isUsed: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
    ]);

    return res.json({
      success: true,
      message: "Verifikasi OTP berhasil. Akun sudah aktif.",
    });
  } catch (error) {
    console.error("VERIFY_OTP_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email wajib diisi",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Akun sudah terverifikasi",
      });
    }

    await prisma.otp.updateMany({
      where: {
        userId: user.id,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    const otpCode = generateOtp();

    await prisma.otp.create({
      data: {
        code: otpCode,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await sendOtpEmail(email, otpCode);

    return res.json({
      success: true,
      message: "OTP baru berhasil dikirim ke email",
    });
  } catch (error) {
    console.error("RESEND_OTP_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah",
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah",
      });
    }

    if (!user.isVerified) {
        return res.status(403).json({
            success: false,
            message: "akun belum di verifikasi. silahkan cek otp email"
        })
    }

    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: "JWT secret belum dikonfigurasi",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: jwtExpiresIn,
      }
    );

    return res.json({
      success: true,
      message: "Login berhasil",
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("LOGIN_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
