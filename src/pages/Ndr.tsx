import { useQuery } from "@tanstack/react-query";
import { getWazuhNdrData } from "@/lib/api-client";
import { ShieldAlert, Globe, Activity, ArrowRightLeft, ShieldBan, Info, Monitor } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const Ndr = () => {
  const { data: ndrData, isLoading } = useQuery({
    queryKey: ["wazuh-ndr-data"],
    queryFn: getWazuhNdrData,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Analisando tráfego de rede...
        </div>
      </div>
    );
  }

  if (!ndrData) return null;

  // Formatter para os bytes do Top Talkers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Preparar os dados para o gráfico BarChart (foco em Upload / Bytes Out)
  const chartData = ndrData.topTalkers.map((t) => ({
    name: t.host,
    ip: t.ip,
    upload: t.bytesOut,
    download: t.bytesIn,
    total: t.bytesOut + t.bytesIn
  })).sort((a, b) => b.upload - a.upload);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Rede & NDR</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Integração Suricata/Zeek: Tráfego Leste-Oeste, Exfiltração e Anomalias
          </p>
        </div>
      </div>

      {/* Alertas Críticos Topo */}
      <h3 className="text-sm font-semibold mt-4">Alertas Recentes Relevantes (Tráfego Malicioso)</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ndrData.recentAlerts.map(alert => (
          <div key={alert.id} className={`soc-card border-l-4 ${
            alert.severity === 'critical' ? 'border-l-[hsl(var(--severity-critical))]' :
            alert.severity === 'high' ? 'border-l-[hsl(var(--severity-high))]' :
            'border-l-[hsl(var(--severity-medium))]'
          } relative overflow-hidden`}>
            
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${
                alert.severity === 'critical' ? 'severity-badge-critical' :
                alert.severity === 'high' ? 'severity-badge-high' :
                'severity-badge-medium'
              }`}>
                {alert.severity}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(alert.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <h4 className="text-sm font-semibold mb-3 leading-snug">{alert.title}</h4>
            
            <div className="flex items-center justify-between mt-auto bg-background/50 rounded p-2 border border-border/50 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px]">Origem</span>
                <span className="font-mono">{alert.sourceIp}</span>
              </div>
              <ArrowRightLeft className="h-3 w-3 text-muted-foreground/30" />
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground text-[10px]">Destino</span>
                <span className="font-mono text-destructive">{alert.destIp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gráfico Analítico - BarChart */}
        <div className="lg:col-span-1 soc-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Top Talkers (Upload)</h3>
            <Info className="h-4 w-4 text-muted-foreground" title="Host consumindo maior taxa de Egress da rede" />
          </div>
          
          <div className="flex-1 min-h-[300px]">
             <ChartContainer
                className="w-full h-full"
                config={{ 
                  upload: { label: "Upload (Tx)", color: "hsl(var(--severity-high))" },
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} opacity={0.2} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                       content={<ChartTooltipContent />} 
                       formatter={(value: any) => formatBytes(Number(value))}
                    />
                    <Bar dataKey="upload" radius={[0, 4, 4, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--${index === 0 ? 'severity-critical' : 'primary'}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
          </div>
        </div>

        {/* Matriz Analítica O -> D */}
        <div className="lg:col-span-2 soc-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Conexões Suspeitas de Alto Volume</h3>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="soc-table">
              <thead className="bg-muted/30">
                <tr>
                  <th className="w-10 text-center">Risco</th>
                  <th>Ativo / Origem Interna</th>
                  <th>Destino Externo</th>
                  <th>Porta / Serviço</th>
                  <th className="text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {ndrData.suspectConnections.map((conn) => (
                  <tr key={conn.id} className="group">
                    <td className="text-center">
                       <div className="flex justify-center">
                          {conn.risk === 'critical' ? <ShieldBan className="h-4 w-4 text-destructive" /> :
                           conn.risk === 'high' ? <ShieldAlert className="h-4 w-4 text-[hsl(var(--severity-high))]" /> :
                           conn.risk === 'medium' ? <Activity className="h-4 w-4 text-[hsl(var(--severity-medium))]" /> :
                           <div className="h-2 w-2 rounded-full bg-muted-foreground/30"></div>}
                       </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Monitor className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">{conn.sourceIp}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">{conn.destIp}</span>
                        <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{conn.country}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono bg-accent/30 border border-border px-1.5 py-0.5 rounded text-xs">
                        {conn.protocol}:{conn.port}
                      </span>
                    </td>
                    <td className="text-right text-sm">
                      {formatBytes(conn.bytesTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 bg-secondary/50 rounded-md border border-border text-xs text-muted-foreground flex gap-3 items-start">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <p>
              A visibilidade de Rede (NDR) acima utiliza emulação de logs do <strong>Suricata</strong> conectados via Wazuh Cloud. 
              As conexões externas são enriquecidas com GeoIP e as anomalias baseadas em assinaturas NIDS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ndr;
