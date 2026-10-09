const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const branchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Archived'], default: 'Active' }
}, schemaOptions);

module.exports = mongoose.model('Branch', branchSchema);