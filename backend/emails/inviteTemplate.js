module.exports = function inviteTemplate(inviterName, groupName, inviteLink) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FairShare Invitation</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: Arial, Helvetica, sans-serif; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff;border-radius: 8px;overflow: hidden;box-shadow: 0 4px 12px rgba(0,0,0,0.1);}
    .header { background: #4f46e5;padding: 20px;text-align: center;color: #ffffff;}
    .header h1 { margin: 0;font-size: 28px;}
    .content { padding: 25px 30px;color: #333;line-height: 1.8;font-size: 16px;}
    .btn { display: inline-block;background: #4f46e5;color: #fff !important;padding: 12px 20px;border-radius: 6px;margin-top: 20px;text-decoration: none;font-weight: bold;}
    .footer { padding: 18px;text-align: center;background: #eee;font-size: 13px;color: #777;}
  </style>
  </head>

  <body>
    <div class="container">
      <div class="header">
        <h1>You're Invited!</h1>
        <p>Join a FairShare Group</p>
      </div>

      <div class="content">
        <p>Hi there,</p>

        <p><b>${inviterName}</b> has invited you to join the group:
        <b style="color:#4f46e5">${groupName}</b> on <b>FairShare</b>.</p>

        <p>FairShare helps you split expenses easily for trips, college, rent, food, and more.</p>

        <p>Click the button below to accept the invitation:</p>

        <a href="${inviteLink}" class="btn">Join Group</a>

        <p>If the button doesn't work, copy this link:</p>
        <p style="background:#f0f0f0; padding:10px; border-radius:6px;">
          ${inviteLink}
        </p>

        <p>Looking forward to seeing you in the group! 🎉</p>
      </div>

      <div class="footer">
        FairShare — Split Smarter, Live Better<br>
        This is an automated message. Please do not reply.
      </div>
    </div>
  </body>
  </html>
  `;
};
