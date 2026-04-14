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

  // Verifica configuração do vulnerability-detector no ossec.conf do manager
  try {
    const res = await axios.get(`${base}/manager/configuration`, {
      headers, httpsAgent: agent,
      params: { section: 'vulnerability-detector' }
    });
    console.log('Config:', JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log('config error:', JSON.stringify(e.response?.data, null, 2));
  }
  
  // Verifica índices do OpenSearch para vulnerabilidades
  try {
    const osBase = 'https://127.0.0.1:9200';
    const osCreds = Buffer.from('admin:SecretPassword').toString('base64');
    const res = await axios.get(`${osBase}/_cat/indices/wazuh-states-vulnerabilities*?v`, {
      headers: { Authorization: `Basic ${osCreds}` }, httpsAgent: agent
    });
    console.log('\nÍndices de vulnerabilidades:', res.data);
  } catch(e) {
    console.log('\nÍndice vul error:', e.response?.data || e.message);
  }
}

test().catch(console.error);
