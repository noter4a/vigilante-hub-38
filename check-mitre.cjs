const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const osCreds = Buffer.from('admin:SecretPassword').toString('base64');

async function test() {
  // Busca alertas que tenham campo mitre
  const query = {
    query: { exists: { field: "rule.mitre.id" } },
    _source: ["rule.mitre", "rule.description", "rule.level", "rule.groups", "agent.name", "@timestamp"],
    size: 5
  };
  const res = await axios.post('https://127.0.0.1:9200/wazuh-alerts-*/_search', query, {
    headers: { Authorization: `Basic ${osCreds}` },
    httpsAgent
  });
  
  const hits = res.data?.hits?.hits || [];
  console.log(`Total com MITRE: ${res.data?.hits?.total?.value}`);
  hits.forEach(h => console.log(JSON.stringify(h._source, null, 2)));
}

test().catch(e => console.error(e.response?.data || e.message));
