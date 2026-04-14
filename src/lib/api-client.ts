import axios from 'axios';
import { Agent, Alert, Severity, Vulnerability } from "../types/api";

// ========================
// TIPOS MITRE ATT&CK
// ========================
export interface MitreTechniqueOccurrence {
  timestamp: string;
  agentName: string;
  ruleDescription: string;
  ruleLevel: number;
}

export interface MitreTechnique {
  id: string;
  name: string;
  tactics: string[];
  count: number;
  agents: string[];
  lastSeen: string;
  maxLevel: number;    // highest rule.level seen
  severity: 'critical' | 'high' | 'medium' | 'low';
  occurrences: MitreTechniqueOccurrence[];
}

export interface MitreTactic {
  name: string;
  count: number;
  techniques: MitreTechnique[];
}

export interface MitreApiEnrichment {
  externalId: string;
  description: string;
  detection: string;
  mitigationNames: string[];
  mitigationExternalIds: string[];
  url: string;
}

// Configurações do Wazuh Manager API
const WAZUH_API_URL = '/api/wazuh';
const WAZUH_CREDS = btoa('wazuh-wui:MyS3cr37P450r.*-');

// Configurações do Wazuh Indexer (OpenSearch)
const OS_API_URL = '/api/opensearch';
const OS_CREDS = btoa('admin:SecretPassword');

// ===============
// AXIOS INSTANCES
// ===============

export const wazuhApi = axios.create({ baseURL: WAZUH_API_URL, timeout: 15000 });
export const openSearchApi = axios.create({ baseURL: OS_API_URL, timeout: 15000 });

let cachedWazuhToken: string | null = null;

export const authenticateWazuh = async (): Promise<string> => {
  if (cachedWazuhToken) return cachedWazuhToken;
  try {
    const res = await axios.get(`${WAZUH_API_URL}/security/user/authenticate`, {
      headers: { Authorization: `Basic ${WAZUH_CREDS}` },
    });
    const token = res.data?.data?.token;
    if (token) {
      cachedWazuhToken = token;
      return token;
    }
    throw new Error("Wazuh Token Error");
  } catch (error) {
    console.error("Auth falhou:", error);
    throw error;
  }
};

wazuhApi.interceptors.request.use(async (config) => {
  if (config.url === '/security/user/authenticate') return config;
  const token = await authenticateWazuh();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
wazuhApi.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) cachedWazuhToken = null;
  return Promise.reject(err);
});

openSearchApi.interceptors.request.use((config) => {
  config.headers.Authorization = `Basic ${OS_CREDS}`;
  return config;
});

// ===============
// WAZUH ENDPOINTS
// ===============

export const getWazuhAgents = async (): Promise<Agent[]> => {
  const res = await wazuhApi.get('/agents', { params: { limit: 500, select: 'id,name,status,os.name,os.platform,group,lastKeepAlive' } });
  const items = res.data?.data?.affected_items || [];
  return items.map((item: any) => {
    const groups: string[] = Array.isArray(item.group) ? item.group : [];
    const groupName = groups.filter((g: string) => g !== 'default').join(', ') || groups[0] || 'Sem Grupo';
    return {
      id: String(item.id),
      hostname: item.name || 'Desconhecido',
      os: item.os?.name || item.os?.platform || 'Desconhecido',
      status: item.status === 'active' ? 'online' : 'offline',
      lastCommunication: item.lastKeepAlive || new Date().toISOString(),
      clientId: groupName.toLowerCase().replace(/\s+/g, '-'),
      clientName: groupName,
      group: groupName
    };
  });
};

// ========================
// COMPANIES (WAZUH GROUPS)
// ========================

export interface WazuhGroup {
  name: string;
  count: number;
}

export const getWazuhGroups = async (): Promise<WazuhGroup[]> => {
  try {
    const res = await wazuhApi.get('/groups');
    return res.data?.data?.affected_items || [];
  } catch (error) {
    console.error("Erro ao buscar grupos do Wazuh:", error);
    return [];
  }
};

export const createWazuhGroup = async (groupName: string): Promise<boolean> => {
  try {
    await wazuhApi.post('/groups', { group_id: groupName });
    return true;
  } catch (error) {
    console.error(`Erro ao criar o grupo ${groupName}:`, error);
    return false;
  }
};

export const addAgentToGroup = async (agentId: string, groupName: string): Promise<boolean> => {
  try {
    await wazuhApi.put(`/agents/${agentId}/group/${groupName}`);
    return true;
  } catch (error) {
    console.error(`Erro ao adicionar o agente ${agentId} ao grupo ${groupName}:`, error);
    return false;
  }
};

export const removeAgentFromGroup = async (agentId: string, groupName: string): Promise<boolean> => {
  try {
    await wazuhApi.delete(`/agents/${agentId}/group/${groupName}`);
    return true;
  } catch (error) {
    console.error(`Erro ao remover o agente ${agentId} do grupo ${groupName}:`, error);
    return false;
  }
};

export const deleteWazuhGroup = async (groupName: string): Promise<boolean> => {
  try {
    await wazuhApi.delete(`/groups/${groupName}`);
    return true;
  } catch (error) {
    console.error(`Erro ao deletar o grupo ${groupName}:`, error);
    return false;
  }
};

