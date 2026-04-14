const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const base = 'https://127.0.0.1:55000';
const creds = Buffer.from('wazuh-wui:MyS3cr37P450r.*-').toString('base64');

async function test() {
  const tokenRes = await axios.get(`${base}/security/user/authenticate`, {
    headers: { Authorization: `Basic ${creds}` }, httpsAgent: agent
  });
  const token = tokenRes.data.data.token;
  const headers = { Authorization: `Bearer ${token}` };

  // Testa endpoints alternativos de vuls
  const endpoints = [
    '/vulnerability/001?limit=2',
    '/vulnerability/001/summary',
    '/experimental/vulnerability/001',
    '/manager/configuration?section=vulnerability-detector',
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await axios.get(`${base}${ep}`, { headers, httpsAgent: agent });
      console.log(`\n✅ GET ${ep}`);
      console.log(JSON.stringify(res.data, null, 2).substring(0, 500));
    } catch(e) {
      console.log(`\n❌ GET ${ep} => ${e.response?.data?.title || e.message}`);
    }
  }
}

test().catch(console.error);
