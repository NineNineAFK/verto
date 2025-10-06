const flash = require('connect-flash');

// Export a function that wires up flash to an Express app instance
module.exports = function setupFlash(app) {
  app.use(flash());
  app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
  });
};
