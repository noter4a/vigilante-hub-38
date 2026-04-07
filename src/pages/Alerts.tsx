import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAlerts, fetchClients } from "@/lib/mock-data";
import {
  severityBadgeClass, statusBadgeClass, statusLabels,
  severityLabels, formatTimestamp,
} from "@/lib/soc-utils";
import { TablePagination } from "@/components/TablePagination";
import type { Severity, AlertStatus } from "@/types/api";

const Alerts = () => {
  const { data: alerts, isLoading } = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const [clientFilter, setClientFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a) => {
      if (clientFilter && a.clientId !== clientFilter) return false;
      if (severityFilter && a.severity !== severityFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, clientFilter, severityFilter, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [clientFilter, severityFilter, statusFilter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando alertas...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} alertas encontrados</p>
      </div>

      <div className="flex flex-wrap gap-3">
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
                <td className="text-sm">{alert.type}</td>
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
