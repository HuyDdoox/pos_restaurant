const mongoose = require('mongoose');
const schemaOptions = { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { delete ret._id; delete ret.__v; } } };

const shiftSchema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    cashier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    startingCash: { type: Number, required: true, default: 0 },
    endingCash: { type: Number },
    status: { type: String, enum: ['Active', 'Closed', 'Archived'], default: 'Active' }
}, schemaOptions);

module.exports = mongoose.model('Shift', shiftSchema);