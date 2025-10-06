

const User = require("../model/user")
const {getUser, setUser, } = require("../service/auth")
const bcrypt = require('bcrypt');
const {v4: uuidv4} = require("uuid");
const {restrictToLoggedInUserOnly} = require("../middlewares/auth")
const nodemailer = require("nodemailer");

//user signup no hashing here
async function handleUserSignUP(req, res){
  const { name, email, password } = req.body;
  try {
    // Prevent duplicate signup attempts
    const existing = await User.findOne({ email });
    if (existing) {
      // Render signup with a helpful message
      return res.render('signup', { error: 'An account with that email already exists. Please login or reset your password.' });
    }

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;
    await User.create({
      name,
      email,
      password: hashed,
      providers: ['password'],
    });

    // After signup, redirect user to login so they can authenticate.
    return res.redirect('/user/login');
  } catch (err) {
    console.error('Error during signup:', err);
    return res.status(500).render('signup', { error: 'Internal server error' });
  }
}




//user login

async function handleUserlogin(req, res) {
    const { email, password } = req.body;
    try {
    // Find user by email first so we can detect oauth-only accounts
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("login", { error: "Invalid username or password" });
    }

    // If user was created via Google and doesn't have a usable password, instruct them to use Google login
    // In this project some Google-created accounts use a placeholder password ('googlepass') or may not have a set password
    if (user.googleId && (!user.password || user.password === 'googlepass')) {
      return res.render("login", {
        // include a Reset password CTA so the user can set a password
        error: `This account was created with Google. Please use 'Continue with Google' to sign in or <a href="/user/forgot-password">reset your password</a>.`,
      });
    }

        // Validate password with bcrypt
        const ok = await bcrypt.compare(password, user.password || '');
        if (!ok) {
          return res.render("login", { error: "Invalid username or password" });
        }

    const token = setUser(user);
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    };
    res.cookie("uid", token, cookieOpts);
    return res.redirect("/home");
    } catch (error) {
        console.error("Error during user login:", error); // Added error logging
        return res.status(500).json({ message: "Internal server error" });
    }
}


async function handleUserLogout(req, res) {
    res.clearCookie("uid");
    req.logout((err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal server error" });
      }
      res.redirect("/open");
    });
  }



// Forgot password
async function handleForgotPassword(req, res) {
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.render("forgotPassword", {
          message: "Email not found",
        });
      }
  
      const token = uuidv4();
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();
  
      const { sendMail } = require('../service/mailer');

      const mailOptions = {
        to: user.email,
        subject: 'Password Reset',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
          `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
          `http://${req.headers.host}/user/reset-password/${token}\n\n` +
          `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
      };

      await sendMail(mailOptions);
  
      return res.render("forgotPassword", {
        message: "An e-mail has been sent to " + user.email + " with further instructions.",
      });
    } catch (error) {
      console.error("Error during forgot password:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
  
  // Reset password
  async function handleResetPassword(req, res) {
    const { token } = req.params;
    const { password } = req.body;
    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });
  
      if (!user) {
        return res.render("resetPassword", {
          token,
          message: "Password reset token is invalid or has expired.",
        });
      }
  
  user.password = await bcrypt.hash(password, 10);
  // Ensure providers contains 'password' after a successful reset/set
  user.providers = Array.from(new Set([...(user.providers || []), 'password']));
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  
      return res.render("login", {
        message: "Password has been reset. You can now log in with the new password.",
      });
    } catch (error) {
      console.error("Error during reset password:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
  
  // Render user's profile page (protected by middleware)
  function getUserProfile(req, res) {
    const user = req.user;
    if (!user) return res.redirect('/user/login');
    // render a simple profile view
    return res.render('userProfile', { user });
  }

  module.exports = {
    handleUserSignUP,
    handleUserlogin,
    handleUserLogout,
    handleForgotPassword,
    handleResetPassword,
    getUserProfile,
  };