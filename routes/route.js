const express = require('express')
const router = express.Router()
const { homePageController, login_get, login_post, register_get, register_post, logoutController, cartController, updateCartController, orderNowController, customerOrderListController, customerOrderTrackingCotroller, adminOrdersController, adminOrderStatusChangeController } = require('../app/controllers/allControllers')
const auth = require('../app/middlewares/auth')
const guest = require('../app/middlewares/guest')
const admin = require('../app/middlewares/admin')

router.route('/home').get(homePageController)
router.route('/register').get(guest, register_get).post(register_post)
router.route('/login').get(guest, login_get).post(login_post)
router.route('/logout').get(logoutController)
router.route('/cart').get(cartController)
router.route('/update-cart').post(updateCartController)
router.route('/orders').post(auth, orderNowController)

// Customer routes
router.route('/orders').get(auth,customerOrderListController)
router.route('/orders/:id').get(auth,customerOrderTrackingCotroller)

// Admin routes
router.route('/orders').get(admin, adminOrdersController)
router.route('/orders/status').post(admin,adminOrderStatusChangeController)


module.exports = router;