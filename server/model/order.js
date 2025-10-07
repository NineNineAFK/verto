const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      qty: Number,
      price: Number,
    }
  ],
  totalAmount: Number,
  paymentDetails: {
    merchantTransactionId: String,
    transactionId: String,
    status: { type: String, enum: ['pending','completed','failed'], default: 'pending' },
    paymentMethod: String,
    paymentTimestamp: Date,
    errorMessage: String
  },
  paymentStatus: { type: String, enum: ['pending','completed','failed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
