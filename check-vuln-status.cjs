const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const osCreds = Buffer.from('admin:SecretPassword').toString('base64');
const wazuhCreds = Buffer.from('wazuh-wui:MyS3cr37P450r.*-').toString('base64');

async function test() {
  // 1. Check ALL vulnerability-related indices
  console.log('=== INDICES DE VULNERABILIDADES ===');
  const idxRes = await axios.get('https://127.0.0.1:9200/_cat/indices?v&h=health,status,index,docs.count', {
    headers: { Authorization: `Basic ${osCreds}` }, httpsAgent
  });
  const lines = idxRes.data.split('\n').filter(l => l.includes('vuln') || l.includes('states'));
  console.log(lines.join('\n') || 'Nenhum índice de vuln encontrado');

  // 2. Check syscollector packages data in OpenSearch
  console.log('\n=== PACOTES NO OPENSEARCH (syscollector) ===');
  try {
    const pkgRes = await axios.get('https://127.0.0.1:9200/_cat/indices?v&h=health,status,index,docs.count', {
      headers: { Authorization: `Basic ${osCreds}` }, httpsAgent
    });
    const sysLines = pkgRes.data.split('\n').filter(l => l.includes('package') || l.includes('syscollector'));
    console.log(sysLines.join('\n') || 'Nenhum índice de pacotes/syscollector');
  } catch (e) { console.log('Erro:', e.message); }

  // 3. Check wazuh-states-* indices
  console.log('\n=== TODOS OS ÍNDICES wazuh-states ===');
  try {
    const stateRes = await axios.get('https://127.0.0.1:9200/wazuh-states-*/_count', {
      headers: { Authorization: `Basic ${osCreds}` }, httpsAgent
    });
    console.log(JSON.stringify(stateRes.data, null, 2));
  } catch (e) { console.log('Erro:', e.message); }

  // 4. Check wazuh manager vulnerability log
  console.log('\n=== API VULN STATUS ===');
  const tokenRes = await axios.get('https://127.0.0.1:55000/security/user/authenticate', {
    headers: { Authorization: `Basic ${wazuhCreds}` }, httpsAgent
  });
  const token = tokenRes.data.data.token;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const res = await axios.get('https://127.0.0.1:55000/vulnerability?limit=5', { headers, httpsAgent });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('endpoint /vulnerability global:', e.response?.data || e.message);
  }

  // 5. Check syscollector data via Manager API
  console.log('\n=== SYSCOLLECTOR PACKAGES AGENT 001 ===');
  try {
    const res = await axios.get('https://127.0.0.1:55000/syscollector/001/packages?limit=3', { headers, httpsAgent });
    const total = res.data?.data?.total_affected_items;
    const sample = res.data?.data?.affected_items?.slice(0, 2);
    console.log(`Total packages: ${total}`);
    console.log(JSON.stringify(sample, null, 2));
  } catch (e) {
    console.log('syscollector 001:', e.response?.data || e.message);
  }
}

test().catch(e => console.error(e.response?.data || e.message));
