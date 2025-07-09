const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  const [products] = await db.query('SELECT * FROM products');
  res.render('index', { products, user: req.user });
});

module.exports = router;