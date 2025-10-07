const express = require("express")
const {handleUserSignUP, handleUserlogin,} = require("../controllers/user")
const router= express.Router()
const Product = require("../model/products");
const Warehouse = require("../model/warehouse");
const { listWarehouses, createWarehouse, deleteWarehouse, getWarehouseDetail } = require('../controllers/warehouseController');
const { createProduct, increaseStock, decreaseStock, getLowStockProducts, getAuditForWarehouse } = require('../controllers/productController');

router.get("/", (req, res)=>{
  // Pass the authenticated user (if any) to the template so EJS can conditionally render nav items
  res.render("home", { user: req.user });
})


  // Inventory routes (list/create/delete warehouses)
  router.get('/inventory', listWarehouses);
  // Warehouse detail route must come before parameterized POST routes
  router.get('/inventory/:id', getWarehouseDetail);
  router.post('/inventory/add', createWarehouse);
  router.post('/inventory/:id/delete', deleteWarehouse);
  router.post('/inventory/:id/edit', require('../controllers/warehouseController').updateWarehouse);
  router.post('/inventory/:id/restore', require('../controllers/warehouseController').restoreWarehouse);
  router.post('/inventory/:id/permanent-delete', require('../controllers/warehouseController').permanentDeleteWarehouse);

  // Product routes within a warehouse
  router.post('/inventory/:warehouseId/products/add', createProduct);
  router.post('/inventory/:warehouseId/products/:productId/increase', increaseStock);
  router.post('/inventory/:warehouseId/products/:productId/decrease', decreaseStock);
  router.post('/inventory/:warehouseId/products/:productId/delete', require('../controllers/productController').deleteProduct);

  // Low-stock products (JSON) for a warehouse
  router.get('/inventory/:warehouseId/products/low', getLowStockProducts);

  // Store route: show products that are NOT owned by the current user
  const { getStore } = require('../controllers/storeController');
  router.get('/store', getStore);
    // Cart endpoints (user must be authenticated via /home route middleware)
    const { getCart, addToCart, updateCartItem, removeCartItem } = require('../controllers/cartController');
    router.get('/cart', async (req, res, next) => {
      // If client expects JSON (fetch from JS), return JSON via controller
      if (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1) return getCart(req, res, next);
      // Otherwise render the cart page
      return res.render('cart', { user: req.user });
    });
    router.post('/cart/add', addToCart);
    router.post('/cart/:productId', updateCartItem);
    router.delete('/cart/:productId', removeCartItem);

  // Audit trail (owner-only)
  router.get('/inventory/:warehouseId/audit', getAuditForWarehouse);




module.exports = router;