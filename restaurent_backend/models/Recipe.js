const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const recipeSchema = new mongoose.Schema({
    menuItem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    ingredient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    quantity_required: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' }
}, schemaOptions);

module.exports = mongoose.model('Recipe', recipeSchema);