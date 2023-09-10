const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: 'customer' },
    password: { type: String, required: true }
}, { timestamps: true })

const model = mongoose.model('user', userSchema)
module.exports = model 