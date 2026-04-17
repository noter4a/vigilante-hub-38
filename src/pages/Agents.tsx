import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWazuhAgents, deleteWazuhAgent } from "@/lib/api-client";
import { agentStatusClass, formatTimestamp, timeAgo } from "@/lib/soc-utils";
import { TablePagination } from "@/components/TablePagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Agent } from "@/types/api";

const Agents = () => {
  const queryClient = useQueryClient();
  const { data: agents, isLoading } = useQuery({ queryKey: ["agents"], queryFn: getWazuhAgents, refetchInterval: 60_000, staleTime: 30_000 });

  const clients = useMemo(() => {
    if (!agents) return [];
    const map = new Map<string, string>();
    agents.forEach(a => { if (a.clientId && a.clientName) map.set(a.clientId, a.clientName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [agents]);

  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Estado para o modal de confirmação de exclusão
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteWazuhAgent(agentToDelete.id);
      if (success) {
        // Invalida os caches para atualizar todas as telas que dependem de agentes
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["overview"] });
      }
    } catch (err) {
      console.error("Falha ao excluir agente:", err);
    } finally {
      setIsDeleting(false);
      setAgentToDelete(null);
    }
  };

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
              <th className="text-right">Ações</th>
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
                <td className="text-right">
                  <button
                    id={`delete-agent-${agent.id}`}
                    onClick={() => setAgentToDelete(agent)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
                               text-destructive hover:bg-destructive/10 border border-destructive/30
                               hover:border-destructive/60 transition-all duration-200"
                    title={`Excluir agente ${agent.hostname}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
                    </svg>
                    Excluir
                  </button>
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

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!agentToDelete} onOpenChange={(open) => { if (!open) setAgentToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tem certeza que deseja excluir o agente <strong className="text-foreground">{agentToDelete?.hostname}</strong> do painel?
                </p>
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs space-y-1">
                  <p className="font-semibold text-destructive">⚠ Esta ação é irreversível</p>
                  <p>O agente será removido do Wazuh Manager e precisará ser reinstalado caso deseje monitorá-lo novamente.</p>
                </div>
                {agentToDelete && (
                  <div className="rounded-md bg-secondary p-3 text-xs space-y-1 font-mono">
                    <p><span className="text-muted-foreground">ID:</span> {agentToDelete.id}</p>
                    <p><span className="text-muted-foreground">Hostname:</span> {agentToDelete.hostname}</p>
                    <p><span className="text-muted-foreground">OS:</span> {agentToDelete.os}</p>
                    <p><span className="text-muted-foreground">Cliente:</span> {agentToDelete.clientName}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              id="confirm-delete-agent"
              onClick={handleDeleteAgent}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Excluindo...
                </span>
              ) : (
                "Sim, excluir agente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Agents;
