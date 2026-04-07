import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVulnerabilities, fetchClients } from "@/lib/mock-data";
import { severityBadgeClass, vulnStatusBadgeClass, severityLabels } from "@/lib/soc-utils";
import { TablePagination } from "@/components/TablePagination";
import type { Severity } from "@/types/api";

const Vulnerabilities = () => {
  const { data: vulns, isLoading } = useQuery({ queryKey: ["vulnerabilities"], queryFn: fetchVulnerabilities });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const [clientFilter, setClientFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    if (!vulns) return [];
    return vulns.filter((v) => {
      if (clientFilter && v.clientId !== clientFilter) return false;
      if (severityFilter && v.severity !== severityFilter) return false;
      if (statusFilter && v.status !== statusFilter) return false;
      return true;
    });
  }, [vulns, clientFilter, severityFilter, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useMemo(() => { setPage(1); }, [clientFilter, severityFilter, statusFilter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando vulnerabilidades...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vulnerabilidades</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} vulnerabilidades encontradas</p>
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
          <option value="open">Aberta</option>
          <option value="mitigated">Mitigada</option>
        </select>
      </div>

      <div className="soc-card p-0 overflow-x-auto">
        <table className="soc-table">
          <thead>
            <tr>
              <th>CVE</th>
              <th>Severidade</th>
              <th>Pacote Afetado</th>
              <th>Host Afetado</th>
              <th>Cliente</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((vuln) => (
              <tr key={vuln.id}>
                <td className="font-mono text-xs text-primary">{vuln.cve}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${severityBadgeClass(vuln.severity)}`}>
                    {severityLabels[vuln.severity]}
                  </span>
                </td>
                <td className="font-mono text-xs">{vuln.affectedPackage}</td>
                <td className="font-mono text-xs">{vuln.affectedHost}</td>
                <td className="text-sm">{vuln.clientName}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${vulnStatusBadgeClass(vuln.status)}`}>
                    {vuln.status === "open" ? "Aberta" : "Mitigada"}
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

export default Vulnerabilities;
