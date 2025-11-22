import express from 'express';
import * as nodemailer from 'nodemailer';
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();
const router = express.Router();
const otpStore = {};
// Endpoint to send OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.isVerified) {
        return res.status(400).json({ message: 'User already verified' });
    }
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Store the OTP with the email
    otpStore[email] = otp;
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    const mailOptions = {
        from: `"Foodzy" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}`,
        html: `<b>Your OTP code is ${otp}</b>`,
    };
    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully' });
    }
    catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});
// Endpoint to verify OTP
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }
    if (otpStore[email] === otp) {
        delete otpStore[email]; // OTP is used, so remove it
        await prisma.user.upsert({
            where: { email },
            update: { isVerified: true },
            create: { email, isVerified: true },
        });
        res.status(200).json({ message: 'OTP verified successfully' });
    }
    else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});
// Endpoint to create a new order
router.post('/create-order', async (req, res) => {
    const { items, address, paymentOption, deliveryMethod, billingDetails, userId } = req.body;
    if (!items || !address || !paymentOption || !deliveryMethod || !billingDetails || !userId) {
        return res.status(400).json({ message: 'Missing required order details' });
    }
    try {
        const order = await prisma.order.create({
            data: {
                items,
                address,
                paymentOption,
                deliveryMethod,
                billingDetails,
                userId,
            },
        });
        res.status(201).json(order);
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order' });
    }
});
export default router;
//# sourceMappingURL=authRoutes.js.map