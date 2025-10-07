const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { BASE_URL, getToken } = require('../service/phonepeClient');
const Cart = require('../model/cart');
const User = require('../model/user');
const Order = require('../model/order');
const Product = require('../model/products');

// Initiate Payment
async function initiatePayment(req, res) {
  try {
    const { merchantOrderId: providedMerchantOrderId } = req.body;
    let { userId } = req.body;

    if (!userId && req.user) userId = req.user._id;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    let cart = await Cart.findOne({ userId }).populate('items.product');

    // fallback to User.cart if no Cart doc exists
    if ((!cart || !cart.items || !cart.items.length) && req.user) {
      const user = await User.findById(userId).populate({ path: 'cart.product', model: 'Product' });
      if (user && user.cart && user.cart.length) {
        const items = user.cart.map(i => ({ product: i.product, qty: i.qty }));
        const totalAmount = items.reduce((s, it) => s + ((it.product && it.product.price) ? (it.product.price * (it.qty||0)) : 0), 0);
        cart = { items: items.map(it=>({ product: it.product, qty: it.qty })), totalAmount };
      }
    }

    if (!cart || !cart.items || !cart.items.length || (typeof cart.totalAmount === 'number' && cart.totalAmount <= 0)) {
      return res.status(400).json({ success: false, message: 'Cart is empty or total amount is invalid' });
    }

    const amountPaise = Math.round(cart.totalAmount * 100);
    const merchantOrderId = providedMerchantOrderId || `ORDER_${uuidv4()}`;

    const orderData = {
      userId,
      items: cart.items.map(i=>({ product: i.product._id, qty: i.qty, price: i.product.price })),
      totalAmount: cart.totalAmount,
      paymentDetails: { merchantTransactionId: merchantOrderId, status: 'pending', amount: cart.totalAmount, paymentMethod: 'PhonePe' },
      paymentStatus: 'pending'
    };

    const order = new Order(orderData);
    await order.save();

    const accessToken = await getToken();

    const paymentPayload = {
      merchantOrderId,
      amount: amountPaise,
      paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: `${process.env.MERCHANT_REDIRECT_URL}?merchantOrderId=${merchantOrderId}` } }
    };

    const payRes = await axios.post(`${BASE_URL}/checkout/v2/pay`, paymentPayload, { headers: { 'Content-Type':'application/json', 'Authorization': `O-Bearer ${accessToken}` } });

    return res.json(payRes.data);
  } catch (error) {
    console.error('Payment API error:', error.response?.data || error.message);
    return res.status(400).json({ error: 'Payment initiation failed', details: error.response?.data || error.message });
  }
}

// Handle redirect: sync order state, update DB, decrement stock on success
async function paymentRedirect(req, res) {
  try {
    const { merchantOrderId } = req.query;
    if (!merchantOrderId) return res.status(400).send('Missing merchantOrderId');

    const accessToken = await getToken();
    const { data: statusData } = await axios.get(`${BASE_URL}/checkout/v2/order/${merchantOrderId}/status`, { headers: { 'Content-Type':'application/json', 'Authorization': `O-Bearer ${accessToken}` } });

    const phonepeState = statusData.state; // COMPLETED | FAILED | PENDING
    const mapped = phonepeState === 'COMPLETED' ? 'completed' : phonepeState === 'FAILED' ? 'failed' : 'pending';

    const order = await Order.findOne({ 'paymentDetails.merchantTransactionId': merchantOrderId });
    if (order) {
      order.paymentDetails.status = mapped;
      order.paymentStatus = mapped;
      order.paymentDetails.transactionId = statusData?.paymentDetails?.[0]?.transactionId || order.paymentDetails.transactionId;
      order.paymentDetails.paymentTimestamp = statusData?.paymentDetails?.[0]?.timestamp ? new Date(statusData.paymentDetails[0].timestamp) : order.paymentDetails.paymentTimestamp;
      await order.save();

      if (mapped === 'completed') {
        // decrement stock atomically for each product
        const mongoose = require('mongoose');
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async ()=>{
            for (const it of order.items) {
              await Product.updateOne({ _id: it.product }, { $inc: { stock_quantity: -Math.max(0, it.qty) } }).session(session);
            }
            // clear cart collection and also clear User.cart for compatibility
            await Cart.deleteOne({ userId: order.userId }).session(session);
            await User.updateOne({ _id: order.userId }, { $set: { cart: [] } }).session(session);
          });
        } finally { session.endSession(); }
      }
    }

    const target = `${process.env.CLIENT_URL || ''}/payment/status?merchantOrderId=${encodeURIComponent(merchantOrderId)}`;
    return res.redirect(302, target);
  } catch (error) {
    console.error('Redirect sync error:', error.response?.data || error.message);
    const fallback = `${process.env.CLIENT_URL || ''}/payment/status?merchantOrderId=${encodeURIComponent(req.query.merchantOrderId || '')}&err=1`;
    return res.redirect(302, fallback);
  }
}

// Render a simple status page (client was redirected here after payment)
async function getPaymentStatus(req, res) {
  try {
    const { merchantOrderId } = req.query;
    let order = null;
    if (merchantOrderId) order = await Order.findOne({ 'paymentDetails.merchantTransactionId': merchantOrderId }).lean();
    return res.render('paymentStatus', { order, merchantOrderId });
  } catch (err) {
    console.error('Error rendering payment status:', err.message);
    return res.status(500).send('Internal Server Error');
  }
}

module.exports = { initiatePayment, paymentRedirect, getPaymentStatus };

