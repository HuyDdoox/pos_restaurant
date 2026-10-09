const fs = require('fs');
const dbPath = 'E:/Hocki5/NodeJS_Restful Web Service/Hospitality Platform_RESTful API_QLDV_NH_KS/restaurant_frontend/db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

db.Orders = [];
db.OrderDetails = [];
if (db.Tables) {
    db.Tables = db.Tables.map(t => {
        t.status = 'Available';
        t.current_pax = 0;
        return t;
    });
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Database wiped successfully.');
