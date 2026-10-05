const nodemailer = require("nodemailer");
require("dotenv").config();

function getTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

exports.sendEmailInvite = async (email, link) => {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn("Email transporter not configured. Skipping email send.");
        return false;
    }

    const htmlTemplate = `
    <h2>You are invited to join a FairShare group!</h2>
    <p>Click the link below to join:</p>
    <a href="${link}" style="padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:5px;">Join Group</a>
    `;

    try {
        await transporter.sendMail({
            from: `"FairShare" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "FairShare Group Invite",
            html: htmlTemplate
        });
        return true;
    } catch (e) {
        return false;
    }
};
