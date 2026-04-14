import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { getWazuhClientSummary } from "@/lib/api-client";
import {
  severityBadgeClass, riskBadgeClass, riskLabels, severityLabels,
  timeAgo, formatTimestamp, severityTextClass, scoreColorClass, scoreLabel, scoreProgressColor,
} from "@/lib/soc-utils";
import { ArrowLeft, AlertTriangle, Monitor, Bug, Clock, ShieldCheck } from "lucide-react";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["client-summary", id],
    queryFn: () => getWazuhClientSummary(id!),
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const { client, alertsBySeverity, agentsOnline, agentsOffline, vulnerabilitiesBySeverity, recentEvents } = data;
  const severities = ["critical", "high", "medium", "low"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-1.5 rounded hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded font-mono ${riskBadgeClass(client.riskLevel)}`}>
            Risco {riskLabels[client.riskLevel]}
          </span>
        </div>
      </div>

      {/* Security Score */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Security Score
        </h2>
        <div className="soc-card flex items-center gap-6">
          <div className="text-center">
            <div className={`text-4xl font-mono font-bold ${scoreColorClass(client.securityScore)}`}>
              {client.securityScore}
            </div>
            <div className={`text-xs mt-1 font-medium ${scoreColorClass(client.securityScore)}`}>
              {scoreLabel(client.securityScore)}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreProgressColor(client.securityScore)}`}
                style={{ width: `${client.securityScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              0 = ambiente limpo · acumula pontos por alertas e vulnerabilidades ativas
            </p>
          </div>
        </div>
      </div>

      {/* Alerts by severity */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Alertas por Severidade
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {severities.map((s) => (
            <div key={s} className="soc-card text-center">
              <div className={`text-2xl font-mono font-bold ${severityTextClass(s)}`}>
                {alertsBySeverity[s]}
              </div>
              <div className="text-xs text-muted-foreground mt-1 capitalize">{severityLabels[s]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agents */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Monitor className="h-4 w-4" /> Agentes
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="soc-card text-center">
            <div className="text-2xl font-mono font-bold status-online">{agentsOnline}</div>
            <div className="text-xs text-muted-foreground mt-1">Online</div>
          </div>
          <div className="soc-card text-center">
            <div className="text-2xl font-mono font-bold status-offline">{agentsOffline}</div>
            <div className="text-xs text-muted-foreground mt-1">Offline</div>
          </div>
        </div>
      </div>

      {/* Vulnerabilities by severity */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Bug className="h-4 w-4" /> Vulnerabilidades por Severidade
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {severities.map((s) => (
            <div key={s} className="soc-card text-center">
              <div className={`text-2xl font-mono font-bold ${severityTextClass(s)}`}>
                {vulnerabilitiesBySeverity[s]}
              </div>
              <div className="text-xs text-muted-foreground mt-1 capitalize">{severityLabels[s]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Eventos Recentes
        </h2>
        <div className="soc-card p-0">
          <div className="divide-y divide-border">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-severity-${event.severity}`}
                  style={{ backgroundColor: `hsl(var(--severity-${event.severity}))` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{event.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${severityBadgeClass(event.severity)}`}>
                      {severityLabels[event.severity]}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{timeAgo(event.timestamp)}</span>
                    <span className="text-xs text-muted-foreground font-mono">{event.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;
