const User = require('../model/user');
const Product = require('../model/products');

// Get current user's cart
async function getCart(req, res) {
  try {
    const user = await User.findById(req.user._id).populate({ path: 'cart.product', model: 'Product', populate: { path: 'warehouse', model: 'Warehouse' } }).lean();
    return res.json(user.cart || []);
  } catch (err) {
    console.error('Error fetching cart:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Add product to cart (or increase qty)
async function addToCart(req, res) {
  try {
    const userId = req.user._id;
    const { productId, qty } = req.body;
    const q = Math.max(1, parseInt(qty || 1, 10));

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.deleted) return res.status(400).json({ error: 'Product not available' });

    // enforce stock limit
    if (q > (product.stock_quantity || 0)) {
      return res.status(400).json({ error: 'Requested quantity exceeds available stock', available: product.stock_quantity || 0 });
    }

    const user = await User.findById(userId);
    const existing = user.cart.find(c => String(c.product) === String(productId));
    if (existing) {
      existing.qty = Math.min((product.stock_quantity || 0), existing.qty + q);
      existing.addedAt = new Date();
    } else {
      user.cart.push({ product: productId, qty: q });
    }

    await user.save();
    return res.json({ success: true, cart: user.cart });
  } catch (err) {
    console.error('Error adding to cart:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update a cart item's quantity
async function updateCartItem(req, res) {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { qty } = req.body;
    const q = Math.max(0, parseInt(qty || 0, 10));

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const user = await User.findById(userId);
    const item = user.cart.find(c => String(c.product) === String(productId));
    if (!item) return res.status(404).json({ error: 'Cart item not found' });

    if (q === 0) {
      // remove item
      user.cart = user.cart.filter(c => String(c.product) !== String(productId));
    } else {
      if (q > (product.stock_quantity || 0)) {
        return res.status(400).json({ error: 'Requested quantity exceeds available stock', available: product.stock_quantity || 0 });
      }
      item.qty = q;
    }

    await user.save();
    return res.json({ success: true, cart: user.cart });
  } catch (err) {
    console.error('Error updating cart item:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Remove an item from cart
async function removeCartItem(req, res) {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const user = await User.findById(userId);
    user.cart = user.cart.filter(c => String(c.product) !== String(productId));
    await user.save();
    return res.json({ success: true, cart: user.cart });
  } catch (err) {
    console.error('Error removing cart item:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getCart, addToCart, updateCartItem, removeCartItem };
