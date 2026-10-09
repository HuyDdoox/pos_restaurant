const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const orderSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    waiter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalAmount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['Pending', 'Cooking', 'Served', 'Completed', 'Cancelled', 'Archived'], default: 'Pending' },
    paymentStatus: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' }
}, schemaOptions);

module.exports = mongoose.model('Order', orderSchema);