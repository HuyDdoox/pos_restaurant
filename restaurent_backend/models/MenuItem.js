const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const menuItemSchema = new mongoose.Schema({
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true },
    base_price: { type: Number, required: true, min: 0 },
    image: { type: String },
    status: { type: String, enum: ['Available', 'Out_of_stock', 'Archived'], default: 'Available' }
}, schemaOptions);

module.exports = mongoose.model('MenuItem', menuItemSchema);