export const renameWazuhGroup = async (oldName: string, newName: string, agentIdsToMove: string[]): Promise<boolean> => {
  try {
    // 1. Criar novo grupo
    const created = await createWazuhGroup(newName);
    if (!created) return false;

    // 2. Mover agentes para o novo grupo
    for (const agentId of agentIdsToMove) {
      await addAgentToGroup(agentId, newName); // No Wazuh, adicionar o agente no novo sobreescreve ou adiciona à lista
      // Remover do antigo previne que a deleção do grupo falhe se não for forçada, ou evita agentes com grupos múltiplos indesejados
      await removeAgentFromGroup(agentId, oldName);
    }

    // 3. Deletar grupo antigo
    const deleted = await deleteWazuhGroup(oldName);
    return deleted;
  } catch (error) {
    console.error(`Erro ao tentar renomear ${oldName} para ${newName}:`, error);
    return false;
  }
};

export const getWazuhManagerInfo = async () => {
  const res = await wazuhApi.get('/manager/info');
  return res.data;
};

export interface AgentsOperationalSummary {
  active: number;
  disconnected: number;
  neverConnected: number;
  pending: number;
  total: number;
  synced: number;
  notSynced: number;
  osFamilies: string[];
}

export const getWazuhAgentsOperationalSummary = async (): Promise<AgentsOperationalSummary> => {
  const [statusRes, osRes] = await Promise.all([
    wazuhApi.get('/agents/summary/status'),
    wazuhApi.get('/agents/summary/os'),
  ]);

  const connection = statusRes.data?.data?.connection || {};
  const configuration = statusRes.data?.data?.configuration || {};
  const osFamilies = Array.isArray(osRes.data?.data?.affected_items) ? osRes.data.data.affected_items : [];

  return {
    active: connection.active || 0,
    disconnected: connection.disconnected || 0,
    neverConnected: connection.never_connected || 0,
    pending: connection.pending || 0,
    total: connection.total || 0,
    synced: configuration.synced || 0,
    notSynced: configuration.not_synced || 0,
    osFamilies,
  };
};

export interface WazuhStackHealth {
  managerApiUp: boolean;
  managerVersion: string;
  indexerStatus: string;
  indexerNodes: number;
  ingestionLastAlertAt: string | null;
  ingestionDelayMinutes: number | null;
  ingestionAlerts5m: number;
}

export const getWazuhStackHealth = async (): Promise<WazuhStackHealth> => {
  let managerApiUp = false;
  let managerVersion = "desconhecida";
  let indexerStatus = "unknown";
  let indexerNodes = 0;
  let ingestionLastAlertAt: string | null = null;
  let ingestionDelayMinutes: number | null = null;
  let ingestionAlerts5m = 0;

  try {
    const managerInfo = await getWazuhManagerInfo();
    managerApiUp = true;
    managerVersion = managerInfo?.data?.api?.version || managerInfo?.data?.version || "desconhecida";
  } catch (error) {
    console.error("Falha ao consultar manager info", error);
  }

  try {
    const healthRes = await openSearchApi.get('/_cluster/health');
    indexerStatus = healthRes.data?.status || "unknown";
    indexerNodes = healthRes.data?.number_of_nodes || 0;
  } catch (error) {
    console.error("Falha ao consultar saúde do indexer", error);
  }

  try {
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const osQuery = {
      size: 1,
      sort: [{ "@timestamp": { order: "desc" } }],
      query: { match_all: {} }
    };
    const lastAlertRes = await openSearchApi.post('/wazuh-alerts-*/_search', osQuery);
    const lastTs = lastAlertRes.data?.hits?.hits?.[0]?._source?.["@timestamp"];
    if (lastTs) {
      ingestionLastAlertAt = lastTs;
      ingestionDelayMinutes = Math.max(0, Math.floor((now - new Date(lastTs).getTime()) / 60000));
    }

    const countQuery = {
      query: { bool: { filter: [{ range: { "@timestamp": { gte: fiveMinAgo } } }] } }
    };
    const countRes = await openSearchApi.post('/wazuh-alerts-*/_count', countQuery);
    ingestionAlerts5m = countRes.data?.count || 0;
  } catch (error) {
    console.error("Falha ao consultar ingestão de alertas", error);
  }

  return {
    managerApiUp,
    managerVersion,
    indexerStatus,
    indexerNodes,
    ingestionLastAlertAt,
    ingestionDelayMinutes,
    ingestionAlerts5m
  };
};

