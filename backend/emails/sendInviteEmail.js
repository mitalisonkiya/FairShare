const nodemailer = require("nodemailer");
const inviteTemplate = require("./inviteTemplate");

async function sendInviteEmail(toEmail, inviterName, groupName, inviteLink) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "mitalisonkiya2005@gmail.com",
      pass: "vyye eqzn unqu jden"
    }
  });

  const htmlContent = inviteTemplate(inviterName, groupName, inviteLink);
const inviteLink = `https://your-domain.com/join/${joinCode}`;

  await transporter.sendMail({
    from: `"FairShare" <mitalisonkiya2005@gmail.com>`,
    to: toEmail,
    subject: `${inviterName} invited you to join ${groupName}`,
    html: htmlContent
  });

  console.log("Invite email sent successfully!");
}

module.exports = sendInviteEmail;
