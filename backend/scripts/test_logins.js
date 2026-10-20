const http = require('http');

const accounts = [
  'admin_hcm',
  'cashier_lan',
  'chef_wong',
  'waiter_nhat',
  'customer_vip_01',
  'admin_master_01'
];

async function testAll() {
  for (const acc of accounts) {
    await new Promise((resolve) => {
      const reqData = JSON.stringify({ username: acc, password: '123456' });
      const req = http.request({
        hostname: 'localhost',
        port: 4000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const data = JSON.parse(body);
          console.log(`[LOGIN TEST] User: ${acc.padEnd(16)} | Status: ${res.statusCode} | Msg: ${data.message} | Role: ${data.data ? data.data.user.role : 'N/A'}`);
          resolve();
        });
      });
      req.write(reqData);
      req.end();
    });
  }
}

testAll();