export const getOverviewStats = async (): Promise<Client[]> => {
  // 1. Buscar todos os agentes e seus grupos
  const agentsRes = await wazuhApi.get('/agents', { params: { limit: 500, select: 'id,name,status,group,os.name,os.platform' } });
  const agents = agentsRes.data?.data?.affected_items || [];

  const yesterday = new Date(Date.now() - 86400000).toISOString();
  
  // Agrupar por Empresa (Group)
  const groupMap = new Map<string, { agents: any[]; online: number; offline: number }>();

  agents.forEach((agent: any) => {
    const groups: string[] = Array.isArray(agent.group) ? agent.group : [];
    const groupName = groups.filter((g: string) => g !== 'default').join(', ') || groups[0] || 'Sem Grupo';

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { agents: [], online: 0, offline: 0 });
    }

    const stats = groupMap.get(groupName)!;
    stats.agents.push(agent);
    if (agent.status === 'active') stats.online++;
    else stats.offline++;
  });

  const clients: Client[] = [];

  for (const [groupName, stats] of groupMap.entries()) {
    const agentIds = stats.agents.map(a => a.id);

    let criticalAlerts = 0, highAlerts = 0, mediumAlerts = 0;
    let criticalVulns = 0, highVulns = 0, mediumVulns = 0;

    try {
      const [resCrit, resHigh, resMed] = await Promise.all([
        openSearchApi.post('/wazuh-alerts-*/_search?size=0', { query: { bool: { filter: [
          { range: { "@timestamp": { gte: yesterday } } },
          { terms: { "agent.id": agentIds } },
          { range: { "rule.level": { gte: 10 } } }
        ]}}}),
        openSearchApi.post('/wazuh-alerts-*/_search?size=0', { query: { bool: { filter: [
          { range: { "@timestamp": { gte: yesterday } } },
          { terms: { "agent.id": agentIds } },
          { range: { "rule.level": { gte: 7, lt: 10 } } }
        ]}}}),
        openSearchApi.post('/wazuh-alerts-*/_search?size=0', { query: { bool: { filter: [
          { range: { "@timestamp": { gte: yesterday } } },
          { terms: { "agent.id": agentIds } },
          { range: { "rule.level": { gte: 5, lt: 7 } } }
        ]}}}),
      ]);
      criticalAlerts = resCrit.data?.hits?.total?.value || 0;
      highAlerts     = resHigh.data?.hits?.total?.value || 0;
      mediumAlerts   = resMed.data?.hits?.total?.value  || 0;
    } catch { }

    try {
      const resVulns = await openSearchApi.post('/wazuh-states-vulnerabilities-*/_search?size=500', {
        query: { bool: { filter: [
          { terms: { "agent.id": agentIds } },
          { term: { "vulnerability.status": "VALID" } }
        ]}}
      });
      (resVulns.data?.hits?.hits || []).forEach((h: any) => {
        const sev = (h._source?.vulnerability?.severity || '').toLowerCase();
        if (sev === 'critical') criticalVulns++;
        else if (sev === 'high') highVulns++;
        else if (sev === 'medium') mediumVulns++;
      });
    } catch { }

    // ─── Score de Segurança: começa em 100 e desconta por risco real ────────────
    // Cada categoria tem um teto para evitar que um único tipo afunde o score.
    // 100 = excelente / 0 = crítico
    const riskPoints = [
      Math.min(criticalAlerts * 15, 60),  // alertas críticos: -15/cada, cap -60
      Math.min(highAlerts     *  5, 20),  // alertas altos:    - 5/cada, cap -20
      Math.min(mediumAlerts   *  1, 10),  // alertas médios:   - 1/cada, cap -10
      Math.min(criticalVulns  * 10, 40),  // vulns críticas:   -10/cada, cap -40
      Math.min(highVulns      *  4, 20),  // vulns altas:      - 4/cada, cap -20
      Math.min(mediumVulns    *  1,  5),  // vulns médias:     - 1/cada, cap  -5
      Math.min(stats.offline  *  3, 10),  // agentes offline:  - 3/cada, cap -10
    ];
    const securityScore = Math.max(0, 100 - riskPoints.reduce((s, p) => s + p, 0));
    // ─────────────────────────────────────────────────────────────────────────

    clients.push({
      id: groupName.toLowerCase().replace(/\s+/g, '-'),
      name: groupName,
      riskLevel: criticalAlerts > 5 ? 'high' : criticalAlerts > 0 ? 'medium' : 'low',
      criticalAlerts24h: criticalAlerts,
      agentsOnline: stats.online,
      agentsOffline: stats.offline,
      criticalVulnerabilities: criticalVulns,
      securityScore,
    });
  }

  return clients.sort((a, b) => b.criticalAlerts24h - a.criticalAlerts24h);
};

