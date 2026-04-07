import type { Severity, RiskLevel, AlertStatus, AgentStatus, VulnStatus } from "@/types/api";

export function severityBadgeClass(severity: Severity): string {
  return `severity-badge-${severity}`;
}

export function severityTextClass(severity: Severity): string {
  return `severity-${severity}`;
}

export function riskBadgeClass(risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    high: "severity-badge-critical",
    medium: "severity-badge-medium",
    low: "severity-badge-low",
  };
  return map[risk];
}

export function statusBadgeClass(status: AlertStatus): string {
  const map: Record<AlertStatus, string> = {
    open: "severity-badge-critical",
    in_progress: "severity-badge-medium",
    resolved: "severity-badge-low",
  };
  return map[status];
}

export function agentStatusClass(status: AgentStatus): string {
  return status === "online" ? "status-online" : "status-offline";
}

export function vulnStatusBadgeClass(status: VulnStatus): string {
  return status === "open" ? "severity-badge-high" : "severity-badge-low";
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export const statusLabels: Record<AlertStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

export const severityLabels: Record<Severity, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};
