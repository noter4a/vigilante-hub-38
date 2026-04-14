const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const base = 'https://127.0.0.1:55000';
const creds = Buffer.from('wazuh-wui:MyS3cr37P450r.*-').toString('base64');

async function test() {
  // Auth
  const tokenRes = await axios.get(`${base}/security/user/authenticate`, {
    headers: { Authorization: `Basic ${creds}` },
    httpsAgent: agent
  });
  const token = tokenRes.data.data.token;
  const headers = { Authorization: `Bearer ${token}` };

  // Testa vulnerabilidades por agente
  for (const id of ['000', '001', '002']) {
    try {
      const res = await axios.get(`${base}/vulnerability/${id}`, { headers, httpsAgent: agent });
      const total = res.data?.data?.total_affected_items;
      const items = res.data?.data?.affected_items?.slice(0, 2);
      console.log(`\n=== Agente ${id} ===`);
      console.log(`Total de vulnerabilidades: ${total}`);
      if (items?.length) console.log('Amostra:', JSON.stringify(items, null, 2));
    } catch(e) {
      console.log(`\n=== Agente ${id} === ERRO:`, e.response?.data || e.message);
    }
  }
}

test().catch(console.error);
