const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: { type: String, required: true },
  manager: { type: String, required: true },
  managerEmail: { type: String, required: true },
  // productCount is computed dynamically from Product documents; do not persist here
}, { timestamps: true });

const Warehouse = mongoose.model('Warehouse', warehouseSchema);

module.exports = Warehouse;
