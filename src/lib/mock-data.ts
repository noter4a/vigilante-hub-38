import type { Client, ClientSummary, Alert, Agent, Vulnerability, Severity } from "@/types/api";

const clients: Client[] = [
  { id: "c1", name: "Banco Meridional S.A.", riskLevel: "high", criticalAlerts24h: 12, agentsOnline: 45, agentsOffline: 3, criticalVulnerabilities: 28, securityScore: 0 },
  { id: "c2", name: "TechCorp Ltda", riskLevel: "medium", criticalAlerts24h: 3, agentsOnline: 120, agentsOffline: 8, criticalVulnerabilities: 15, securityScore: 0 },
  { id: "c3", name: "Saúde+", riskLevel: "low", criticalAlerts24h: 0, agentsOnline: 32, agentsOffline: 1, criticalVulnerabilities: 2, securityScore: 0 },
  { id: "c4", name: "LogiTrans Transportes", riskLevel: "medium", criticalAlerts24h: 5, agentsOnline: 67, agentsOffline: 12, criticalVulnerabilities: 9, securityScore: 0 },
  { id: "c5", name: "EduNet Educação", riskLevel: "high", criticalAlerts24h: 8, agentsOnline: 89, agentsOffline: 15, criticalVulnerabilities: 34, securityScore: 0 },
  { id: "c6", name: "Varejo Express", riskLevel: "low", criticalAlerts24h: 1, agentsOnline: 200, agentsOffline: 5, criticalVulnerabilities: 4, securityScore: 0 },
];

const alertTypes = [
  "Brute Force SSH", "Malware Detected", "Suspicious Process", "File Integrity Change",
  "Unauthorized Access", "Port Scan Detected", "Privilege Escalation", "Ransomware Indicator",
  "SQL Injection Attempt", "XSS Attempt", "DDoS Pattern", "Rootkit Detection",
];

const hosts = [
  "srv-web-01", "srv-db-02", "ws-admin-03", "fw-edge-01", "srv-app-04",
  "srv-mail-01", "ws-dev-12", "srv-backup-01", "srv-dns-01", "ws-finance-05",
];

