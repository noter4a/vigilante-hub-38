import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWazuhVirusTotal } from "@/lib/api-client";
import type { VirusTotalAlert } from "@/lib/api-client";
import { ShieldAlert, Bug, Filter, ExternalLink, Activity, Network } from "lucide-react";
import { formatTimestamp } from "@/lib/soc-utils";

const VirusTotal = () => {
  const { data: vtEvents = [], isLoading } = useQuery({
    queryKey: ["wazuh-virustotal"],
    queryFn: getWazuhVirusTotal,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [selectedHost, setSelectedHost] = useState<string>("");

  const hosts = useMemo(() => {
    const set = new Set<string>();
    vtEvents.forEach(e => set.add(e.agentName));
    return Array.from(set).sort();
  }, [vtEvents]);

  const filtered = useMemo(() => {
    return vtEvents.filter(e => {
      if (selectedHost && e.agentName !== selectedHost) return false;
      return true;
    });
  }, [vtEvents, selectedHost]);

  const stats = useMemo(() => {
    const malicious = filtered.filter(e => e.positives > 0).length;
    const clean = filtered.filter(e => e.positives === 0).length;
    return { malicious, clean, total: filtered.length };
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Analisando histórico de ameaças no VirusTotal...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-[hsl(var(--severity-critical))]" />
            <h1 className="text-2xl font-semibold tracking-tight">VirusTotal</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Análise de arquivos suspeitos identificados pelo FIM e verificados pela integração VirusTotal.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Analisado</p>
          <p className="text-4xl font-mono font-bold">{stats.total}</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <Bug className="h-5 w-5 text-[hsl(var(--severity-critical))] mb-1" />
          <p className="text-2xl font-mono font-bold text-[hsl(var(--severity-critical))]">{stats.malicious}</p>
          <p className="text-xs text-muted-foreground">Arquivos Maliciosos</p>
        </div>
        <div className="soc-card flex flex-col items-center justify-center py-5">
          <ShieldAlert className="h-5 w-5 text-[hsl(var(--severity-low))] mb-1" />
          <p className="text-2xl font-mono font-bold text-[hsl(var(--severity-low))]">{stats.clean}</p>
          <p className="text-xs text-muted-foreground">Arquivos Limpos</p>
        </div>
      </div>

      <div className="soc-card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Filtros</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={selectedHost} onChange={(e) => setSelectedHost(e.target.value)}
            className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm flex-1 max-w-[300px]">
            <option value="">Todos os hosts</option>
            {hosts.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div className="soc-card p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Histórico de Verificações</h3>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum evento do VirusTotal encontrado.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(event => (
              <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    <div className={`mt-0.5 p-2 rounded-full ${
                      event.positives > 0 
                        ? 'bg-[hsl(var(--severity-critical)/0.1)] text-[hsl(var(--severity-critical))]' 
                        : 'bg-[hsl(var(--severity-low)/0.1)] text-[hsl(var(--severity-low))]'
                    }`}>
                      {event.positives > 0 ? <Bug className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm break-all font-semibold">{event.fileName}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground font-mono">
                        <span>{formatTimestamp(event.timestamp)}</span>
                        <span>|</span>
                        <span>Host: {event.agentName}</span>
                        <span>|</span>
                        <span>Hash: {event.hash}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        event.positives > 0 
                          ? 'bg-[hsl(var(--severity-critical)/0.15)] text-[hsl(var(--severity-critical))] border border-[hsl(var(--severity-critical)/0.2)]'
                          : 'bg-[hsl(var(--severity-low)/0.15)] text-[hsl(var(--severity-low))] border border-[hsl(var(--severity-low)/0.2)]'
                      }`}>
                        TAXA: {event.positives} / {event.total > 0 ? event.total : '?'}
                      </span>
                    </div>
                    {event.permalink && (
                      <a href={event.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
                        Ver no VirusTotal <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VirusTotal;
