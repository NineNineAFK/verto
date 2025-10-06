const nodemailer = require('nodemailer');

function createTransporter() {
  const service = process.env.MAIL_SERVICE || 'Gmail';
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!user || !pass) {
    console.warn('Mailer credentials not configured (MAIL_USER / MAIL_PASS). Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport({
    service,
    auth: { user, pass },
  });
}

const transporter = createTransporter();

async function sendMail(options = {}) {
  if (!transporter) {
    console.warn('sendMail called but transporter is not configured. Options:', options);
    return false;
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    ...options,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };
