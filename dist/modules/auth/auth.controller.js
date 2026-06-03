"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const register = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "fullName, email, dan password wajib diisi",
            });
        }
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email sudah terdaftar",
            });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                fullName,
                email,
                password: hashedPassword,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Register berhasil",
            data: user,
        });
    }
    catch (error) {
        console.error("REGISTER_ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email dan password wajib diisi",
            });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Email atau password salah",
            });
        }
        const isPasswordMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: "Email atau password salah",
            });
        }
        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || "7d");
        if (!jwtSecret) {
            return res.status(500).json({
                success: false,
                message: "JWT secret belum dikonfigurasi",
            });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role,
        }, jwtSecret, {
            expiresIn: jwtExpiresIn,
        });
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
    }
    catch (error) {
        console.error("LOGIN_ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.login = login;
