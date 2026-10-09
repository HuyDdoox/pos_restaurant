const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const tableSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    tableNumber: { type: String, required: true },
    max_capacity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['Available', 'Occupied', 'Reserved', 'Archived'], default: 'Available' }
}, schemaOptions);

module.exports = mongoose.model('Table', tableSchema);