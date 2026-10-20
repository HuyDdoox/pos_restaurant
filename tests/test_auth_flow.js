const http = require('http');

function postJson(path, data, token = null) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(data);
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr)
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const req = http.request({
            hostname: 'localhost',
            port: 4000,
            path: path,
            method: 'POST',
            headers: headers
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(resBody);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, text: resBody });
                }
            });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

function getJson(path, token = null) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const req = http.request({
            hostname: 'localhost',
            port: 4000,
            path: path,
            method: 'GET',
            headers: headers
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(resBody);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, text: resBody });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log('--- 1. TEST REGISTER (/api/register) ---');
    const testEmail = `test_${Date.now()}@example.com`;
    const regRes = await postJson('/api/register', {
        name: 'Nguyen Van Test',
        email: testEmail,
        password: 'password123',
        confirm_password: 'password123',
        age: 22
    });
    console.log('Register status:', regRes.status);
    console.log('User created:', regRes.data?.user?.email, regRes.data?.user?.fullname, regRes.data?.user?.age);

    console.log('\n--- 2. TEST REGISTER WITH WRONG CONFIRM PASSWORD ---');
    const wrongRes = await postJson('/api/register', {
        name: 'Fail User',
        email: `fail_${Date.now()}@example.com`,
        password: 'password123',
        confirm_password: 'different_pass',
        age: 20
    });
    console.log('Wrong confirm password status:', wrongRes.status);
    console.log('Response:', wrongRes.data);

    console.log('\n--- 3. TEST LOGIN (/api/login) BY EMAIL ---');
    const loginRes = await postJson('/api/login', {
        email: testEmail,
        password: 'password123'
    });
    console.log('Login status:', loginRes.status);
    console.log('Has access_token:', !!loginRes.data?.access_token);
    console.log('Has refresh_token:', !!loginRes.data?.refresh_token);

    const accessToken = loginRes.data?.access_token;
    const refreshToken = loginRes.data?.refresh_token;

    console.log('\n--- 4. TEST REFRESH TOKEN (/api/refresh-token) ---');
    const refreshRes = await postJson('/api/refresh-token', {
        refresh_token: refreshToken
    });
    console.log('Refresh status:', refreshRes.status);
    console.log('New access_token:', !!refreshRes.data?.access_token);

    console.log('\n--- 5. TEST AUTHEN MIDDLEWARE (/auth/me with Bearer token) ---');
    const meRes = await getJson('/auth/me', accessToken);
    console.log('/auth/me status:', meRes.status);
    console.log('Current user email:', meRes.data?.data?.email || meRes.data?.user?.email);

    console.log('\n--- 6. TEST LOGIN WITH DEMO USER (admin_hcm) ---');
    const adminLogin = await postJson('/api/login', {
        username: 'admin_hcm',
        password: 'password123'
    });
    console.log('Admin login status:', adminLogin.status);
    console.log('Admin user fullname:', adminLogin.data?.user?.fullname, 'role:', adminLogin.data?.user?.role);
}

run().catch(console.error);
