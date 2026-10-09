const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; delete ret.password; } } };

const userSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullname: { type: String, required: true },
    role: { type: String, enum: ['Admin', 'Cashier', 'Waiter', 'Chef'], required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Locked', 'Archived'], default: 'Active' },
    lock_reason: { type: String, default: null }
}, schemaOptions);

module.exports = mongoose.model('User', userSchema);