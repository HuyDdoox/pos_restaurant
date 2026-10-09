const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const ingredientSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true },
    stock_quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Out_of_stock', 'Archived'], default: 'Active' }
}, schemaOptions);

module.exports = mongoose.model('Ingredient', ingredientSchema);