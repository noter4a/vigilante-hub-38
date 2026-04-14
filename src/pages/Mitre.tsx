import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWazuhMitre, getWazuhMitreEnrichment, MitreTechnique, MitreApiEnrichment } from "@/lib/api-client";
import { formatTimestamp } from "@/lib/soc-utils";
import { Shield, ExternalLink, ChevronDown, ChevronRight, Activity, AlertTriangle, Clock, Monitor } from "lucide-react";
import {
  MITRE_KNOWLEDGE_SNAPSHOT,
  TACTIC_GUIDANCE_MAP,
  TECHNIQUE_GUIDANCE_MAP,
  type TechniqueGuidance,
} from "@/data/mitre-knowledge";

// Cores por tática
const TACTIC_COLORS: Record<string, string> = {
  'Reconnaissance':        'border-blue-500/40 bg-blue-500/5 text-blue-400',
  'Resource Development':  'border-blue-400/40 bg-blue-400/5 text-blue-300',
  'Initial Access':        'border-orange-500/40 bg-orange-500/5 text-orange-400',
  'Execution':             'border-red-500/40 bg-red-500/5 text-red-400',
  'Persistence':           'border-yellow-500/40 bg-yellow-500/5 text-yellow-400',
  'Privilege Escalation':  'border-purple-500/40 bg-purple-500/5 text-purple-400',
  'Defense Evasion':       'border-indigo-500/40 bg-indigo-500/5 text-indigo-400',
  'Credential Access':     'border-pink-500/40 bg-pink-500/5 text-pink-400',
  'Discovery':             'border-cyan-500/40 bg-cyan-500/5 text-cyan-400',
  'Lateral Movement':      'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
  'Collection':            'border-teal-500/40 bg-teal-500/5 text-teal-400',
  'Command and Control':   'border-red-600/40 bg-red-600/5 text-red-500',
  'Exfiltration':          'border-rose-500/40 bg-rose-500/5 text-rose-400',
  'Impact':                'border-red-700/40 bg-red-700/5 text-red-600',
};

const TACTIC_DOT: Record<string, string> = {
  'Reconnaissance':        'bg-blue-500',
  'Resource Development':  'bg-blue-400',
  'Initial Access':        'bg-orange-500',
  'Execution':             'bg-red-500',
  'Persistence':           'bg-yellow-500',
  'Privilege Escalation':  'bg-purple-500',
  'Defense Evasion':       'bg-indigo-500',
  'Credential Access':     'bg-pink-500',
  'Discovery':             'bg-cyan-500',
  'Lateral Movement':      'bg-emerald-500',
  'Collection':            'bg-teal-500',
  'Command and Control':   'bg-red-600',
  'Exfiltration':          'bg-rose-500',
  'Impact':                'bg-red-700',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
  high:     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  medium:   'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  low:      'bg-slate-500/15 text-slate-400 border border-slate-500/30',
};
const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo'
};

function getGuidance(tech: MitreTechnique, enrichment?: Record<string, MitreApiEnrichment>) {
  // Try exact match first (e.g. T1092.001), then base ID (T1092)
  const fromApi = enrichment?.[tech.id] || enrichment?.[tech.id.split('.')[0]];

  // API mitigations list
  const apiMitigations = fromApi?.mitigationNames?.length
    ? fromApi.mitigationNames.map((n, i) => {
        const id = fromApi.mitigationExternalIds?.[i];
        return id ? `${id} – ${n}` : n;
      }).join(' / ')
    : null;

  // Local fallback from tactic map (used only when API has no data)
  const baseTactic = tech.tactics[0];
  const localFallback = TACTIC_GUIDANCE_MAP[baseTactic] || {
    problem: "A técnica indica atividade adversária que exige investigação contextual rápida.",
    solution: "Correlacione os alertas deste host (usuário, rede, processos) para validar o impacto e conter a ameaça.",
    mitreMitigation: "Consulte mitigations oficiais da técnica ATT&CK",
  };
  const localOverride = TECHNIQUE_GUIDANCE_MAP[tech.id.split('.')[0]];
  const local = { ...localFallback, ...localOverride };

  return {
    fromApi,          // full API object — used directly in the UI
    mitreMitigation: apiMitigations || local.mitreMitigation,
    localProblem: local.problem,
    localSolution: local.solution,
  };
}

