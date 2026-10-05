require("dotenv").config();
const nodemailer = require("nodemailer");

async function sendTest() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("Email credentials not configured in environment.");
        return;
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: "FairShare Email Configuration Test",
            text: "Testing email sending configuration from Node.js"
        });
        console.log("Test email sent successfully.");
    } catch (err) {
        console.error("Email send test failed.");
    }
}

if (require.main === module) {
    sendTest();
}