const oses = ["Ubuntu 22.04 LTS", "Windows Server 2022", "CentOS 8", "Debian 12", "Windows 11 Pro", "RHEL 9"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAlerts(): Alert[] {
  const severities: Severity[] = ["critical", "high", "medium", "low"];
  const statuses: Alert["status"][] = ["open", "in_progress", "resolved"];
  const alerts: Alert[] = [];

  for (let i = 0; i < 80; i++) {
    const client = randomFrom(clients);
    const hoursAgo = Math.floor(Math.random() * 72);
    const date = new Date(Date.now() - hoursAgo * 3600000);

    alerts.push({
      id: `alert-${i}`,
      timestamp: date.toISOString(),
      severity: randomFrom(severities),
      type: randomFrom(alertTypes),
      host: `${randomFrom(hosts)}.${client.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}.local`,
      agentId: `agent-${Math.floor(Math.random() * 200)}`,
      clientId: client.id,
      clientName: client.name,
      status: randomFrom(statuses),
    });
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateAgents(): Agent[] {
  const agents: Agent[] = [];
  let idx = 0;

  for (const client of clients) {
    const total = client.agentsOnline + client.agentsOffline;
    for (let i = 0; i < total; i++) {
      const isOnline = i < client.agentsOnline;
      const hoursAgo = isOnline ? Math.floor(Math.random() * 1) : Math.floor(Math.random() * 48) + 2;
      agents.push({
        id: `agent-${idx++}`,
        hostname: `${randomFrom(hosts)}-${idx}.${client.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}.local`,
        os: randomFrom(oses),
        status: isOnline ? "online" : "offline",
        lastCommunication: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
        clientId: client.id,
        clientName: client.name,
      });
    }
  }

  return agents;
}

const cves = [
  "CVE-2024-3094", "CVE-2024-21626", "CVE-2023-44487", "CVE-2023-4863",
  "CVE-2024-0204", "CVE-2023-46805", "CVE-2024-1709", "CVE-2023-22527",
  "CVE-2024-27198", "CVE-2023-36884", "CVE-2024-20353", "CVE-2023-20198",
];

const packages = [
  "xz-utils 5.6.0", "runc 1.1.11", "nghttp2 1.57.0", "libwebp 1.3.1",
  "openssl 3.0.12", "curl 8.4.0", "sudo 1.9.15", "openssh 9.5",
];

function generateVulnerabilities(): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  let idx = 0;

  for (const client of clients) {
    const count = Math.floor(Math.random() * 15) + 5;
    for (let i = 0; i < count; i++) {
      vulns.push({
        id: `vuln-${idx++}`,
        cve: randomFrom(cves),
        severity: randomFrom(["critical", "high", "medium", "low"] as Severity[]),
        affectedPackage: randomFrom(packages),
        affectedHost: `${randomFrom(hosts)}-${idx}.${client.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}.local`,
        clientId: client.id,
        clientName: client.name,
        status: Math.random() > 0.3 ? "open" : "mitigated",
      });
    }
  }

  return vulns;
}

// Pre-generate data
const allAlerts = generateAlerts();
const allAgents = generateAgents();
const allVulnerabilities = generateVulnerabilities();

// Calculate security scores based on vulnerabilities
function calculateSecurityScore(clientId: string): number {
  const vulns = allVulnerabilities.filter((v) => v.clientId === clientId);
  if (vulns.length === 0) return 100;
  const mitigated = vulns.filter((v) => v.status === "mitigated").length;
  const total = vulns.length;
  const mitigationRatio = mitigated / total;
  // Weight by severity: open critical/high vulns penalize more
  const openVulns = vulns.filter((v) => v.status === "open");
  const severityPenalty = openVulns.reduce((acc, v) => {
    const weights = { critical: 10, high: 6, medium: 3, low: 1 };
    return acc + weights[v.severity];
  }, 0);
  const maxPenalty = total * 10;
  const penaltyRatio = Math.min(severityPenalty / maxPenalty, 1);
  return Math.round(Math.max(0, Math.min(100, mitigationRatio * 50 + (1 - penaltyRatio) * 50)));
}

// Apply scores to clients
clients.forEach((c) => { c.securityScore = calculateSecurityScore(c.id); });

// Simulated API functions
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchClients(): Promise<Client[]> {
  await delay(300);
  return clients;
}

export async function fetchClientSummary(clientId: string): Promise<ClientSummary> {
  await delay(300);
  const client = clients.find((c) => c.id === clientId)!;
  const clientAlerts = allAlerts.filter((a) => a.clientId === clientId);
  const clientAgents = allAgents.filter((a) => a.clientId === clientId);
  const clientVulns = allVulnerabilities.filter((v) => v.clientId === clientId);

  const countBy = <T extends string>(items: { severity: T }[]): Record<Severity, number> => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    items.forEach((i) => counts[i.severity as Severity]++);
    return counts;
  };

  return {
    client,
    alertsBySeverity: countBy(clientAlerts),
    agentsOnline: clientAgents.filter((a) => a.status === "online").length,
    agentsOffline: clientAgents.filter((a) => a.status === "offline").length,
    vulnerabilitiesBySeverity: countBy(clientVulns),
    recentEvents: clientAlerts.slice(0, 15).map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      description: `${a.type} em ${a.host}`,
      severity: a.severity,
      source: a.host,
    })),
  };
}

export async function fetchAlerts(): Promise<Alert[]> {
  await delay(300);
  return allAlerts;
}

export async function fetchAgents(): Promise<Agent[]> {
  await delay(300);
  return allAgents;
}

export async function fetchVulnerabilities(): Promise<Vulnerability[]> {
  await delay(300);
  return allVulnerabilities;
}