function TechniqueRow({ tech, enrichment }: { tech: MitreTechnique; enrichment?: Record<string, MitreApiEnrichment> }) {
  const [open, setOpen] = useState(false);
  const guidance = getGuidance(tech, enrichment);
  const sevBadge = SEVERITY_BADGE[tech.severity] || SEVERITY_BADGE.medium;
  const sevLabel = SEVERITY_LABEL[tech.severity] || tech.severity;

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-accent/30 transition-colors ${tech.severity === 'critical' ? 'border-l-2 border-red-500' : tech.severity === 'high' ? 'border-l-2 border-orange-500' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 w-8">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground inline" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline" />}
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          <a
            href={`https://attack.mitre.org/techniques/${tech.id}/`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {tech.id}
          </a>
        </td>
        <td className="px-4 py-3 text-sm font-medium">{tech.name}</td>
        <td className="px-4 py-3">
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${sevBadge}`}>{sevLabel}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {tech.tactics.map(t => (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${TACTIC_COLORS[t] || 'border-border bg-secondary text-muted-foreground'}`}>
                {t}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="font-mono font-semibold text-sm">{tech.count}</span>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(tech.lastSeen)}
        </td>
      </tr>
      {open && (
        <tr className="bg-accent/10">
          <td colSpan={7} className="px-8 py-4">
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                {/* Descrição real da técnica vinda da API MITRE */}
                <div className="rounded border border-border bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-400" />
                    {guidance.fromApi ? 'Sobre a Técnica' : 'Problema Observado'}
                    {guidance.fromApi && (
                      <span className="ml-auto text-[9px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">MITRE ATT&CK API</span>
                    )}
                  </p>
                  <p className="text-xs leading-relaxed">
                    {guidance.fromApi?.description || guidance.localProblem}
                  </p>
                </div>
                {/* Detecção real da técnica vinda da API MITRE */}
                <div className="rounded border border-border bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    {guidance.fromApi ? 'Como Detectar' : 'Ação Recomendada'}
                    {guidance.fromApi && (
                      <span className="ml-auto text-[9px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">MITRE ATT&CK API</span>
                    )}
                  </p>
                  <p className="text-xs leading-relaxed">
                    {guidance.fromApi?.detection || guidance.localSolution}
                  </p>
                </div>
              </div>
              {/* Histórico de Ocorrências */}
              {tech.occurrences && tech.occurrences.length > 0 && (
                <div className="mt-3 rounded border border-border bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Histórico de Ocorrências ({tech.occurrences.length})
                  </p>
                  <div className="max-h-[240px] overflow-y-auto space-y-0 pr-1">
                    {tech.occurrences
                      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                      .map((occ, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-b-0">
                        <div className="flex flex-col items-center mt-0.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            occ.ruleLevel >= 12 ? 'bg-red-500' :
                            occ.ruleLevel >= 10 ? 'bg-orange-500' :
                            occ.ruleLevel >= 7 ? 'bg-yellow-500' : 'bg-slate-400'
                          }`} />
                          {idx < tech.occurrences.length - 1 && <div className="w-px h-full bg-border/40 mt-0.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {new Date(occ.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded">
                              <Monitor className="h-2.5 w-2.5" />{occ.agentName}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              occ.ruleLevel >= 12 ? 'bg-red-500/15 text-red-400' :
                              occ.ruleLevel >= 10 ? 'bg-orange-500/15 text-orange-400' :
                              occ.ruleLevel >= 7 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-slate-500/15 text-slate-400'
                            }`}>Nível {occ.ruleLevel}</span>
                          </div>
                          <p className="text-xs text-foreground/80 mt-0.5 truncate">{occ.ruleDescription}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Agentes afetados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tech.agents.map(a => (
                      <span key={a} className="text-xs font-mono bg-secondary px-2 py-0.5 rounded border border-border">{a}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Mitigação: <span className="text-foreground">{guidance.mitreMitigation}</span>
                  </div>
                  <a
                    href={`https://attack.mitre.org/techniques/${tech.id}/`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver na base MITRE ATT&CK
                  </a>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const Mitre = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["mitre"],
    queryFn: getWazuhMitre,
    refetchInterval: 60000,
    retry: 1,
  });
  const { data: mitreEnrichment } = useQuery({
    queryKey: ["mitre-enrichment"],
    queryFn: getWazuhMitreEnrichment,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
  const [activeTab, setActiveTab] = useState<'tactics' | 'techniques'>('tactics');
  const [sevFilter, setSevFilter] = useState<'' | 'critical' | 'high' | 'medium'>('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse">Carregando mapeamento MITRE ATT&CK...</div>
      </div>
    );
  }

  const { tactics = [], techniques = [], total = 0 } = data || {};

  const filteredTechniques = sevFilter
    ? techniques.filter(t => t.severity === sevFilter)
    : techniques;

  const criticalCount = techniques.filter(t => t.severity === 'critical').length;
  const highCount = techniques.filter(t => t.severity === 'high').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            MITRE ATT&CK
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} evento{total !== 1 ? 's' : ''} accionável{total !== 1 ? 's' : ''} · {techniques.length} técnica{techniques.length !== 1 ? 's' : ''} · {tactics.length} tática{tactics.length !== 1 ? 's' : ''}
            {criticalCount > 0 && <span className="text-red-400 ml-2 font-medium">· {criticalCount} crítica{criticalCount > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <a
          href="https://attack.mitre.org/"
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded px-3 py-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          attack.mitre.org
        </a>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Base de conhecimento: {MITRE_KNOWLEDGE_SNAPSHOT.source} · atualização {MITRE_KNOWLEDGE_SNAPSHOT.updatedAt}
        {' '}· Filtrando apenas eventos de nível 4+ (Médio/Alto/Crítico)
      </p>

      {/* Banners de alerta */}
      {criticalCount > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">{criticalCount} técnica{criticalCount > 1 ? 's' : ''} crítica{criticalCount > 1 ? 's' : ''} detectada{criticalCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">Requer investigação imediata. Expanda cada linha na aba Técnicas para ver ação recomendada.</p>
          </div>
        </div>
      )}
      {!criticalCount && highCount > 0 && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-400">{highCount} técnica{highCount > 1 ? 's' : ''} de alta severidade detectada{highCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">Priorize investigação. Verifique artefatos nos agentes afetados.</p>
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="soc-card flex flex-col items-center justify-center py-16 text-center gap-3">
          <Activity className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Nenhum alerta relevante com mapeamento MITRE</p>
            <p className="text-sm text-muted-foreground mt-1">
              Apenas alertas de nível Médio ou superior são exibidos aqui para eliminar ruído.
              <br />Alertas informacionais (logins normais etc.) são filtrados automaticamente.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs + filtro de severidade */}
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex gap-2">
              {(['tactics', 'techniques'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'tactics' ? `Táticas (${tactics.length})` : `Técnicas (${filteredTechniques.length})`}
                </button>
              ))}
            </div>
            {activeTab === 'techniques' && (
              <div className="flex gap-1 pb-1">
                {(['', 'critical', 'high', 'medium'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSevFilter(s)}
                    className={`text-[11px] px-2.5 py-1 rounded font-mono transition-colors border ${
                      sevFilter === s
                        ? s === 'critical' ? 'bg-red-500/20 border-red-500/50 text-red-300'
                          : s === 'high' ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : s === 'medium' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                          : 'bg-primary/20 border-primary/50 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === '' ? 'Todos' : SEVERITY_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Táticas */}
          {activeTab === 'tactics' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tactics.map(tactic => {
                const colorClass = TACTIC_COLORS[tactic.name] || 'border-border bg-secondary/30 text-foreground';
                const dotClass = TACTIC_DOT[tactic.name] || 'bg-muted-foreground';
                return (
                  <div key={tactic.name} className={`rounded-lg border p-4 space-y-3 ${colorClass}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                        <span className="text-sm font-semibold">{tactic.name}</span>
                      </div>
                      <span className="font-mono font-bold text-lg">{tactic.count}</span>
                    </div>
                    <div className="space-y-1">
                      {tactic.techniques.slice(0, 4).map(tech => (
                        <div key={tech.id} className="flex items-center justify-between text-xs opacity-80">
                          <a
                            href={`https://attack.mitre.org/techniques/${tech.id}/`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-mono hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            {tech.id}
                          </a>
                          <span className="truncate max-w-[120px] text-right mx-1">{tech.name}</span>
                          <span className="font-mono font-semibold ml-auto">×{tech.count}</span>
                        </div>
                      ))}
                      {tactic.techniques.length > 4 && (
                        <p className="text-xs opacity-60">+{tactic.techniques.length - 4} técnica(s)</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Técnicas */}
          {activeTab === 'techniques' && (
            <div className="soc-card p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 w-8"></th>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Técnica</th>
                    <th className="px-4 py-3 text-left">Severidade</th>
                    <th className="px-4 py-3 text-left">Táticas</th>
                    <th className="px-4 py-3 text-center">Ocorrências</th>
                    <th className="px-4 py-3 text-left">Último Evento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTechniques.map(tech => (
                    <TechniqueRow key={tech.id} tech={tech} enrichment={mitreEnrichment} />
                  ))}
                </tbody>
              </table>
              {filteredTechniques.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">Nenhuma técnica com severidade "{SEVERITY_LABEL[sevFilter]}" encontrada.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Mitre;
