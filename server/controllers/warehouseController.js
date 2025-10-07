const mongoose = require('mongoose');
const Warehouse = require('../model/warehouse');
const Product = require('../model/products');
const StockAudit = require('../model/stockAudit');
const { z } = require('zod');

const createWarehouseSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  manager: z.string().optional().nullable(),
  managerEmail: z.string().email('Invalid manager email'),
});

// List warehouses for the current user
async function listWarehouses(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const warehouses = await Warehouse.find({ owner: ownerId }).lean();

    // compute actual product counts per warehouse
    const warehouseIds = warehouses.map(w => w._id);
    const counts = await Product.aggregate([
      { $match: { warehouse: { $in: warehouseIds } } },
      { $group: { _id: '$warehouse', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[String(c._id)] = c.count });

    // attach computed count to each warehouse as productCount
    warehouses.forEach(w => {
      w.productCount = countMap[String(w._id)] || 0;
    });

    return res.render('inventory', { user: req.user, warehouses, errors: null });
  } catch (err) {
    console.error('Error listing warehouses:', err);
    return res.status(500).send('Internal Server Error');
  }
}

//Create a new warehouse for the current user
async function createWarehouse(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const parseResult = createWarehouseSchema.safeParse(req.body);
    if (!parseResult.success) {
      const warehouses = await Warehouse.find({ owner: ownerId }).lean();
      const errors = parseResult.error.errors.map(e => e.message);
      return res.status(400).render('inventory', { user: req.user, warehouses, errors });
    }

  const { location, manager, managerEmail } = parseResult.data;

  await Warehouse.create({ owner: ownerId, location: location.trim(), manager: manager ? manager.trim() : undefined, managerEmail: managerEmail || undefined });
    return res.redirect('/home/inventory');
  } catch (err) {
    console.error('Error creating warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Delete a warehouse owned by the current user
async function deleteWarehouse(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { id } = req.params;
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) return res.status(404).send('Not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');
    // Soft-delete warehouse and its products atomically and record an audit
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // generate a tombstone token to correlate deletes/restores
        const { randomUUID } = require('crypto');
        const token = randomUUID();
        // mark products as deleted and set token
        const now = new Date();
        const updateRes = await Product.updateMany({ warehouse: id, deleted: { $ne: true } }, { $set: { deleted: true, deletedAt: now, deletedToken: token } }).session(session);

        // mark the warehouse as deleted and set the same token
        await Warehouse.updateOne({ _id: id }, { $set: { deleted: true, deletedAt: now, deletedToken: token } }).session(session);

        // record a warehouse deletion audit (include count of products affected and token)
        await StockAudit.create([{
          warehouse: id,
          product: null,
          user: ownerId,
          action: 'warehouse_delete',
          delta: updateRes && updateRes.modifiedCount ? -updateRes.modifiedCount : 0,
          details: { deletedProducts: updateRes && updateRes.modifiedCount ? updateRes.modifiedCount : 0, deletedToken: token }
        }], { session });
      });
      session.endSession();
      return res.redirect('/home/inventory');
    } catch (txErr) {
      session.endSession();
      console.error('Transaction failed while deleting warehouse:', txErr);
      return res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Error deleting warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Update a warehouse (owner-only)
async function updateWarehouse(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) return res.status(404).send('Not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    // Validate using same schema (managerEmail required)
    const parseResult = createWarehouseSchema.safeParse(req.body);
    if (!parseResult.success) {
      const warehouses = await Warehouse.find({ owner: ownerId }).lean();
      const errors = parseResult.error.errors.map(e => e.message);
      return res.status(400).render('inventory', { user: req.user, warehouses, errors });
    }

  const { location, manager, managerEmail } = parseResult.data;

  warehouse.location = location.trim();
  warehouse.manager = manager ? manager.trim() : undefined;
  warehouse.managerEmail = managerEmail;

    await warehouse.save();
    return res.redirect('/home/inventory');
  } catch (err) {
    console.error('Error updating warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Get warehouse detail page

async function getWarehouseDetail(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { id } = req.params;
    const warehouse = await Warehouse.findById(id).lean();
    if (!warehouse) return res.status(404).send('Not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    // fetch products for this warehouse
  const products = await Product.find({ warehouse: id, deleted: { $ne: true } }).lean();

    return res.render('warehouse', { user: req.user, warehouse, products, errors: null });
  } catch (err) {
    console.error('Error fetching warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Restore a soft-deleted warehouse (owner-only)
async function restoreWarehouse(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { id } = req.params;
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) return res.status(404).send('Not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');
    if (!warehouse.deleted) return res.redirect('/home/inventory');
    // Use transactional restore so warehouse and products are updated together
    const session = await mongoose.startSession();
    try {
      let restoredCount = 0;
      await session.withTransaction(async () => {
        // capture the tombstone token before clearing
        const token = warehouse.deletedToken;

        // clear warehouse deleted flags and token
        await Warehouse.updateOne({ _id: id }, { $set: { deleted: false, deletedAt: null, deletedToken: null } }).session(session);

        if (token) {
          const r = await Product.updateMany({ warehouse: id, deleted: true, deletedToken: token }, { $set: { deleted: false, deletedAt: null, deletedToken: null } }).session(session);
          restoredCount = r && (r.modifiedCount || r.nModified || r.modified || 0) ? (r.modifiedCount || r.nModified || r.modified || 0) : 0;
        }

        // write audit for restore
        await StockAudit.create([{ warehouse: id, product: null, user: ownerId, action: 'warehouse_restore', delta: restoredCount, details: { restoredProducts: restoredCount, restoredToken: warehouse.deletedToken } }], { session });
      });
      session.endSession();
      return res.redirect('/home/inventory');
    } catch (txErr) {
      session.endSession();
      console.error('Transaction failed while restoring warehouse:', txErr);
      return res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Error restoring warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Permanently delete a warehouse and associated products/audits (owner-only)
async function permanentDeleteWarehouse(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { id } = req.params;
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) return res.status(404).send('Not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    // Use a transaction to delete warehouse, products, and related audits
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // preserve StockAudit entries for compliance: null the warehouse ref and mark archived
        await StockAudit.updateMany({ warehouse: id }, { $set: { warehouse: null, 'details.archived': true, 'details.originalWarehouse': id } }).session(session);
        // remove products belonging to this warehouse
        await Product.deleteMany({ warehouse: id }).session(session);
        // remove the warehouse itself
        await Warehouse.deleteOne({ _id: id }).session(session);
      });
      session.endSession();
      return res.redirect('/home/inventory');
    } catch (txErr) {
      session.endSession();
      console.error('Transaction failed during permanent delete:', txErr);
      return res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Error permanently deleting warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

module.exports = { listWarehouses, createWarehouse, deleteWarehouse, updateWarehouse, getWarehouseDetail, restoreWarehouse, permanentDeleteWarehouse };


