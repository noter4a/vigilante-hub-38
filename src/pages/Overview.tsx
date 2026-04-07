import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchClients } from "@/lib/mock-data";
import { riskBadgeClass, riskLabels, scoreColorClass, scoreLabel, scoreProgressColor } from "@/lib/soc-utils";
import { Shield, AlertTriangle, Monitor, Bug, ShieldCheck } from "lucide-react";
import { TablePagination } from "@/components/TablePagination";

const Overview = () => {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const paged = useMemo(() => {
    if (!clients) return [];
    const start = (page - 1) * pageSize;
    return clients.slice(start, start + pageSize);
  }, [clients, page, pageSize]);

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
        {paged.map((client) => (
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

      <div className="soc-card p-0">
        <TablePagination
          totalItems={clients?.length ?? 0}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default Overview;
