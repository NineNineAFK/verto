const Warehouse = require('../model/warehouse');
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

    await Warehouse.findByIdAndDelete(id);
    return res.redirect('/home/inventory');
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
const Product = require('../model/products');

async function getWarehouseDetail(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { id } = req.params;
    const warehouse = await Warehouse.findById(id).lean();
    if (!warehouse) return res.status(404).send('Not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    // fetch products for this warehouse
    const products = await Product.find({ warehouse: id }).lean();

    return res.render('warehouse', { user: req.user, warehouse, products, errors: null });
  } catch (err) {
    console.error('Error fetching warehouse:', err);
    return res.status(500).send('Internal Server Error');
  }
}

module.exports = { listWarehouses, createWarehouse, deleteWarehouse, updateWarehouse, getWarehouseDetail };

