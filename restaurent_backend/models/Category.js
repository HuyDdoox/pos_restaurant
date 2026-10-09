const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const categorySchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['Active', 'Inactive', 'Archived'], default: 'Active' }
}, schemaOptions);

module.exports = mongoose.model('Category', categorySchema);