const axios = require('axios');
const https = require('https');

async function test() {
  const tokenRes = await axios.get('https://127.0.0.1:55000/security/user/authenticate', {
    headers: { Authorization: `Basic ${Buffer.from('wazuh-wui:MyS3cr37P450r.*-').toString('base64')}` },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  const token = tokenRes.data.data.token;
  
  const agentsRes = await axios.get('https://127.0.0.1:55000/agents', {
    headers: { Authorization: `Bearer ${token}` },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  
  console.log(JSON.stringify(agentsRes.data.data.affected_items, null, 2));
}

test().catch(console.error);
