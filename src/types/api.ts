export type Severity = "critical" | "high" | "medium" | "low";
export type RiskLevel = "low" | "medium" | "high";
export type AlertStatus = "open" | "in_progress" | "resolved";
export type AgentStatus = "online" | "offline";
export type VulnStatus = "open" | "mitigated";

export interface Client {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  criticalAlerts24h: number;
  agentsOnline: number;
  agentsOffline: number;
  criticalVulnerabilities: number;
  securityScore: number;
}

export interface ClientSummary {
  client: Client;
  alertsBySeverity: Record<Severity, number>;
  agentsOnline: number;
  agentsOffline: number;
  vulnerabilitiesBySeverity: Record<Severity, number>;
  recentEvents: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  description: string;
  severity: Severity;
  source: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  severity: Severity;
  type: string;
  description?: string;
  host: string;
  agentId: string;
  clientId: string;
  clientName: string;
  status: AlertStatus;
  source?: string;
}

export interface Agent {
  id: string;
  hostname: string;
  os: string;
  status: AgentStatus;
  lastCommunication: string;
  clientId: string;
  clientName: string;
  group: string;
}

export interface Vulnerability {
  id: string;
  cve: string;
  severity: Severity;
  description?: string;
  reference?: string;
  affectedPackage: string;
  affectedHost: string;
  clientId: string;
  clientName: string;
  status: VulnStatus;
}
