import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAgents, fetchClients } from "@/lib/mock-data";
import { agentStatusClass, formatTimestamp, timeAgo } from "@/lib/soc-utils";
import { TablePagination } from "@/components/TablePagination";

const Agents = () => {
  const { data: agents, isLoading } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    if (!agents) return [];
    return agents.filter((a) => {
      if (clientFilter && a.clientId !== clientFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [agents, clientFilter, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useMemo(() => { setPage(1); }, [clientFilter, statusFilter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando agentes...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agentes</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} agentes monitorados</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Todos os clientes</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Todos os status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div className="soc-card p-0 overflow-x-auto">
        <table className="soc-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Hostname</th>
              <th>Sistema Operacional</th>
              <th>Última Comunicação</th>
              <th>Cliente</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((agent) => (
              <tr key={agent.id} className={agent.status === "offline" ? "bg-destructive/5" : ""}>
                <td>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${agent.status === "online" ? "animate-pulse-dot" : ""}`}
                      style={{ backgroundColor: `hsl(var(--status-${agent.status}))` }}
                    />
                    <span className={`text-xs font-mono uppercase ${agentStatusClass(agent.status)}`}>
                      {agent.status}
                    </span>
                  </div>
                </td>
                <td className="font-mono text-xs">{agent.hostname}</td>
                <td className="text-sm">{agent.os}</td>
                <td className="font-mono text-xs text-muted-foreground" title={formatTimestamp(agent.lastCommunication)}>
                  {timeAgo(agent.lastCommunication)}
                </td>
                <td className="text-sm">{agent.clientName}</td>
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

export default Agents;
