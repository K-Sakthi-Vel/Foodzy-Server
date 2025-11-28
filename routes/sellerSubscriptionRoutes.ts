import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other services like 'Outlook365', 'SendGrid', etc.
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

router.post('/subscribe-seller', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Send confirmation email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Subscription Confirmation - Nest Mart Seller Updates',
      html: `
        <p>Thank you for subscribing to Nest Mart seller updates!</p>
        <p>You will now receive important information and updates related to selling on Nest Mart.</p>
        <p>If you did not subscribe, please ignore this email.</p>
      `,
    });

    res.status(200).json({ message: 'Subscription successful!' });
  } catch (error) {
    console.error('Error subscribing to Nest Mart seller:', error);
    res.status(500).json({ message: 'Failed to subscribe to Nest Mart seller. Please try again later.' });
  }
});

export default router;
