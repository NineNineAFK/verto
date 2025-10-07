const express = require('express');
const router = express.Router();

// GET / -> render the public/open home page
router.get('/', (req, res) => {
  // render open home with a flag so partials can adjust links for public view
  return res.render('homeOpen', { openHome: true });
});

module.exports = router;
