/**
 * reset-sca.cjs
 * Reinicia o SCA em todos os agentes ativos do Wazuh.
 * Isso força um novo scan e sobrescreve os contadores de Passou/Falhou.
 *
 * Uso: node reset-sca.cjs
 */

const https = require('https');
const http  = require('http');

// ─── Configurações ────────────────────────────────────────────────────────────
const WAZUH_HOST = '127.0.0.1';
const WAZUH_PORT = 55000;
const WAZUH_USER = 'wazuh-wui';
const WAZUH_PASS = 'MyS3cr37P450r.*-';
// ──────────────────────────────────────────────────────────────────────────────

const BASE = `https://${WAZUH_HOST}:${WAZUH_PORT}`;
const agent = new https.Agent({ rejectUnauthorized: false });

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const data = body ? JSON.stringify(body) : null;
  if (data) headers['Content-Length'] = Buffer.byteLength(data);

  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
      agent,
    };

    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔐 Autenticando no Wazuh...');
  const auth = Buffer.from(`${WAZUH_USER}:${WAZUH_PASS}`).toString('base64');
  
  const tokenRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: WAZUH_HOST,
      port: WAZUH_PORT,
      path: '/security/user/authenticate',
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      agent,
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.end();
  });

  const token = tokenRes.data?.data?.token;
  if (!token) {
    console.error('❌ Falha na autenticação:', JSON.stringify(tokenRes.data));
    process.exit(1);
  }
  console.log('✅ Autenticado!\n');

  // Buscar todos os agentes ativos (exceto o manager 000)
  console.log('📋 Buscando agentes ativos...');
  const agentsRes = await request('GET', '/agents?status=active&limit=500', null, token);
  const agents = agentsRes.data?.data?.affected_items || [];
  const activeAgents = agents.filter(a => a.id !== '000');

  console.log(`👥 ${activeAgents.length} agente(s) encontrado(s): ${activeAgents.map(a => `${a.id}:${a.name}`).join(', ')}\n`);

  if (activeAgents.length === 0) {
    console.log('⚠️  Nenhum agente ativo encontrado. Verifique se os agentes estão conectados.');
    process.exit(0);
  }

  // Reiniciar cada agente para forçar novo scan do SCA
  console.log('🔄 Reiniciando agentes para forçar novo scan SCA...');
  for (const ag of activeAgents) {
    try {
      const res = await request('PUT', `/agents/${ag.id}/restart`, null, token);
      if (res.status === 200) {
        console.log(`  ✅ Agente ${ag.id} (${ag.name}) — reiniciado`);
      } else {
        console.log(`  ⚠️  Agente ${ag.id} (${ag.name}) — status ${res.status}: ${JSON.stringify(res.data?.message || '')}`);
      }
    } catch (err) {
      console.log(`  ❌ Agente ${ag.id} (${ag.name}) — erro: ${err.message}`);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Concluído!

O que acontece agora:
  1. Os agentes reiniciarão o serviço Wazuh
  2. Ao reconectar, o SCA executará um novo scan completo
  3. Os contadores de Passou/Falhou serão sobrescritos
     com os resultados do novo scan (geralmente leva
     1-5 minutos após a reconexão)

Depois disso, recarregue o dashboard para ver os novos dados.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
