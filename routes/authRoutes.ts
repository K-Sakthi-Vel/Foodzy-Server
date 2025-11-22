import express from 'express';
import * as nodemailer from 'nodemailer';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();
const router = express.Router();

const otpStore: { [email: string]: string } = {};

// Endpoint to send OTP
router.post('/send-otp', async (req: express.Request, res: express.Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.isVerified) {
    // If user is already verified, return their details and mark as already verified
    return res.status(200).json({
      message: 'User already verified. No OTP sent.',
      user: { id: user.id, email: user.email },
      otpSent: false, // Indicate that OTP was not sent
      otpVerified: true, // Indicate that the user is verified
    });
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
    res.status(200).json({ message: 'OTP sent successfully', otpSent: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// Endpoint to verify OTP
router.post('/verify-otp', async (req: express.Request, res: express.Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  if (otpStore[email] === otp) {
    delete otpStore[email]; // OTP is used, so remove it

    const user = await prisma.user.upsert({
      where: { email },
      update: { isVerified: true },
      create: { email, isVerified: true },
    });

    res.status(200).json({ message: 'OTP verified successfully', user: { id: user.id, email: user.email } });
  } else {
    res.status(400).json({ message: 'Invalid OTP' });
  }
});

// Endpoint to create a new order
router.post('/create-order', async (req: express.Request, res: express.Response) => {
  const { items, address, paymentOption, deliveryMethod, billingDetails, userId, totalAmount, deliveryFee } = req.body;

  if (!items || !address || !paymentOption || !deliveryMethod || !billingDetails || !userId || totalAmount === undefined || deliveryFee === undefined) {
    return res.status(400).json({ message: 'Missing required order details' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isVerified) {
      return res.status(403).json({ message: 'User email not verified. Please verify your email before placing an order.' });
    }

    const order = await prisma.order.create({
      data: {
        items: items as any, // Prisma expects Json, client sends array of objects
        address,
        paymentOption,
        deliveryMethod,
        billingDetails: billingDetails as any, // Prisma expects Json
        userId,
        totalAmount,
        deliveryFee,
      },
    });

    // Send order confirmation email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const productsHtml = items.map((item: any) => `
      <li>
        ${item.name} (x${item.qty}) - $${item.price.toFixed(2)} each
      </li>
    `).join('');

    const mailOptions = {
      from: `"Foodzy Order" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Your Foodzy Order Confirmation - #${order.id}`,
      html: `
        <h1>Order Confirmation</h1>
        <p>Dear ${billingDetails.firstName} ${billingDetails.lastName},</p>
        <p>Thank you for your order! Your order #${order.id} has been placed successfully.</p>
        <h2>Order Details:</h2>
        <ul>
          ${productsHtml}
        </ul>
        <p><strong>Sub-Total:</strong> $${(totalAmount - deliveryFee).toFixed(2)}</p>
        <p><strong>Delivery Fee:</strong> $${deliveryFee.toFixed(2)}</p>
        <p><strong>Total Payable:</strong> $${totalAmount.toFixed(2)}</p>
        <h2>Billing Details:</h2>
        <p>Name: ${billingDetails.firstName} ${billingDetails.lastName}</p>
        <p>Address: ${billingDetails.address}, ${billingDetails.city}, ${billingDetails.regionState}, ${billingDetails.postCode}, ${billingDetails.country}</p>
        <p>Email: ${user.email}</p>
        <p>Delivery Method: ${deliveryMethod}</p>
        <p>Payment Option: ${paymentOption}</p>
        <p>We will send you another email once your order has been shipped.</p>
        <p>Thanks for shopping with Foodzy!</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order or sending email:', error);
    res.status(500).json({ message: 'Failed to create order or send confirmation email' });
  }
});

export default router;
