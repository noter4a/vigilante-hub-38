import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWazuhSca } from "@/lib/api-client";
import type { ScaAgentResult } from "@/lib/api-client";
import { ShieldCheck, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle, Monitor, Building2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

const scoreColor = (score: number) => {
  if (score >= 80) return "text-[hsl(var(--severity-low))]";
  if (score >= 50) return "text-[hsl(var(--severity-medium))]";
  return "text-[hsl(var(--severity-critical))]";
};

const scoreBarColor = (score: number) => {
  if (score >= 80) return "hsl(var(--severity-low))";
  if (score >= 50) return "hsl(var(--severity-medium))";
  return "hsl(var(--severity-critical))";
};

const scoreBg = (score: number) => {
  if (score >= 80) return "bg-[hsl(var(--severity-low)/0.15)]";
  if (score >= 50) return "bg-[hsl(var(--severity-medium)/0.15)]";
  return "bg-[hsl(var(--severity-critical)/0.15)]";
};

interface CompanyGroup {
  name: string;
  agents: ScaAgentResult[];
  avgScore: number;
  totalAgents: number;
}

const Sca = () => {
  const { data: scaResults, isLoading } = useQuery({
    queryKey: ["wazuh-sca"],
    queryFn: getWazuhSca,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Agrupar por empresa (group do Wazuh)
  const companies = useMemo((): CompanyGroup[] => {
    if (!scaResults) return [];
    const map = new Map<string, ScaAgentResult[]>();
    scaResults.forEach(agent => {
      const group = agent.group;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(agent);
    });

    return Array.from(map.entries()).map(([name, agents]) => ({
      name,
      agents: agents.sort((a, b) => a.avgScore - b.avgScore),
      avgScore: agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.avgScore, 0) / agents.length) : 100,
      totalAgents: agents.length,
    })).sort((a, b) => a.avgScore - b.avgScore);
  }, [scaResults]);

  const globalAvg = useMemo(() => {
    if (!scaResults || scaResults.length === 0) return 100;
    return Math.round(scaResults.reduce((sum, r) => sum + r.avgScore, 0) / scaResults.length);
  }, [scaResults]);

  // Gráfico: Score por empresa
  const chartData = useMemo(() => {
    return companies.slice(0, 10).map(c => ({
      name: c.name.length > 20 ? c.name.slice(0, 18) + "…" : c.name,
      score: c.avgScore,
    }));
  }, [companies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Analisando conformidade de segurança...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Conformidade (SCA)</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Security Configuration Assessment — Score de hardening por empresa e por agente
          </p>
        </div>
      </div>

      {/* Cards de Score Global + Contagem */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="soc-card flex flex-col items-center justify-center py-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Score Médio Global</p>
          <p className={`text-5xl font-mono font-bold ${scoreColor(globalAvg)}`}>{globalAvg}%</p>
          <div className="w-32 h-2 bg-secondary rounded-full mt-3 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${globalAvg}%`, backgroundColor: scoreBarColor(globalAvg) }} />
          </div>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-6">
          <Building2 className="h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-4xl font-mono font-bold text-foreground">{companies.length}</p>
          <p className="text-xs text-muted-foreground">empresas / grupos</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-6">
          <Monitor className="h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-4xl font-mono font-bold text-foreground">{scaResults?.length || 0}</p>
          <p className="text-xs text-muted-foreground">agentes avaliados</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Abaixo de 50%</p>
          <p className="text-4xl font-mono font-bold text-[hsl(var(--severity-critical))]">
            {companies.filter(c => c.avgScore < 50).length}
          </p>
          <p className="text-xs text-muted-foreground">empresas em risco</p>
        </div>
      </div>

      {/* Gráfico de Barras - Score por Empresa */}
      {chartData.length > 0 && (
        <div className="soc-card">
          <h3 className="text-sm font-semibold mb-3">Score por Empresa</h3>
          <div className="h-[280px]">
            <ChartContainer
              className="w-full h-full"
              config={{
                score: { label: "Score (%)", color: "hsl(var(--primary))" },
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} opacity={0.2} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(value: any) => [`${value}%`, 'Score']}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={scoreBarColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      )}

      {/* Acordeão: Empresa → Agentes → Políticas */}
      <div className="soc-card p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Detalhamento por Empresa</h3>
        </div>
        <div className="divide-y divide-border">
          {companies.map((company) => {
            const isCompanyExpanded = expandedCompany === company.name;

            return (
              <div key={company.name}>
                {/* Cabeçalho da Empresa */}
                <button
                  onClick={() => {
                    setExpandedCompany(isCompanyExpanded ? null : company.name);
                    setExpandedAgent(null);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isCompanyExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Building2 className="h-4 w-4 text-primary" />
                    <div>
                      <span className="font-semibold text-sm">{company.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{company.totalAgents} agente{company.totalAgents !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${scoreBg(company.avgScore)} ${scoreColor(company.avgScore)}`}>
                      {company.avgScore}%
                    </div>
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${company.avgScore}%`, backgroundColor: scoreBarColor(company.avgScore) }} />
                    </div>
                  </div>
                </button>

                {/* Agentes da Empresa */}
                {isCompanyExpanded && (
                  <div className="bg-muted/10 border-t border-border">
                    {company.agents.map((agent) => {
                      const isAgentExpanded = expandedAgent === agent.agentId;

                      return (
                        <div key={agent.agentId} className="border-b border-border/50 last:border-b-0">
                          {/* Cabeçalho do Agente */}
                          <button
                            onClick={() => setExpandedAgent(isAgentExpanded ? null : agent.agentId)}
                            className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-accent/30 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              {isAgentExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <span className="font-mono text-sm">{agent.agentName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{agent.os}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${scoreBg(agent.avgScore)} ${scoreColor(agent.avgScore)}`}>
                                {agent.avgScore}%
                              </div>
                              <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${agent.avgScore}%`, backgroundColor: scoreBarColor(agent.avgScore) }} />
                              </div>
                            </div>
                          </button>

                          {/* Políticas do Agente */}
                          {isAgentExpanded && (
                            <div className="bg-muted/20 px-8 py-3 space-y-3">
                              {agent.policies.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhuma política SCA encontrada para este agente ou scan inicial ainda em progresso.</p>
                              ) : (
                                agent.policies.map((policy) => (
                                  <div key={policy.policyId} className="rounded-lg border border-border bg-card p-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <div>
                                        <h4 className="text-sm font-semibold">{policy.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{policy.description}</p>
                                      </div>
                                      <div className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${scoreBg(policy.score)} ${scoreColor(policy.score)}`}>
                                        {policy.score}%
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs">
                                      <div className="flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--severity-low))]" />
                                        <span className="text-muted-foreground">Passou:</span>
                                        <span className="font-mono font-medium">{policy.pass}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <XCircle className="h-3.5 w-3.5 text-[hsl(var(--severity-critical))]" />
                                        <span className="text-muted-foreground">Falhou:</span>
                                        <span className="font-mono font-medium">{policy.fail}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--severity-medium))]" />
                                        <span className="text-muted-foreground">Inválido:</span>
                                        <span className="font-mono font-medium">{policy.invalid}</span>
                                      </div>
                                      {policy.endScan && (
                                        <span className="text-muted-foreground ml-auto">
                                          Último scan: {new Date(policy.endScan).toLocaleString('pt-BR')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(!scaResults || scaResults.length === 0) && (
        <div className="soc-card text-center py-12">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum resultado SCA encontrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Verifique se os agentes estão online e se o módulo SCA está habilitado no ossec.conf.</p>
        </div>
      )}
    </div>
  );
};

export default Sca;
