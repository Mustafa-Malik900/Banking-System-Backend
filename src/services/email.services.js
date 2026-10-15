const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Backend Ledger" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

async function sendRegistrationEmail(useremail, name) {
  const subject = 'Welcome to Backend Ledger!';
  const text = `Hello ${name},\n\nThank you for registering with Backend Ledger. We're excited to have you on board!`;
  const html = `<p>Hello ${name},</p><p>Thank you for registering with <strong>Backend Ledger</strong>. We're excited to have you on board!</p>`;

  await sendEmail(useremail, subject, text, html);
}

async function sendTransactionEmail(useremail, name, transactionDetails) {
  const subject = 'Welcome to Backend Ledger!';
  const text = `Hello ${name},\n\nA transaction has been made on your account. Here are the details:\n\n${transactionDetails}`;
  const html = `<p>Hello ${name},</p><p>A transaction has been made on your account. Here are the details:</p><pre>${transactionDetails}</pre>`;

  await sendEmail(useremail, subject, text, html);
}

async function sendTransactionFailedEmail(useremail, name, transactionDetails) {
  const subject = 'Transaction Failed - Backend Ledger';
  const text = `Hello ${name},\n\nWe regret to inform you that a transaction on your account has failed. Here are the details:\n\n${transactionDetails}`;
  const html = `<p>Hello ${name},</p><p>We regret to inform you that a transaction on your account has failed. Here are the details:</p><pre>${transactionDetails}</pre>`;

  await sendEmail(useremail, subject, text, html);
}

module.exports = { 
  sendRegistrationEmail,
  sendTransactionEmail, 
  sendTransactionFailedEmail 
};
