const mongoose = require('mongoose');
const { Table, Order } = require('../models');

async function clean() {
    await mongoose.connect('mongodb://localhost:27017/restaurant_pos');
    const tables = await Table.find({});
    let count = 0;
    for (const t of tables) {
        const active = await Order.findOne({
            table_id: t._id,
            status: { $nin: ['Completed', 'Cancelled'] }
        });
        if (!active) {
            t.status = 'Available';
            t.currentOrderId = null;
            await t.save();
            count++;
        }
    }
    console.log(`Successfully reset ${count} tables to Available!`);
    await mongoose.disconnect();
    process.exit(0);
}

clean().catch(console.error);
