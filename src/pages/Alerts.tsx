import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWazuhAlerts } from "@/lib/api-client";
import {
  severityBadgeClass, statusBadgeClass, statusLabels,
  severityLabels, formatTimestamp,
} from "@/lib/soc-utils";
import { TablePagination } from "@/components/TablePagination";
import type { Severity, AlertStatus } from "@/types/api";
import { ChevronDown, Monitor } from "lucide-react";

const Alerts = () => {
  const { data: alerts, isLoading } = useQuery({ queryKey: ["alerts"], queryFn: getWazuhAlerts, refetchInterval: 60_000, staleTime: 30_000 });

  const clients = useMemo(() => {
    if (!alerts) return [];
    const map = new Map<string, string>();
    alerts.forEach(a => { if (a.clientId && a.clientName) map.set(a.clientId, a.clientName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [alerts]);

  const [clientFilter, setClientFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set());
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const uniqueAlerts = useMemo(() => {
    if (!alerts) return [];

    const latestByState = new Map<string, typeof alerts[number]>();
    alerts.forEach((a) => {
      // O alerta só "reabre" na listagem quando há mudança no estado operacional.
      const stateKey = [a.agentId, a.type, a.severity, a.status, a.description || ""].join("||");
      const existing = latestByState.get(stateKey);
      if (!existing || new Date(a.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        latestByState.set(stateKey, a);
      }
    });

    return Array.from(latestByState.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [alerts]);

  const allHosts = useMemo(() => {
    return Array.from(new Set(uniqueAlerts.map(a => a.host))).sort();
  }, [uniqueAlerts]);

  const toggleHost = (host: string) => {
    const next = new Set(selectedHosts);
    if (next.has(host)) next.delete(host);
    else next.add(host);
    setSelectedHosts(next);
  };

  const filtered = useMemo(() => {
    return uniqueAlerts.filter((a) => {
      if (clientFilter && a.clientId !== clientFilter) return false;
      if (severityFilter && a.severity !== severityFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (selectedHosts.size > 0 && !selectedHosts.has(a.host)) return false;
      return true;
    });
  }, [uniqueAlerts, clientFilter, severityFilter, statusFilter, selectedHosts]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [clientFilter, severityFilter, statusFilter, selectedHosts]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando alertas...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} alertas encontrados</p>
        {!!alerts?.length && alerts.length > filtered.length && (
          <p className="text-xs text-muted-foreground mt-1">
            {alerts.length - filtered.length} ocorrências repetidas foram ocultadas (sem mudança de estado).
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Custom Multi-Select para Hosts */}
        <div className="relative">
          <button 
            type="button" 
            onClick={() => setHostDropdownOpen(!hostDropdownOpen)}
            className="flex items-center justify-between w-48 bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm"
          >
            <span className="truncate">
              {selectedHosts.size === 0 ? "Filtro: Hosts (Todos)" : `Hosts (${selectedHosts.size} selecionados)`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-2" />
          </button>
          
          {hostDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setHostDropdownOpen(false)}></div>
              <div className="absolute top-full left-0 mt-1 w-56 bg-background rounded-md shadow-lg border border-border z-20 max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Hosts ({allHosts.length})
                </div>
                {allHosts.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">Nenhum host encontrado</div>
                ) : (
                  <div className="p-1">
                    {allHosts.map(host => (
                      <label 
                        key={host} 
                        onClick={(e) => {
                          e.preventDefault();
                          toggleHost(host);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedHosts.has(host) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                          {selectedHosts.has(host) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <Monitor className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{host}</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedHosts.size > 0 && (
                  <div className="p-2 border-t border-border">
                    <button 
                      onClick={() => setSelectedHosts(new Set())} 
                      className="w-full text-xs py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Limpar filtro
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Todos os clientes</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Todas as severidades</option>
          {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
            <option key={s} value={s}>{severityLabels[s]}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Todos os status</option>
          {(["open", "in_progress", "resolved"] as AlertStatus[]).map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </div>

      <div className="soc-card p-0 overflow-x-auto">
        <table className="soc-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Severidade</th>
              <th>Tipo</th>
              <th>Fonte</th>
              <th>Host / Agente</th>
              <th>Cliente</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((alert) => (
              <tr key={alert.id}>
                <td className="font-mono text-xs whitespace-nowrap">{formatTimestamp(alert.timestamp)}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${severityBadgeClass(alert.severity)}`}>
                    {severityLabels[alert.severity]}
                  </span>
                </td>
                <td className="text-sm">
                  {alert.type}
                  {alert.description && (
                    <div className="text-xs text-muted-foreground mt-1 truncate max-w-md" title={alert.description}>
                      {alert.description}
                    </div>
                  )}
                </td>
                <td className="font-mono text-xs">
                  {alert.source
                    ? <span className="bg-secondary border border-border px-1.5 py-0.5 rounded text-[11px]" title={alert.source}>{alert.source}</span>
                    : <span className="text-muted-foreground">—</span>
                  }
                </td>
                <td className="font-mono text-xs">{alert.host}</td>
                <td className="text-sm">{alert.clientName}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${statusBadgeClass(alert.status)}`}>
                    {statusLabels[alert.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          totalItems={filtered.length}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default Alerts;
