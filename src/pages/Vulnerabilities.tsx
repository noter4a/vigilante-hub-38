import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWazuhVulnerabilities } from "@/lib/api-client";
import { severityBadgeClass, severityLabels } from "@/lib/soc-utils";
import { TablePagination } from "@/components/TablePagination";
import type { Severity, Vulnerability } from "@/types/api";
import { ChevronDown, ChevronRight, ExternalLink, Info, Package, Monitor } from "lucide-react";

interface PackageGroup {
  packageName: string;
  maxSeverity: Severity;
  severityScore: number;
  vulnCount: number;
  hosts: Set<string>;
  vulns: Vulnerability[];
}

const severityValue: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

function PackageRow({ group }: { group: PackageGroup }) {
  const [open, setOpen] = useState(false);
  const hostsArray = Array.from(group.hosts);

  return (
    <>
      <tr onClick={() => setOpen((o) => !o)} className="cursor-pointer hover:bg-accent/30 transition-colors">
        <td className="px-4 py-3 w-8">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </td>
        <td className="px-4 py-3 font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          {group.packageName}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded font-mono ${severityBadgeClass(group.maxSeverity)}`}>
            {severityLabels[group.maxSeverity]}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="font-mono text-sm font-semibold">{group.vulnCount}</span>
        </td>
        <td className="px-4 py-3 text-sm flex items-center gap-1.5 flex-wrap">
          {hostsArray.length <= 2 ? (
            hostsArray.map((h) => (
              <span key={h} className="text-xs bg-secondary border border-border px-1.5 py-0.5 rounded flex items-center gap-1">
                <Monitor className="h-3 w-3 text-muted-foreground" /> {h}
              </span>
            ))
          ) : (
            <span className="text-xs bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground">
              {hostsArray.length} hosts afetados
            </span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-accent/5">
          <td colSpan={5} className="px-0 py-0 border-b border-border">
            <div className="pl-12 pr-6 py-4 space-y-4 shadow-inner">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                CVEs Encontradas em {group.packageName}
              </h4>
              <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {group.vulns.map((v) => (
                  <div key={v.id} className="bg-background border border-border rounded p-3 text-sm space-y-2 relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${v.severity === 'critical' ? 'bg-red-500' :
                      v.severity === 'high' ? 'bg-orange-500' :
                        v.severity === 'medium' ? 'bg-yellow-500' : 'bg-slate-500'
                      }`} />

                    <div className="flex items-start justify-between gap-2 pl-2">
                      <div className="font-mono text-xs font-bold text-primary">
                        {v.cve !== 'N/A' ? (
                          <a href={`https://nvd.nist.gov/vuln/detail/${v.cve}`} target="_blank" rel="noreferrer" className="hover:underline">
                            {v.cve}
                          </a>
                        ) : v.cve}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${severityBadgeClass(v.severity)}`}>
                        {severityLabels[v.severity]}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-3 pl-2" title={v.description}>
                      {v.description || "Sem descrição disponível."}
                    </p>

                    <div className="pl-2 pt-2 mt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Monitor className="h-3 w-3" /> {v.affectedHost}
                      </span>
                      {v.reference && (
                        <a href={v.reference} target="_blank" rel="noreferrer" className="text-[10px] flex items-center gap-1 text-primary hover:underline">
                          Patch <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const Vulnerabilities = () => {
  const { data: vulns, isLoading, error } = useQuery({
    queryKey: ["vulnerabilities"],
    queryFn: getWazuhVulnerabilities,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const clients = useMemo(() => {
    if (!vulns) return [];
    const map = new Map<string, string>();
    vulns.forEach(v => { if (v.clientId && v.clientName) map.set(v.clientId, v.clientName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [vulns]);

  const [clientFilter, setClientFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedHosts, setSelectedHosts] = useState<Set<string>>(new Set());
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const allHosts = useMemo(() => {
    if (!vulns) return [];
    return Array.from(new Set(vulns.map(v => v.affectedHost))).sort();
  }, [vulns]);

  const toggleHost = (host: string) => {
    const next = new Set(selectedHosts);
    if (next.has(host)) next.delete(host);
    else next.add(host);
    setSelectedHosts(next);
  };

  const filteredGroups = useMemo(() => {
    if (!vulns) return [];

    const filteredVulns = vulns.filter((v) => {
      if (clientFilter && v.clientId !== clientFilter) return false;
      if (severityFilter && v.severity !== severityFilter) return false;
      if (statusFilter && v.status !== statusFilter) return false;
      if (selectedHosts.size > 0 && !selectedHosts.has(v.affectedHost)) return false;
      return true;
    });

    // Agrupa por pacote
    const groupMap = new Map<string, PackageGroup>();

    filteredVulns.forEach(v => {
      let group = groupMap.get(v.affectedPackage);
      if (!group) {
        group = {
          packageName: v.affectedPackage,
          maxSeverity: v.severity,
          severityScore: severityValue[v.severity],
          vulnCount: 0,
          hosts: new Set(),
          vulns: []
        };
        groupMap.set(v.affectedPackage, group);
      }

      group.vulns.push(v);
      group.vulnCount++;
      group.hosts.add(v.affectedHost);

      const currentScore = severityValue[v.severity];
      if (currentScore > group.severityScore) {
        group.severityScore = currentScore;
        group.maxSeverity = v.severity;
      }
    });

    // Converte pra array e ordena por Risco e depois QTDE de CVEs
    return Array.from(groupMap.values()).sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      return b.vulnCount - a.vulnCount;
    });
  }, [vulns, clientFilter, severityFilter, statusFilter, selectedHosts]);

  const pagedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, page, pageSize]);

  useMemo(() => { setPage(1); }, [clientFilter, severityFilter, statusFilter, selectedHosts]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground animate-pulse">Carregando vulnerabilidades (Wazuh)...</div></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="text-sm text-destructive">Falha ao carregar vulnerabilidades</div>
          <div className="text-xs text-muted-foreground font-mono">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </div>
        </div>
      </div>
    );
  }

  // Count total vulns to show in header
  const totalVulnsCount = filteredGroups.reduce((acc, g) => acc + g.vulnCount, 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight leading-none mb-2">Painel de Vulnerabilidades CVE</h1>
        <p className="text-muted-foreground text-sm">
          {totalVulnsCount} CVE{totalVulnsCount !== 1 && 's'} em {filteredGroups.length} pacote{filteredGroups.length !== 1 && 's'} de software
        </p>
        {filteredGroups.length === 0 && (
          <div className="mt-6 p-4 border border-border bg-secondary/20 rounded-lg flex items-start gap-3 text-sm">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">
              Nenhuma vulnerabilidade detectada (ou listagem vazia pelo filtro). <br />
              Aguarde a janela de varredura global (feed update) e as validações nos agentes afetados.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-secondary/30 p-3 rounded-lg border border-border">
        {/* Custom Multi-Select para Hosts */}
        <div className="relative">
          <button 
            type="button" 
            onClick={() => setHostDropdownOpen(!hostDropdownOpen)}
            className="flex items-center justify-between w-48 bg-background text-foreground border border-border rounded px-3 py-1.5 text-sm"
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
                          e.preventDefault(); // Prevents double firing if clicked on inner elements
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
          className="bg-background text-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Todos os clientes</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-background text-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Filtro: Severidade</option>
          {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
            <option key={s} value={s}>{severityLabels[s]}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background text-foreground border border-border rounded px-3 py-1.5 text-sm">
          <option value="">Filtro: Status</option>
          <option value="open">Ativas (Abertas)</option>
          <option value="mitigated">Mitigadas (Patch Check)</option>
        </select>
      </div>

      {filteredGroups.length > 0 && (
        <div className="soc-card p-0 overflow-x-auto shadow-sm">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider bg-secondary/50">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 font-medium">Pacote Vulnerável</th>
                <th className="px-4 py-3 font-medium">Risco</th>
                <th className="px-4 py-3 font-medium text-center">CVEs</th>
                <th className="px-4 py-3 font-medium">Hosts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedGroups.map((group) => (
                <PackageRow key={group.packageName} group={group} />
              ))}
            </tbody>
          </table>

          <div className="bg-secondary/30 rounded-b-lg">
            <TablePagination
              totalItems={filteredGroups.length}
              pageSize={pageSize}
              currentPage={page}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Vulnerabilities;