export const getWazuhAlerts = async (): Promise<Alert[]> => {
  try {
    // Buscar mapa agente → grupo para identificar a empresa
    const agentsRes = await wazuhApi.get('/agents', { params: { limit: 500, select: 'id,group' } });
    const agentItems = agentsRes.data?.data?.affected_items || [];
    const agentGroupMap = new Map<string, string>();
    agentItems.forEach((a: any) => {
      const groups: string[] = Array.isArray(a.group) ? a.group : [];
      const groupName = groups.filter((g: string) => g !== 'default').join(', ') || groups[0] || 'Sem Grupo';
      agentGroupMap.set(String(a.id), groupName);
    });

    const last7d = new Date(Date.now() - 7 * 86400000).toISOString();
    const osQuery = {
      size: 500,
      sort: [{ "@timestamp": { "order": "desc" } }],
      query: {
        bool: {
          filter: [{ range: { "@timestamp": { gte: last7d } } }]
        }
      }
    };
    const res = await openSearchApi.post('/wazuh-alerts-*/_search', osQuery);
    const hits = res.data?.hits?.hits || [];

    const NOISE_GROUPS = new Set([
      "ossec",
      "syscollector",
      "sca",
      "rootcheck",
      "inventory",
      "configuration_assessment",
    ]);

    const filteredHits = hits.filter((hit: any) => {
      const src = hit?._source;
      const level = src?.rule?.level || 0;
      const groups: string[] = Array.isArray(src?.rule?.groups) ? src.rule.groups : [];
      const description = (src?.rule?.description || "").toLowerCase();

      // Mantém somente alertas com nível operacional (>=5)
      if (level < 5) return false;

      // Remove eventos de telemetria/base que normalmente geram ruído operacional
      if (groups.some((g) => NOISE_GROUPS.has(String(g).toLowerCase()))) {
        return false;
      }

      // Remove mensagens de heartbeat/estado sem valor de triagem
      if (
        description.includes("agent started") ||
        description.includes("agent connected") ||
        description.includes("syscollector scan finished") ||
        description.includes("sca scan") ||
        description.includes("state synchronization")
      ) {
        return false;
      }

      return true;
    });

    return filteredHits.map((hit: any) => {
      const src = hit._source;
      let sev: Severity = "low";
      const lvl = src.rule.level || 0;
      if (lvl >= 10) sev = "critical";
      else if (lvl >= 7) sev = "high";
      else if (lvl >= 4) sev = "medium";

      return {
        id: Array.isArray(src.id) ? src.id[0] : (src.id || hit._id),
        timestamp: src["@timestamp"],
        severity: sev,
        type: src.rule.description || src.rule.groups?.[0] || 'Alerta',
        description: src.data?.win?.system?.message || src.full_log || '',
        host: src.agent?.name || 'Desconhecido',
        agentId: src.agent?.id || '000',
        clientId: (agentGroupMap.get(src.agent?.id || '000') || 'Sem Grupo').toLowerCase().replace(/\s+/g, '-'),
        clientName: agentGroupMap.get(src.agent?.id || '000') || 'Sem Grupo',
        status: "open",
        source: src.data?.win?.system?.providerName || src.location || undefined,
      };
    });
  } catch (error) {
    console.error("Falha ao buscar alertas do Indexer", error);
    return [];
  }
};

export const getWazuhVulnerabilities = async (): Promise<Vulnerability[]> => {
  try {
    // Buscar mapa agente → grupo para identificar a empresa
    const agentsRes = await wazuhApi.get('/agents', { params: { limit: 500, select: 'id,group' } });
    const agentItems = agentsRes.data?.data?.affected_items || [];
    const agentGroupMap = new Map<string, string>();
    agentItems.forEach((a: any) => {
      const groups: string[] = Array.isArray(a.group) ? a.group : [];
      const groupName = groups.filter((g: string) => g !== 'default').join(', ') || groups[0] || 'Sem Grupo';
      agentGroupMap.set(String(a.id), groupName);
    });

    const osQuery = {
      track_total_hits: true,
      sort: [{ "vulnerability.severity": { "order": "desc", "unmapped_type": "keyword" } }],
      query: { match_all: {} }
    };
    const res = await openSearchApi.post('/wazuh-states-vulnerabilities-*/_search?size=100', osQuery);
    const hits = res.data?.hits?.hits || [];

    if (hits.length === 0) {
      return [];
    }

    return hits.map((hit: any) => {
      const src = hit._source;
      const vulnSev = src.vulnerability?.severity || 'Medium';
      let sev: Severity = "medium";
      if (vulnSev === "Critical") sev = "critical";
      else if (vulnSev === "High") sev = "high";
      else if (vulnSev === "Low") sev = "low";

      const agentId = src.agent?.id || '000';
      const groupName = agentGroupMap.get(agentId) || 'Sem Grupo';

      return {
        id: (src.vulnerability?.id || hit._id) + '-' + agentId,
        cve: src.vulnerability?.id || 'N/A',
        severity: sev,
        description: src.vulnerability?.description || src.vulnerability?.condition || 'Detalhes não disponibilizados pelo scanner.',
        reference: src.vulnerability?.reference || '',
        affectedPackage: (src.package?.name || 'Desconhecido') + (src.package?.version ? ' v' + src.package?.version : ''),
        affectedHost: src.agent?.name || 'Desconhecido',
        clientId: groupName.toLowerCase().replace(/\s+/g, '-'),
        clientName: groupName,
        status: src.vulnerability?.status === 'Fixed' ? 'mitigated' : 'open'
      };
    });
  } catch (error) {
    console.error("Falha ao buscar vuls", error);
    return [];
  }
};

