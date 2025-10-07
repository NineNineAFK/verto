const express = require("express");
const { handleUserSignUP, 
    handleUserlogin, 
    handleUserLogout, 
    handleForgotPassword, 
    handleResetPassword } = require("../controllers/user");
const router = express.Router();
const { restrictToLoggedInUserOnly } = require('../middlewares/auth');
const { getUserProfile } = require('../controllers/user');

router.post("/",);

router.get("/signup", (req, res) => {
    res.render("signup", { openHome: true });
});

router.post("/signup", handleUserSignUP);
router.post("/login", handleUserlogin);
router.get("/login", (req, res) => {
    // Pass any query messages (from redirects) or flash-like params into the view
    res.render("login", { message: req.query.message, error: req.query.error, openHome: true });
});

// Logout route
router.post("/logout", handleUserLogout);
router.get("/logout", handleUserLogout);

// Forgot password routes
router.get("/forgot-password", (req, res) => {
    res.render("forgotPassword");
});
router.post("/forgot-password", handleForgotPassword);

// Reset password routes
router.get("/reset-password/:token", (req, res) => {
    res.render("resetPassword", { token: req.params.token });
});
router.post("/reset-password/:token", handleResetPassword);

// User profile (protected)
router.get('/profile', restrictToLoggedInUserOnly, getUserProfile);

module.exports = router;
