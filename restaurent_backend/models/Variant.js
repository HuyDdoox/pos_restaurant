const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const variantSchema = new mongoose.Schema({
    menuItem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    group_name: { type: String, required: true },
    name: { type: String, required: true },
    extra_price: { type: Number, default: 0, min: 0 },
    allowMultiple: { type: Boolean, default: false },
    status: { type: String, enum: ['Available', 'Out_of_stock', 'Archived'], default: 'Available' }
}, schemaOptions);

module.exports = mongoose.model('Variant', variantSchema);