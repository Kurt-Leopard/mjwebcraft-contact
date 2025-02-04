import express from "express";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cors from "cors";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL = process.env.EMAIL;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function reAuthenticate() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
  });
  console.log("Please re-authenticate by visiting this URL:", authUrl);
}

const rateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: "You have exceeded the 5 requests per day limit.",
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/send-email", rateLimiter);

async function sendMail(name, email, message) {
  try {
    const accessToken = await oAuth2Client.getAccessToken();
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    const mailOptions = {
      from: `MJ WEBCRAFT <${EMAIL}>`,
      to: "markangeloujamandre@gmail.com",
      subject: `New message from ${name}`,
      text: `You have received a new message from ${name} (${email}):\n\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 4px;">
            <h2 style="margin-bottom: 20px;">You have received a new message:</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
            <p style="font-size: 14px; color: #777; text-align: center; margin-top: 20px;">
                Best regards,<br>
                MJ WEB CARFT
            </p>
          </div>
        </div>
      `,
    };

    const result = await transport.sendMail(mailOptions);
    return result;
  } catch (error) {
    if (
      error.response &&
      error.response.status === "400" &&
      error.response.data.error === "invalid_grant"
    ) {
      await reAuthenticate();
    }
    throw error;
  }
}

app.post("/send-email", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: "Please provide name, email, and message." });
  }

  try {
    const result = await sendMail(name, email, message);
    return res
      .status(200)
      .json({ message: "Email sent successfully!", result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Failed to send email", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
