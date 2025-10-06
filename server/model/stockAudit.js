
const mongoose = require('mongoose');

const StockAuditSchema = new mongoose.Schema({
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // action: create | increase | decrease | delete | edit
  action: { type: String, required: true, enum: ['create', 'increase', 'decrease', 'delete', 'edit'] },
  // optional numeric delta for stock changes
  delta: { type: Number },
  // flexible details object to store previous/new values or full product snapshot
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('StockAudit', StockAuditSchema);