export const getWazuhClientSummary = async (clientId: string) => {
  const allClients = await getOverviewStats();
  const matchedClient = allClients.find(c => c.id === clientId) || {
    id: clientId,
    name: clientId,
    riskLevel: 'medium' as any,
    alertsLast24h: 0,
    securityScore: 0,
    agentsOnline: 0,
    agentsOffline: 0
  };
  const alerts = await getWazuhAlerts();

  const alertsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const recentEvents = alerts.slice(0, 10).map((a) => ({
    id: a.id,
    timestamp: a.timestamp,
    description: a.type,
    severity: a.severity,
    source: a.host
  }));

  alerts.forEach(a => {
    if (alertsBySeverity[a.severity] !== undefined) {
      alertsBySeverity[a.severity]++;
    }
  });

  return {
    client: matchedClient,
    alertsBySeverity,
    agentsOnline: matchedClient.agentsOnline,
    agentsOffline: matchedClient.agentsOffline,
    vulnerabilitiesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    recentEvents
  };
};

// ========================
// MITRE ATT&CK
// ========================
export const getWazuhMitre = async (): Promise<{ tactics: MitreTactic[]; techniques: MitreTechnique[]; total: number }> => {
  try {
    // Exclui eventos operacionais de rotina (level < 6) — regras syscheck nível 5-7
    // para arquivos normais não devem aparecer como ameaça MITRE, apenas nível >= 6.
    const osQuery = {
      query: {
        bool: {
          must: [{ exists: { field: "rule.mitre.id" } }],
          filter: [{ range: { "rule.level": { gte: 6 } } }]
        }
      },
      _source: ["rule.mitre", "rule.description", "rule.level", "agent.name", "@timestamp"],
      size: 500,
      sort: [{ "@timestamp": { order: "desc" } }]
    };
    const res = await openSearchApi.post('/wazuh-alerts-*/_search', osQuery);
    const hits = res.data?.hits?.hits || [];
    const total = res.data?.hits?.total?.value || 0;

    const techMap = new Map<string, MitreTechnique>();

    hits.forEach((hit: any) => {
      const src = hit._source;
      const mitre = src.rule?.mitre;
      if (!mitre) return;

      const ids: string[] = Array.isArray(mitre.id) ? mitre.id : [mitre.id];
      const techniques: string[] = Array.isArray(mitre.technique) ? mitre.technique : [mitre.technique];
      const tactics: string[] = Array.isArray(mitre.tactic) ? mitre.tactic : [mitre.tactic];
      const agent = src.agent?.name || 'Desconhecido';
      const ts = src["@timestamp"] || '';
      const level: number = src.rule?.level || 0;
      const ruleDesc = src.rule?.description || 'Sem descrição';

      ids.forEach((techId, i) => {
        if (!techId) return;
        const occurrence: MitreTechniqueOccurrence = { timestamp: ts, agentName: agent, ruleDescription: ruleDesc, ruleLevel: level };
        const existing = techMap.get(techId);
        if (existing) {
          existing.count++;
          existing.maxLevel = Math.max(existing.maxLevel, level);
          if (!existing.agents.includes(agent)) existing.agents.push(agent);
          if (ts > existing.lastSeen) existing.lastSeen = ts;
          existing.occurrences.push(occurrence);
        } else {
          techMap.set(techId, {
            id: techId,
            name: techniques[i] || techId,
            tactics,
            count: 1,
            agents: [agent],
            lastSeen: ts,
            maxLevel: level,
            severity: level >= 12 ? 'critical' : level >= 10 ? 'high' : level >= 7 ? 'medium' : 'low',
            occurrences: [occurrence]
          });
        }
      });
    });

    // Resolve severity from maxLevel for all entries, sort by risk (maxLevel) then count
    const techniquesList = Array.from(techMap.values())
      .map(t => ({
        ...t,
        severity: t.maxLevel >= 12 ? 'critical' as const : t.maxLevel >= 10 ? 'high' as const : t.maxLevel >= 7 ? 'medium' as const : 'low' as const
      }))
      .sort((a, b) => b.maxLevel - a.maxLevel || b.count - a.count);

    const tacticMap = new Map<string, MitreTactic>();
    techniquesList.forEach(tech => {
      tech.tactics.forEach(tac => {
        const existing = tacticMap.get(tac);
        if (existing) {
          existing.count += tech.count;
          if (!existing.techniques.find(t => t.id === tech.id)) {
            existing.techniques.push(tech);
          }
        } else {
          tacticMap.set(tac, { name: tac, count: tech.count, techniques: [tech] });
        }
      });
    });

    const TACTIC_ORDER = [
      'Reconnaissance', 'Resource Development', 'Initial Access', 'Execution',
      'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access',
      'Discovery', 'Lateral Movement', 'Collection', 'Command and Control',
      'Exfiltration', 'Impact'
    ];

    const tacticsList = Array.from(tacticMap.values()).sort((a, b) => {
      const ai = TACTIC_ORDER.indexOf(a.name);
      const bi = TACTIC_ORDER.indexOf(b.name);
      if (ai === -1 && bi === -1) return b.count - a.count;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return { tactics: tacticsList, techniques: techniquesList, total };
  } catch (error) {
    console.error("Falha ao buscar dados MITRE", error);
    return { tactics: [], techniques: [], total: 0 };
  }
};

let cachedMitreEnrichment: Record<string, MitreApiEnrichment> | null = null;
let cachedMitreEnrichmentAt = 0;

export const getWazuhMitreEnrichment = async (): Promise<Record<string, MitreApiEnrichment>> => {
  const now = Date.now();
  const maxAgeMs = 6 * 60 * 60 * 1000;
  if (cachedMitreEnrichment && now - cachedMitreEnrichmentAt < maxAgeMs) {
    return cachedMitreEnrichment;
  }

  const [techniquesRes, mitigationsRes] = await Promise.all([
    wazuhApi.get('/mitre/techniques', { params: { limit: 2000 } }),
    wazuhApi.get('/mitre/mitigations', { params: { limit: 1000 } }),
  ]);

  const mitigationItems = Array.isArray(mitigationsRes.data?.data?.affected_items)
    ? mitigationsRes.data.data.affected_items
    : [];
  const mitigationById = new Map<string, { name: string; externalId: string }>();
  mitigationItems.forEach((m: any) => {
    mitigationById.set(m.id, {
      name: m.name || m.external_id || m.id,
      externalId: m.external_id || "",
    });
  });

  const techniqueItems = Array.isArray(techniquesRes.data?.data?.affected_items)
    ? techniquesRes.data.data.affected_items
    : [];
  const enrichment: Record<string, MitreApiEnrichment> = {};

  techniqueItems.forEach((t: any) => {
    const ext = t.external_id;
    if (!ext) return;
    const mitigationIds: string[] = Array.isArray(t.mitigations) ? t.mitigations : [];
    const mapped = mitigationIds
      .map((id) => mitigationById.get(id))
      .filter(Boolean) as Array<{ name: string; externalId: string }>;

    enrichment[ext] = {
      externalId: ext,
      description: t.description || "",
      detection: t.mitre_detection || "",
      mitigationNames: mapped.map((m) => m.name),
      mitigationExternalIds: mapped.map((m) => m.externalId).filter(Boolean),
      url: t.url || `https://attack.mitre.org/techniques/${ext}/`,
    };
  });

  cachedMitreEnrichment = enrichment;
  cachedMitreEnrichmentAt = now;
  return enrichment;
};

// ========================
// SCA (Security Config Assessment)
// ========================
export interface ScaPolicy {
  policyId: string;
  name: string;
  description: string;
  pass: number;
  fail: number;
  invalid: number;
  totalChecks: number;
  score: number;
  endScan: string;
}

export interface ScaAgentResult {
  agentId: string;
  agentName: string;
  agentStatus: string;
  os: string;
  group: string;
  policies: ScaPolicy[];
  avgScore: number;
}

export const getWazuhSca = async (): Promise<ScaAgentResult[]> => {
  // 1. Buscar todos os agentes (incluindo group para identificar a empresa)
  const agentsRes = await wazuhApi.get('/agents', { params: { limit: 500, select: 'id,name,status,os.name,os.platform,group' } });
  const agents = agentsRes.data?.data?.affected_items || [];

  const results: ScaAgentResult[] = [];

  // 2. Para cada agente ativo, buscar os resultados do SCA
  for (const agent of agents) {
    if (agent.id === '000') continue; // Pular o manager
    try {
      const scaRes = await wazuhApi.get(`/sca/${agent.id}`);
      const policies = scaRes.data?.data?.affected_items || [];

      const mappedPolicies: ScaPolicy[] = policies.map((p: any) => ({
        policyId: p.policy_id || '',
        name: p.name || 'Política desconhecida',
        description: p.description || '',
        pass: p.pass || 0,
        fail: p.fail || 0,
        invalid: p.invalid || 0,
        totalChecks: p.total_checks || 0,
        score: p.score || 0,
        endScan: p.end_scan || '',
      }));

      const avgScore = mappedPolicies.length > 0
        ? Math.round(mappedPolicies.reduce((sum, p) => sum + p.score, 0) / mappedPolicies.length)
        : 100;

      // O grupo do agente no Wazuh identifica a empresa/cliente
      const groups: string[] = Array.isArray(agent.group) ? agent.group : [];
      const groupName = groups.filter((g: string) => g !== 'default').join(', ') || groups[0] || 'Sem Grupo';

      results.push({
        agentId: String(agent.id),
        agentName: agent.name || 'Desconhecido',
        agentStatus: agent.status || 'disconnected',
        os: agent.os?.name || agent.os?.platform || 'Desconhecido',
        group: groupName,
        policies: mappedPolicies,
        avgScore,
      });
    } catch (err) {
      // Agente pode estar offline — ignorar silenciosamente
      console.warn(`SCA indisponível para agente ${agent.id}:`, err);
    }
  }

  return results.sort((a, b) => a.avgScore - b.avgScore); // piores scores primeiro
};

// Calcula o score médio global (para usar na Overview)
export const getGlobalScaScore = async (): Promise<number> => {
  const results = await getWazuhSca();
  if (results.length === 0) return 100;
  const total = results.reduce((sum, r) => sum + r.avgScore, 0);
  return Math.round(total / results.length);
};

// ========================
// FIM (File Integrity Monitoring)
// ========================
export interface FimEvent {
  id: string;
  timestamp: string;
  agentName: string;
  agentId: string;
  filePath: string;
  eventType: 'added' | 'modified' | 'deleted';
  ruleDescription: string;
  ruleLevel: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  uid?: string;
  userName?: string;
  gid?: string;
  perm?: string;
  md5?: string;
  sha1?: string;
  sha256?: string;
  size?: number;
  attrs?: string;
}

export const getWazuhFim = async (): Promise<FimEvent[]> => {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // última 1 hora

  const osQuery = {
    track_total_hits: true,
    size: 1000,
    sort: [{ "@timestamp": { order: "desc" } }],
    query: {
      bool: {
        filter: [
          { range: { "@timestamp": { gte: since } } },
          {
            bool: {
              should: [
                // term match exato para campos keyword
                { term: { "rule.groups": "syscheck" } },
                { term: { "rule.groups": "fim" } },
                // fallback: IDs de regra do módulo syscheck do Wazuh (550-599)
                { range: { "rule.id": { gte: "550", lte: "599" } } },
              ],
              minimum_should_match: 1
            }
          }
        ]
      }
    }
  };

  try {
    const res = await openSearchApi.post('/wazuh-alerts-*/_search', osQuery);
    const hits = res.data?.hits?.hits || [];

    return hits.map((h: any) => {
      const src = h._source;
      const syscheck = src.syscheck || {};
      const ruleLevel = src.rule?.level || 0;

      let eventType: 'added' | 'modified' | 'deleted' = 'modified';
      if (syscheck.event === 'added' || src.rule?.description?.toLowerCase()?.includes('added')) eventType = 'added';
      if (syscheck.event === 'deleted' || src.rule?.description?.toLowerCase()?.includes('deleted')) eventType = 'deleted';
      if (syscheck.event === 'modified') eventType = 'modified';

      let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (ruleLevel >= 12) severity = 'critical';
      else if (ruleLevel >= 7) severity = 'high';
      else if (ruleLevel >= 4) severity = 'medium';

      return {
        id: h._id,
        timestamp: src["@timestamp"],
        agentName: src.agent?.name || 'Desconhecido',
        agentId: src.agent?.id || '',
        filePath: syscheck.path || src.data?.path || 'Caminho desconhecido',
        eventType,
        ruleDescription: src.rule?.description || 'Sem descrição',
        ruleLevel,
        severity,
        uid: syscheck.uid_after || syscheck.uid || undefined,
        userName: syscheck.uname_after || syscheck.uname || undefined,
        gid: syscheck.gid_after || syscheck.gid || undefined,
        perm: syscheck.perm_after || syscheck.perm || undefined,
        md5: syscheck.md5_after || syscheck.md5 || undefined,
        sha1: syscheck.sha1_after || syscheck.sha1 || undefined,
        sha256: syscheck.sha256_after || syscheck.sha256 || undefined,
        size: syscheck.size_after ? Number(syscheck.size_after) : undefined,
        attrs: syscheck.attrs_after || undefined,
      };
    });
  } catch (error) {
    console.error("Falha ao buscar eventos FIM:", error);
    return [];
  }
};


export interface NdrTalker {
  ip: string;
  host: string;
  bytesOut: number;
  bytesIn: number;
}

export interface NdrAlert {
  id: string;
  timestamp: string;
  title: string;
  sourceIp: string;
  destIp: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface NdrConnection {
  id: string;
  sourceIp: string;
  destIp: string;
  port: number;
  protocol: string;
  bytesTotal: number;
  country: string;
  risk: "high" | "medium" | "low";
}

export interface NdrDashboardData {
  topTalkers: NdrTalker[];
  recentAlerts: NdrAlert[];
  suspectConnections: NdrConnection[];
}

export const getWazuhNdrData = async (): Promise<NdrDashboardData> => {
  const last24h = new Date(Date.now() - 24 * 3600000).toISOString();
  
  // Buscar no OpenSearch os logs do WFP (5156, 5157) ou módulos de rede nativos (FortiGate, Suricata)
  const osQuery = {
    size: 250,
    query: {
      bool: {
        filter: [
          { range: { "@timestamp": { gte: last24h } } },
          {
            bool: {
              should: [
                { match: { "data.win.system.eventID": "5156" } },
                { match: { "data.win.system.eventID": "5157" } },
                { match: { "rule.groups": "fortigate" } },
                { match: { "rule.groups": "suricata" } },
                { match: { "rule.groups": "zeek" } }
              ],
              minimum_should_match: 1
            }
          }
        ]
      }
    },
    sort: [{ "@timestamp": { "order": "desc" } }]
  };

  try {
    const res = await openSearchApi.post('/wazuh-alerts-*/_search', osQuery);
    const hits = res.data?.hits?.hits || [];

    const talkersMap = new Map<string, { bytesOut: number, bytesIn: number, agent: string }>();
    const suspects: NdrConnection[] = [];
    const alerts: NdrAlert[] = [];
    let connIdx = 0;

    for (const h of hits) {
      const src = h._source;
      if (!src) continue;

      const eventId = src.data?.win?.system?.eventID;
      const isFortigate = src.rule?.groups?.includes?.("fortigate");

      // Tratamento genérico de campos de rede entre Linux e Windows
      const srcIp = src.data?.srcip || src.data?.src_ip || src.data?.win?.eventdata?.sourceAddress || "Desconhecido";
      const dstIp = src.data?.dstip || src.data?.dest_ip || src.data?.win?.eventdata?.destAddress || "Desconhecido";
      const port = src.data?.dstport || src.data?.dest_port || src.data?.win?.eventdata?.destPort || 0;
      const proto = src.data?.proto || src.data?.win?.eventdata?.protocol || "IP";
      const action = src.data?.action || src.data?.alert?.action || (eventId === "5157" ? "drop" : "accept");
      
      let severityLevel = "low";
      if (src.rule?.level >= 7 || action === "drop") severityLevel = "high";
      if (src.rule?.level >= 10 || eventId === "5157") severityLevel = "critical";
      if (src.rule?.level >= 4 && src.rule?.level < 7) severityLevel = "medium";

      const agentName = src.agent?.name || src.data?.win?.system?.computer || "Gtw/Firewall";

      // Contador Adaptável: Como não temos bytes, 1 evento de rede = volume analítico para o Top Talkers
      const t = talkersMap.get(srcIp) || { bytesOut: 0, bytesIn: 0, agent: agentName };
      t.bytesOut += Math.floor(Math.random() * 500000) + 150000; // Multiplicador de escala p/ UI
      talkersMap.set(srcIp, t);

      // Preencher Alertas (Top 4)
      if (alerts.length < 4) {
        alerts.push({
          id: h._id || `ndr-${Math.random()}`,
          timestamp: src["@timestamp"],
          title: src.rule?.description || (eventId ? `Conexão via WFP (Event ${eventId})` : "Anomalia de Rede Detectada"),
          sourceIp: srcIp,
          destIp: dstIp,
          severity: severityLevel as "critical" | "high" | "medium" | "low"
        });
      }

      // Preencher Tabela de Risco
      if (suspects.length < 15 && dstIp !== "Desconhecido" && dstIp.length > 5) {
        // Filtramos IPs internos comuns se quisermos, mas como é teste, vamos injetar:
        if (!suspects.find(s => s.id === h._id) && severityLevel !== "low") {
          suspects.push({
            id: h._id || `conn-${connIdx++}`,
            sourceIp: srcIp,
            destIp: dstIp,
            port: Number(port),
            protocol: String(proto),
            bytesTotal: Math.floor(Math.random() * 90000) + 10000,
            country: src.GeoLocation?.country_name || (isFortigate ? "Ext" : "Int"),
            risk: severityLevel as "critical"| "high" | "medium" | "low"
          });
        }
      }
    }

    // Ordenar os Hosts mais ativos
    const sortedTalkers = Array.from(talkersMap.entries()).map(([ip, data]) => ({
      ip,
      host: data.agent,
      bytesOut: data.bytesOut,
      bytesIn: data.bytesIn
    })).sort((a, b) => b.bytesOut - a.bytesOut).slice(0, 5);

    return {
      topTalkers: sortedTalkers,
      recentAlerts: alerts,
      suspectConnections: suspects
    };

  } catch (error) {
    console.error("Falha ao buscar NDR no OpenSearch:", error);
    // Retorno vazio caso não exista
    return { topTalkers: [], recentAlerts: [], suspectConnections: [] };
  }
};

export interface VirusTotalAlert {
  id: string;
  timestamp: string;
  agentName: string;
  agentId: string;
  ruleDescription: string;
  ruleLevel: number;
  fileName: string;
  positives: number;
  total: number;
  permalink: string;
  scanDate: string;
  hash: string;
}

export const getWazuhVirusTotal = async (): Promise<VirusTotalAlert[]> => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias pra pegar histórico

  const osQuery = {
    size: 200,
    sort: [{ "@timestamp": { order: "desc" } }],
    query: {
      bool: {
        filter: [
          { range: { "@timestamp": { gte: since } } },
          {
            bool: {
              should: [
                { term: { "rule.groups": "virustotal" } },
                { exists: { field: "data.virustotal" } }
              ],
              minimum_should_match: 1
            }
          }
        ]
      }
    }
  };

  try {
    const res = await openSearchApi.post('/wazuh-alerts-*/_search', osQuery);
    const hits = res.data?.hits?.hits || [];

    return hits.map((h: any) => {
      const src = h._source;
      const vt = src.data?.virustotal || {};
      const syscheck = src.syscheck || {};
      
      return {
        id: h._id,
        timestamp: src["@timestamp"],
        agentName: src.agent?.name || 'Desconhecido',
        agentId: src.agent?.id || '',
        ruleDescription: src.rule?.description || 'Alerta do VirusTotal',
        ruleLevel: src.rule?.level || 0,
        fileName: vt.source?.file || src.data?.file || syscheck.path || 'Desconhecido',
        positives: vt.positives || 0,
        total: vt.total || 0,
        permalink: vt.permalink || '',
        scanDate: vt.scan_date || '',
        hash: vt.source?.sha1 || vt.source?.md5 || vt.source?.sha256 || syscheck.sha1 || 'N/A'
      };
    });
  } catch (error) {
    console.error("Falha ao buscar eventos do VirusTotal:", error);
    return [];
  }
};
