const User = require('../models/user')
const bcrypt= require('bcrypt')
const passport = require('passport')

// *** Home page  ***//
const homePageController = async (req, res) => {
    // const pizzas = await Menu.find()
    // return res.render('home', { pizzas: pizzas })
    return res.render('home')
}


// ***  Login  ***//
const login_get = (req, res) => {
    res.render('login')
}

const login_post = (req, res) => {
    const { email, password } = req.body
    // Validate request 
    if (!email || !password) {
        req.flash('error', 'All fields are required')
        return res.redirect('/login')
    }
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            req.flash('error', info.message)
            return next(err)
        }
        if (!user) {
            req.flash('error', info.message)
            return res.redirect('/login')
        }
        req.logIn(user, (err) => {
            if (err) {
                req.flash('error', info.message)
                return next(err)
            }

            return res.redirect(_getRedirectUrl(req))
        })
    })
}


//  ***  Register  ***//
const register_get = (req, res) => {
    res.render('register')
}
const register_post = async (req, res) => {
    const { name, email, password } = req.body
    // Validate request 
    if (!name || !email || !password) {
        req.flash('error', 'All fields are required')
        req.flash('name', name)
        req.flash('email', email)
        return res.redirect('/register')
    }

    // Check if email exists 
    User.exists({ email: email }, (err, result) => {
        if (result) {
            req.flash('error', 'Email already taken')
            req.flash('name', name)
            req.flash('email', email)
            return res.redirect('/register')
        }
    })

    // Hash password 
    const hashedPassword = await bcrypt.hash(password, 10)
    // Create a user 
    const user = new User({
        name,
        email,
        password: hashedPassword
    })

    user.save().then((user) => {
        // Login
        return res.redirect('/')
    }).catch(err => {
        req.flash('error', 'Something went wrong')
        return res.redirect('/register')
    })
}


// ***  Logout  ***//
const logoutController = (req, res) => {
    req.logout()
    return res.redirect('/login')
}

// *** Cart  ***//
const cartController = (req, res) => {
    res.render('cart')
}

const updateCartController = async (req, res) => {
    // let cart = {
    //     items: {
    //         pizzaId: { item: pizzaObject, qty:0 },
    //         pizzaId: { item: pizzaObject, qty:0 },
    //         pizzaId: { item: pizzaObject, qty:0 },
    //     },
    //     totalQty: 0,
    //     totalPrice: 0
    // }
    // for the first time creating cart and adding basic object structure
    if (!req.session.cart) {
        req.session.cart = {
            items: {},
            totalQty: 0,
            totalPrice: 0
        }
    }
    let cart = req.session.cart

    // Check if item does not exist in cart 
    if (!cart.items[req.body._id]) {
        cart.items[req.body._id] = {
            item: req.body,
            qty: 1
        }
        cart.totalQty = cart.totalQty + 1
        cart.totalPrice = cart.totalPrice + req.body.price
    } else {
        cart.items[req.body._id].qty = cart.items[req.body._id].qty + 1
        cart.totalQty = cart.totalQty + 1
        cart.totalPrice = cart.totalPrice + req.body.price
    }
    return res.json({ totalQty: req.session.cart.totalQty })
}

// ***  Order  ***// 
const orderNowController = (req, res) => {
    // Validate request
    const { phone, address, stripeToken, paymentType } = req.body
    if (!phone || !address) {
        return res.status(422).json({ message: 'All fields are required' });
    }

    const order = new Order({
        customerId: req.user._id,
        items: req.session.cart.items,
        phone,
        address
    })
    order.save().then(result => {
        Order.populate(result, { path: 'customerId' }, (err, placedOrder) => {
            // req.flash('success', 'Order placed successfully')

            // Stripe payment
            if (paymentType === 'card') {
                stripe.charges.create({
                    amount: req.session.cart.totalPrice * 100,
                    source: stripeToken,
                    currency: 'inr',
                    description: `Pizza order: ${placedOrder._id}`
                }).then(() => {
                    placedOrder.paymentStatus = true
                    placedOrder.paymentType = paymentType
                    placedOrder.save().then((ord) => {
                        // Emit
                        const eventEmitter = req.app.get('eventEmitter')
                        eventEmitter.emit('orderPlaced', ord)
                        delete req.session.cart
                        return res.json({ message: 'Payment successful, Order placed successfully' });
                    }).catch((err) => {
                        console.log(err)
                    })

                }).catch((err) => {
                    delete req.session.cart
                    return res.json({ message: 'OrderPlaced but payment failed, You can pay at delivery time' });
                })
            } else {
                delete req.session.cart
                return res.json({ message: 'Order placed succesfully' });
            }
        })
    }).catch(err => {
        return res.status(500).json({ message: 'Something went wrong' });
    })
}

const customerOrderListController = async (req, res) => {
    const orders = await Order.find({ customerId: req.user._id },
        null,
        { sort: { 'createdAt': -1 } })
    res.header('Cache-Control', 'no-store')
    res.render('orders', { orders: orders, moment: moment })
}

const customerOrderTrackingCotroller = async (req, res) => {
    const order = await Order.findById(req.params.id)
    // Authorize user
    if (req.user._id.toString() === order.customerId.toString()) {
        return res.render('singleOrder', { order: order })
    }
    return res.redirect('/')
}

//  ***  Admin  ***//
const adminOrdersController = (req, res) => {
    Order.find({ status: { $ne: 'completed' } }, null, { sort: { 'createdAt': -1 } }).populate('customerId', '-password').exec((err, orders) => {
        if (req.xhr) {
            return res.json(orders)
        } else {
            return res.render('adminOrders')
        }
    })
}

const adminOrderStatusChangeController = (req, res) => {
    Order.updateOne({ _id: req.body.orderId }, { status: req.body.status }, (err, data) => {
        if (err) {
            return res.redirect('/admin/orders')
        }
        // Emit event 
        const eventEmitter = req.app.get('eventEmitter')
        eventEmitter.emit('orderUpdated', { id: req.body.orderId, status: req.body.status })
        return res.redirect('/adminOrders')
    })
}

module.exports = { homePageController, login_get, login_post, register_get, register_post, logoutController, cartController, updateCartController, orderNowController, customerOrderListController, customerOrderTrackingCotroller, adminOrdersController, adminOrderStatusChangeController }