const Product = require('../model/products');
const Warehouse = require('../model/warehouse');
const { z } = require('zod');
const mongoose = require('mongoose');
const StockAudit = require('../model/stockAudit');

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().or(z.literal('')),
  price: z.preprocess((v) => Number(v), z.number().nonnegative()).optional(),
  stock_quantity: z.preprocess((v) => Number(v), z.number().int().nonnegative()).optional(),
  low_stock_threshold: z.preprocess((v) => Number(v), z.number().int().nonnegative()).optional(),
});

async function createProduct(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { warehouseId } = req.params;
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).send('Warehouse not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    const parse = createProductSchema.safeParse(req.body);
    if (!parse.success) {
      const errors = parse.error.errors.map(e => e.message);
      return res.status(400).send({ errors });
    }

    const data = parse.data;
    // Use a transaction so product creation and its audit are atomic
    const session = await mongoose.startSession();
    try {
      let createdProduct;
      await session.withTransaction(async () => {
        createdProduct = await Product.create([
          {
            warehouse: warehouseId,
            name: data.name,
            description: data.description || '',
            price: data.price || 0,
            stock_quantity: data.stock_quantity || 0,
            low_stock_threshold: data.low_stock_threshold || 0,
          }
        ], { session });

        // createdProduct is an array result from Model.create when using array
        const prod = createdProduct[0];

        await StockAudit.create([
          {
            warehouse: warehouseId,
            product: prod._id,
            user: ownerId,
            action: 'create',
            delta: Number(prod.stock_quantity) || 0,
            details: { productSnapshot: prod }
          }
        ], { session });
      });
      session.endSession();
    } catch (txErr) {
      session.endSession();
      console.error('Transaction failed for createProduct:', txErr);
      return res.status(500).send('Internal Server Error');
    }

  // productCount is computed dynamically; no persistent counter update required

    return res.redirect(`/home/inventory/${warehouseId}`);
  } catch (err) {
    console.error('Error creating product:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Increase stock
async function increaseStock(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { warehouseId, productId } = req.params;
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).send('Warehouse not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    const { amount } = req.body;
    const inc = Math.max(1, Number(amount) || 1);
    const product = await Product.findOne({ _id: productId, warehouse: warehouseId });
    if (!product) return res.status(404).send('Product not found');

    // Use a transaction for atomic update + audit
    const sessionInc = await mongoose.startSession();
    try {
      await sessionInc.withTransaction(async () => {
        const prodDoc = await Product.findOne({ _id: productId, warehouse: warehouseId }).session(sessionInc);
        if (!prodDoc) throw Object.assign(new Error('Product not found'), { status: 404 });
        prodDoc.stock_quantity = (prodDoc.stock_quantity || 0) + inc;
        await prodDoc.save({ session: sessionInc });

        await StockAudit.create([
          {
            warehouse: warehouseId,
            product: prodDoc._id,
            user: ownerId,
            action: 'increase',
            delta: inc,
            details: { newStock: prodDoc.stock_quantity }
          }
        ], { session: sessionInc });
      });
      sessionInc.endSession();
      return res.redirect(`/home/inventory/${warehouseId}`);
    } catch (txErr) {
      sessionInc.endSession();
      if (txErr && txErr.status === 404) return res.status(404).send('Product not found');
      console.error('Transaction failed for increaseStock:', txErr);
      return res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Error increasing stock:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Decrease stock
async function decreaseStock(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { warehouseId, productId } = req.params;
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).send('Warehouse not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    const { amount } = req.body;
    const dec = Math.max(1, Number(amount) || 1);
    const product = await Product.findOne({ _id: productId, warehouse: warehouseId });
    if (!product) return res.status(404).send('Product not found');

    if ((product.stock_quantity || 0) < dec) {
      return res.status(400).send({ error: 'Insufficient stock' });
    }

    // Use transaction to ensure stock change and audit are atomic
    const sessionDec = await mongoose.startSession();
    try {
      await sessionDec.withTransaction(async () => {
        const prodDoc = await Product.findOne({ _id: productId, warehouse: warehouseId }).session(sessionDec);
        if (!prodDoc) throw Object.assign(new Error('Product not found'), { status: 404 });
        if ((prodDoc.stock_quantity || 0) < dec) throw Object.assign(new Error('Insufficient stock'), { status: 400 });

        prodDoc.stock_quantity = (prodDoc.stock_quantity || 0) - dec;
        await prodDoc.save({ session: sessionDec });

        await StockAudit.create([
          {
            warehouse: warehouseId,
            product: prodDoc._id,
            user: ownerId,
            action: 'decrease',
            delta: -dec,
            details: { newStock: prodDoc.stock_quantity }
          }
        ], { session: sessionDec });
      });
      sessionDec.endSession();
      return res.redirect(`/home/inventory/${warehouseId}`);
    } catch (txErr) {
      sessionDec.endSession();
      if (txErr && txErr.status === 400) return res.status(400).send({ error: 'Insufficient stock' });
      if (txErr && txErr.status === 404) return res.status(404).send('Product not found');
      console.error('Transaction failed for decreaseStock:', txErr);
      return res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Error decreasing stock:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Delete a product
async function deleteProduct(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { warehouseId, productId } = req.params;
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).send('Warehouse not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    const product = await Product.findOne({ _id: productId, warehouse: warehouseId });
    if (!product) return res.status(404).send('Product not found');

    // Use transaction to delete product and record audit atomically
    const sessionDel = await mongoose.startSession();
    try {
      await sessionDel.withTransaction(async () => {
        // re-load product in session to ensure consistency
        const prodDoc = await Product.findOne({ _id: productId, warehouse: warehouseId }).session(sessionDel);
        if (!prodDoc) throw Object.assign(new Error('Product not found'), { status: 404 });

        await Product.deleteOne({ _id: productId }).session(sessionDel);

        await StockAudit.create([
          {
            warehouse: warehouseId,
            product: prodDoc._id,
            user: ownerId,
            action: 'delete',
            delta: -(prodDoc.stock_quantity || 0),
            details: { deletedSnapshot: prodDoc }
          }
        ], { session: sessionDel });
      });
      sessionDel.endSession();
      return res.redirect(`/home/inventory/${warehouseId}`);
    } catch (txErr) {
      sessionDel.endSession();
      if (txErr && txErr.status === 404) return res.status(404).send('Product not found');
      console.error('Transaction failed for deleteProduct:', txErr);
      return res.status(500).send('Internal Server Error');
    }
  // productCount is computed dynamically; no persistent counter update required

  return res.redirect(`/home/inventory/${warehouseId}`);
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Get products in a warehouse with stock_quantity <= low_stock_threshold
async function getLowStockProducts(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { warehouseId } = req.params;
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).send('Warehouse not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    // Find products where stock_quantity <= low_stock_threshold
    const products = await Product.find({
      warehouse: warehouseId,
      $expr: { $lte: ['$stock_quantity', '$low_stock_threshold'] }
    }).lean();

    // Render each product through the productCard partial and return an HTML fragment
    const ejs = require('ejs');
    const path = require('path');
    const partialPath = path.resolve(__dirname, '..', 'views', 'partials', 'productCard.ejs');

    const fragments = await Promise.all(products.map(p => {
      return ejs.renderFile(partialPath, { product: p });
    }));

    return res.send(fragments.join('\n'));
  } catch (err) {
    console.error('Error fetching low-stock products:', err);
    return res.status(500).send('Internal Server Error');
  }
}

// Get recent audit events for a warehouse (owner-only)
async function getAuditForWarehouse(req, res) {
  try {
    const ownerId = req.user && req.user._id;
    const { warehouseId } = req.params;
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return res.status(404).send('Warehouse not found');
    if (String(warehouse.owner) !== String(ownerId)) return res.status(403).send('Forbidden');

    const audits = await StockAudit.find({ warehouse: warehouseId }).populate('product user').sort({ createdAt: -1 }).limit(200).lean();

    // if fragment param present, return HTML fragment rendered by partial
    if (req.query.fragment === '1') {
      const ejs = require('ejs');
      const path = require('path');
      const partialPath = path.resolve(__dirname, '..', 'views', 'partials', 'auditList.ejs');
      const html = await ejs.renderFile(partialPath, { audits });
      return res.send(html);
    }

    return res.render('audit', { user: req.user, warehouse, audits });
  } catch (err) {
    console.error('Error fetching audits:', err);
    return res.status(500).send('Internal Server Error');
  }
}

module.exports = { createProduct, increaseStock, decreaseStock, deleteProduct, getLowStockProducts, getAuditForWarehouse };


