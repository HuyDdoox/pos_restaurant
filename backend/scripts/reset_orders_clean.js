const mongoose = require('mongoose');

async function cleanOrdersAndReset() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/restaurant_pos');
    console.log('Connected to MongoDB: restaurant_pos');

    // 1. Delete all OrderDetails
    const delDetails = await mongoose.connection.db.collection('orderdetails').deleteMany({});
    console.log('Deleted OrderDetails count:', delDetails.deletedCount);

    // 2. Delete all Orders
    const delOrders = await mongoose.connection.db.collection('orders').deleteMany({});
    console.log('Deleted Orders count:', delOrders.deletedCount);

    // 3. Delete temporary test tables (starting with SRC, DST, CASH, KDS, TEST)
    const delTestTables = await mongoose.connection.db.collection('tables').deleteMany({
      tableNumber: { $regex: /^(KDS|SRC|DST|CASH|TEST)/i }
    });
    console.log('Deleted test tables count:', delTestTables.deletedCount);

    // 4. Reset all remaining tables to Available
    const updateTables = await mongoose.connection.db.collection('tables').updateMany({}, {
      $set: {
        status: 'Available',
        currentOrderId: null,
        current_pax: 0,
        merged_with: null,
        reservation: null
      }
    });
    console.log('Reset tables to Available count:', updateTables.modifiedCount);

    const tables = await mongoose.connection.db.collection('tables').find({}).sort({ tableNumber: 1 }).toArray();
    console.log('Current real tables (' + tables.length + '):', tables.map(t => `${t.tableNumber} (${t.status})`));

    await mongoose.disconnect();
    console.log('Disconnected cleanly.');
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanOrdersAndReset();
