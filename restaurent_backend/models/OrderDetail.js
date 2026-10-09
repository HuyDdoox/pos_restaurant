const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const orderDetailSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    menuItem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    variants_selected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Variant' }],
    quantity: { type: Number, required: true, min: 1 },
    priceAtOrder: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Cooking', 'Ready', 'Served', 'Cancelled'], default: 'Pending' },
    incidentNote: { type: String, default: null }
}, schemaOptions);

module.exports = mongoose.model('OrderDetail', orderDetailSchema);