import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWazuhFim } from "@/lib/api-client";
import type { FimEvent } from "@/lib/api-client";
import { FileWarning, FilePlus2, FileX2, FileEdit, Filter, Monitor, Hash, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

const eventTypeConfig = {
  added: { label: "Adicionado", icon: FilePlus2, color: "text-[hsl(var(--severity-low))]", bg: "bg-[hsl(var(--severity-low)/0.15)]", fill: "hsl(var(--severity-low))" },
  modified: { label: "Modificado", icon: FileEdit, color: "text-[hsl(var(--severity-medium))]", bg: "bg-[hsl(var(--severity-medium)/0.15)]", fill: "hsl(var(--severity-medium))" },
  deleted: { label: "Removido", icon: FileX2, color: "text-[hsl(var(--severity-critical))]", bg: "bg-[hsl(var(--severity-critical)/0.15)]", fill: "hsl(var(--severity-critical))" },
};

const Fim = () => {
  const { data: fimEvents = [], isLoading } = useQuery({
    queryKey: ["wazuh-fim"],
    queryFn: getWazuhFim,
    refetchInterval: 60_000,   // rebusca a cada 60 segundos
    staleTime: 30_000,         // considera os dados "velhos" após 30s
  });

  const [selectedHost, setSelectedHost] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const hosts = useMemo(() => {
    const set = new Set<string>();
    fimEvents.forEach(e => set.add(e.agentName));
    return Array.from(set).sort();
  }, [fimEvents]);

  const filtered = useMemo(() => {
    return fimEvents.filter(e => {
      if (selectedHost && e.agentName !== selectedHost) return false;
      if (selectedType && e.eventType !== selectedType) return false;
      return true;
    });
  }, [fimEvents, selectedHost, selectedType]);

  const stats = useMemo(() => {
    const added = filtered.filter(e => e.eventType === 'added').length;
    const modified = filtered.filter(e => e.eventType === 'modified').length;
    const deleted = filtered.filter(e => e.eventType === 'deleted').length;
    return { added, modified, deleted, total: filtered.length };
  }, [filtered]);

  const pieData = useMemo(() => [
    { name: "Adicionado", value: stats.added, fill: eventTypeConfig.added.fill },
    { name: "Modificado", value: stats.modified, fill: eventTypeConfig.modified.fill },
    { name: "Removido", value: stats.deleted, fill: eventTypeConfig.deleted.fill },
  ].filter(d => d.value > 0), [stats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Analisando integridade de arquivos...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileWarning className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Integridade de Arquivos (FIM)</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            File Integrity Monitoring — Alterações em arquivos críticos na última hora
          </p>
        </div>
      </div>

      {/* Resumo + Gráfico Donut */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total de Eventos</p>
          <p className="text-4xl font-mono font-bold">{stats.total}</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <FilePlus2 className="h-5 w-5 text-[hsl(var(--severity-low))] mb-1" />
          <p className="text-2xl font-mono font-bold text-[hsl(var(--severity-low))]">{stats.added}</p>
          <p className="text-xs text-muted-foreground">Adicionados</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <FileEdit className="h-5 w-5 text-[hsl(var(--severity-medium))] mb-1" />
          <p className="text-2xl font-mono font-bold text-[hsl(var(--severity-medium))]">{stats.modified}</p>
          <p className="text-xs text-muted-foreground">Modificados</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <FileX2 className="h-5 w-5 text-[hsl(var(--severity-critical))] mb-1" />
          <p className="text-2xl font-mono font-bold text-[hsl(var(--severity-critical))]">{stats.deleted}</p>
          <p className="text-xs text-muted-foreground">Removidos</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gráfico Donut */}
        {pieData.length > 0 && (
          <div className="soc-card flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-2 self-start">Distribuição por Tipo</h3>
            <div className="h-[220px] w-full flex items-center justify-center">
              <PieChart width={250} height={220}>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} stroke="none" paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="lg:col-span-2 soc-card">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Filtros</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={selectedHost} onChange={(e) => setSelectedHost(e.target.value)}
              className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]">
              <option value="">Todos os hosts</option>
              {hosts.map(h => <option key={h} value={h}>{h}</option>)}
            </select>

            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
              className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm">
              <option value="">Todos os tipos</option>
              <option value="added">Adicionado</option>
              <option value="modified">Modificado</option>
              <option value="deleted">Removido</option>
            </select>
          </div>

          {/* Mini Resumo Filtrado */}
          <div className="mt-4 p-3 bg-background/50 rounded border border-border">
            <p className="text-xs text-muted-foreground">
              Mostrando <span className="font-mono font-bold text-foreground">{filtered.length}</span> eventos
              {selectedHost && <> do host <span className="font-mono text-primary">{selectedHost}</span></>}
              {selectedType && <> do tipo <span className="font-mono">{eventTypeConfig[selectedType as keyof typeof eventTypeConfig]?.label}</span></>}
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Eventos FIM */}
      <div className="soc-card p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Eventos Recentes de Integridade</h3>
        </div>
        <div className="divide-y divide-border">
          {filtered.slice(0, 50).map(event => {
            const cfg = eventTypeConfig[event.eventType];
            const Icon = cfg.icon;
            const isExpanded = expandedEvent === event.id;

            return (
              <div key={event.id}>
                <button
                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  <div className={`p-1.5 rounded ${cfg.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{event.filePath}</p>
                    <p className="text-xs text-muted-foreground">{event.ruleDescription}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Monitor className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground">{event.agentName}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${
                      event.severity === 'critical' ? 'severity-badge-critical' :
                      event.severity === 'high' ? 'severity-badge-high' :
                      event.severity === 'medium' ? 'severity-badge-medium' :
                      'severity-badge-low'
                    }`}>{event.severity}</span>
                    <span className="text-xs text-muted-foreground w-14 text-right">
                      {new Date(event.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>

                {/* Detalhes Expandidos */}
                {isExpanded && (
                  <div className="bg-muted/20 px-6 py-3">
                    <div className="grid gap-2 grid-cols-2 md:grid-cols-3 text-xs">
                      {event.md5 && (
                        <div className="flex items-start gap-1.5">
                          <Hash className="h-3 w-3 text-muted-foreground mt-0.5" />
                          <div>
                            <span className="text-muted-foreground block">MD5</span>
                            <span className="font-mono text-[11px] break-all">{event.md5}</span>
                          </div>
                        </div>
                      )}
                      {event.sha256 && (
                        <div className="flex items-start gap-1.5 col-span-2">
                          <Hash className="h-3 w-3 text-muted-foreground mt-0.5" />
                          <div>
                            <span className="text-muted-foreground block">SHA256</span>
                            <span className="font-mono text-[11px] break-all">{event.sha256}</span>
                          </div>
                        </div>
                      )}
                      {(event.userName || event.uid) && (
                        <div>
                          <span className="text-muted-foreground">Usuário:</span>
                          <span className="font-mono ml-1">{event.userName || event.uid}</span>
                        </div>
                      )}
                      {event.gid && (
                        <div>
                          <span className="text-muted-foreground">GID:</span>
                          <span className="font-mono ml-1">{event.gid}</span>
                        </div>
                      )}
                      {event.size !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Tamanho:</span>
                          <span className="font-mono ml-1">{event.size} bytes</span>
                        </div>
                      )}
                      {event.perm && (
                        <div>
                          <span className="text-muted-foreground">Permissões:</span>
                          <span className="font-mono ml-1">{event.perm}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Nível da Regra:</span>
                        <span className="font-mono ml-1">{event.ruleLevel}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="font-mono ml-1">{new Date(event.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <FileWarning className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum evento de integridade de arquivo encontrado.</p>
              <p className="text-xs text-muted-foreground mt-1">
                O módulo Syscheck precisa estar habilitado no ossec.conf dos agentes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Fim;
