const { getUser } = require("../service/auth");
const User = require("../model/user");

async function restrictToLoggedInUserOnly(req, res, next) {
  try {
    if (req.isAuthenticated()) {
      return next();
    }

    const token = req.cookies && req.cookies.uid;
    if (!token) return res.redirect("/user/login");

    const payload = getUser(token);
    if (!payload || !payload._id) return res.redirect("/user/login");

    // Fetch full user document from DB so templates and controllers have full data
    const user = await User.findById(payload._id);
    if (!user) return res.redirect("/user/login");

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.redirect('/user/login');
  }
}

module.exports = {
  restrictToLoggedInUserOnly,
};
