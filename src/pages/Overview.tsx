import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getOverviewStats, getWazuhAlerts, getWazuhVulnerabilities, getWazuhStackHealth, getWazuhAgentsOperationalSummary, getWazuhMitre } from "@/lib/api-client";
import { riskBadgeClass, riskLabels, scoreColorClass, scoreLabel, scoreProgressColor } from "@/lib/soc-utils";
import { Shield, AlertTriangle, Monitor, Bug, ShieldCheck } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, PieChart, Pie, Tooltip as RechartsTooltip, Legend } from "recharts";
import type { Client } from "@/types/api";

const Overview = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: getOverviewStats,
  });
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts-overview"], queryFn: getWazuhAlerts });
  const { data: vulns = [] } = useQuery({ queryKey: ["vulns-overview"], queryFn: getWazuhVulnerabilities });
  const { data: mitreData } = useQuery({ queryKey: ["mitre-overview"], queryFn: getWazuhMitre });
  const { data: agentsOps } = useQuery({
    queryKey: ["agents-ops-summary"],
    queryFn: getWazuhAgentsOperationalSummary,
    refetchInterval: 60000
  });
  const { data: stackHealth } = useQuery({
    queryKey: ["wazuh-stack-health"],
    queryFn: getWazuhStackHealth,
    refetchInterval: 60000
  });

  const clients: Client[] = useMemo(() => {
    return stats || [];
  }, [stats]);

  const mitreTacticData = useMemo(() => {
    if (!mitreData || !mitreData.tactics) return [];
    
    // Paleta de cores dinâmica e temática SOC
    const colors = [
      "hsl(var(--primary))",
      "hsl(var(--severity-high))",
      "hsl(var(--severity-medium))",
      "hsl(var(--severity-low))",
      "hsl(var(--muted-foreground))"
    ];

    return mitreData.tactics
      .slice(0, 5) // Top 5
      .map((t, i) => ({
        name: t.name,
        count: t.count,
        fill: colors[i % colors.length]
      }));
  }, [mitreData]);

  const trendData = useMemo(() => {
    const now = new Date();
    const points = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      return {
        dateTs: new Date(d.setHours(0, 0, 0, 0)).getTime(),
        day: d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }),
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
    });

    alerts.forEach((a) => {
      const ts = new Date(a.timestamp).getTime();
      if (!Number.isFinite(ts)) return;
      
      const dayTs = new Date(ts).setHours(0, 0, 0, 0);
      const index = points.findIndex((p) => p.dateTs === dayTs);
      
      if (index >= 0) {
        if (a.severity === "critical") points[index].critical++;
        else if (a.severity === "high") points[index].high++;
        else if (a.severity === "medium") points[index].medium++;
        else points[index].low++;
      }
    });

    return points;
  }, [alerts]);

  const trendData24h = useMemo(() => {
    const now = new Date();
    const points = Array.from({ length: 24 }).map((_, i) => {
      const d = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      d.setMinutes(0, 0, 0); // Trunca para o começo da hora
      return {
        dateTs: d.getTime(),
        time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
    });

    alerts.forEach((a) => {
      const ts = new Date(a.timestamp).getTime();
      if (!Number.isFinite(ts)) return;
      
      const dEvent = new Date(ts);
      dEvent.setMinutes(0, 0, 0); // trunca evento pra hora
      const hourTs = dEvent.getTime();
      
      const index = points.findIndex((p) => p.dateTs === hourTs);
      
      if (index >= 0) {
        if (a.severity === "critical") points[index].critical++;
        else if (a.severity === "high") points[index].high++;
        else if (a.severity === "medium") points[index].medium++;
        else points[index].low++;
      }
    });

    return points;
  }, [alerts]);

  const topAgentsData = useMemo(() => {
    const scoreByHost = new Map<string, { host: string; crit: number; high: number; vuln: number; score: number }>();
    const upsertHost = (host: string) => {
      if (!scoreByHost.has(host)) {
        scoreByHost.set(host, { host, crit: 0, high: 0, vuln: 0, score: 0 });
      }
      return scoreByHost.get(host)!;
    };

    alerts.forEach((a) => {
      const host = a.host || "Desconhecido";
      const item = upsertHost(host);
      if (a.severity === "critical") item.crit++;
      if (a.severity === "high") item.high++;
    });

    vulns.forEach((v) => {
      if (v.status !== "open") return;
      const host = v.affectedHost || "Desconhecido";
      const item = upsertHost(host);
      item.vuln++;
    });

    return Array.from(scoreByHost.values())
      .map((i) => ({ ...i, score: i.crit * 3 + i.high * 2 + i.vuln * 3 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [alerts, vulns]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitoramento de {clients?.length} clientes
        </p>
      </div>

      <div className="grid gap-4">
        {clients.map((client) => (
          <div
            key={client.id}
            onClick={() => navigate(`/clients/${client.id}`)}
            className="soc-card cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">{client.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${riskBadgeClass(client.riskLevel)}`}>
                    Risco {riskLabels[client.riskLevel]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-2" title={`Score: ${client.securityScore} - ${scoreLabel(client.securityScore)}`}>
                  <ShieldCheck className={`h-4 w-4 ${scoreColorClass(client.securityScore)}`} />
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-semibold ${scoreColorClass(client.securityScore)}`}>{client.securityScore}</span>
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreProgressColor(client.securityScore)}`} style={{ width: `${client.securityScore}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" title="Alertas críticos (24h)">
                  <AlertTriangle className="h-4 w-4 severity-critical" />
                  <span className="font-mono severity-critical font-semibold">{client.criticalAlerts24h}</span>
                </div>

                <div className="flex items-center gap-2" title="Agentes online / offline">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">
                    <span className="status-online">{client.agentsOnline}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="status-offline">{client.agentsOffline}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2" title="Vulnerabilidades críticas">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{client.criticalVulnerabilities}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>


      <div className="soc-card">
        <h3 className="text-sm font-semibold mb-3">Resumo operacional de agentes</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Agentes ativos</p>
            <p className="font-mono text-sm mt-1 status-online">{agentsOps?.active ?? 0}</p>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Desconectados</p>
            <p className="font-mono text-sm mt-1 status-offline">{agentsOps?.disconnected ?? 0}</p>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Configuração não sincronizada</p>
            <p className={`font-mono text-sm mt-1 ${(agentsOps?.notSynced ?? 0) > 0 ? "text-yellow-400" : "status-online"}`}>
              {agentsOps?.notSynced ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="text-xs text-muted-foreground">Famílias de SO</p>
            <p className="font-mono text-sm mt-1">{agentsOps?.osFamilies?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {(agentsOps?.osFamilies || []).join(", ") || "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="soc-card relative lg:col-span-1">
          <h3 className="text-sm font-semibold mb-3">Táticas MITRE ATT&CK (Principais)</h3>
          {mitreTacticData.length > 0 ? (
            <div className="h-[260px] w-full flex items-center justify-center">
              <PieChart width={300} height={260}>
                <Pie
                  data={mitreTacticData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  stroke="none"
                  paddingAngle={2}
                >
                  {mitreTacticData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </div>
          ) : (
            <div className="h-[260px] w-full flex items-center justify-center text-muted-foreground text-sm">
              Sem dados de táticas MITRE
            </div>
          )}
        </div>

        <div className="soc-card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Evolução de Ameaças (Últimos 7 dias)</h3>
          <ChartContainer 
            className="h-[260px] w-full" 
            config={{ 
              critical: { label: "Crítico", color: "hsl(var(--severity-critical))" },
              high: { label: "Alto", color: "hsl(var(--severity-high))" },
              medium: { label: "Médio", color: "hsl(var(--severity-medium))" }
            }}
          >
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-critical)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-critical)" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="fillHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-high)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-high)" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="fillMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-medium)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-medium)" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={30} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="var(--color-medium)" fill="url(#fillMedium)" strokeWidth={2} />
              <Area type="monotone" dataKey="high" stackId="1" stroke="var(--color-high)" fill="url(#fillHigh)" strokeWidth={2} />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="var(--color-critical)" fill="url(#fillCritical)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="soc-card">
          <h3 className="text-sm font-semibold mb-3">Evolução de Ameaças (Últimas 24 horas)</h3>
          <ChartContainer 
            className="h-[320px] w-full" 
            config={{ 
              critical: { label: "Crítico", color: "hsl(var(--severity-critical))" },
              high: { label: "Alto", color: "hsl(var(--severity-high))" },
              medium: { label: "Médio", color: "hsl(var(--severity-medium))" }
            }}
          >
            <AreaChart data={trendData24h} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCritical24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-critical)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-critical)" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="fillHigh24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-high)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-high)" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="fillMedium24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-medium)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-medium)" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={30} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="var(--color-medium)" fill="url(#fillMedium24)" strokeWidth={2} />
              <Area type="monotone" dataKey="high" stackId="1" stroke="var(--color-high)" fill="url(#fillHigh24)" strokeWidth={2} />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="var(--color-critical)" fill="url(#fillCritical24)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="soc-card">
          <h3 className="text-sm font-semibold mb-3">Top 10 agentes mais críticos</h3>
          <ChartContainer className="h-[320px] w-full" config={{ score: { label: "Score de risco", color: "hsl(var(--primary))" } }}>
            <BarChart data={topAgentsData} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="host" width={140} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="score" radius={6}>
                {topAgentsData.map((entry) => (
                  <Cell key={entry.host} fill={entry.score >= 12 ? "hsl(var(--severity-critical))" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
};

export default Overview;
