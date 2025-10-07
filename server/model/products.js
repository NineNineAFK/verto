// models/product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, default: 0 },
  stock_quantity: { type: Number, default: 0 },
  low_stock_threshold: { type: Number, default: 0 },
  // soft-delete
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  // tombstone token used to correlate deletes/restores reliably
  deletedToken: { type: String, index: true },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
