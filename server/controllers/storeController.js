const Product = require('../model/products');
const Warehouse = require('../model/warehouse');

// Return products not owned by current user. If req.query.low is truthy, filter to low stock only.
async function getStore(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const myWarehouses = await Warehouse.find({ owner: ownerId }).select('_id').lean();
    const myIds = myWarehouses.map(w => w._id);

    // Build a proper DB query; if low filter requested, add $expr to compare stock_quantity and low_stock_threshold
    const match = { warehouse: { $nin: myIds } };
    if (req.query.low === '1') {
      match.$expr = { $lte: ['$stock_quantity', '$low_stock_threshold'] };
    }

    const productsQuery = Product.find(match)
      .populate({ path: 'warehouse', select: 'location owner', populate: { path: 'owner', model: 'User', select: 'name' } });

    const products = await productsQuery.lean();

    if (req.query.format === 'json') {
      return res.json(products);
    }

    // render view
    return res.render('store', { user: req.user, products });
  } catch (err) {
    console.error('Error in store controller:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = { getStore };
