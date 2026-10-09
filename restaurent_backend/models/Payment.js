const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const paymentSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    cashier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payment_method: { type: String, enum: ['Cash', 'Credit_Card', 'Bank_Transfer', 'E_Wallet'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Completed', 'Failed', 'Refunded', 'Archived'], default: 'Completed' }
}, schemaOptions);

module.exports = mongoose.model('Payment', paymentSchema);