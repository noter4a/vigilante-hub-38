import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWazuhGroups, createWazuhGroup, getWazuhAgents, addAgentToGroup, removeAgentFromGroup, renameWazuhGroup } from "@/lib/api-client";
import { Building2, Plus, Monitor, X, Link as LinkIcon, Building, Edit2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatTimestamp, agentStatusClass } from "@/lib/soc-utils";

const Companies = () => {
  const queryClient = useQueryClient();

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["wazuh-groups"],
    queryFn: getWazuhGroups,
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: getWazuhAgents,
  });

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [agentToAssign, setAgentToAssign] = useState<string>("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const renameGroupMutation = useMutation({
    mutationFn: ({ oldName, newName, agentsToMove }: { oldName: string, newName: string, agentsToMove: string[] }) => renameWazuhGroup(oldName, newName, agentsToMove),
    onSuccess: (success, variables) => {
      if (success) {
        toast.success(`Empresa renomeada para ${variables.newName}.`);
        queryClient.invalidateQueries({ queryKey: ["wazuh-groups"] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["overview-stats"] });
        setEditingGroup(null);
      } else {
        toast.error("Erro ao renomear empresa. Verifique se o nome já não existe ou veja os logs da API.");
      }
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: createWazuhGroup,
    onSuccess: (success) => {
      if (success) {
        toast.success(`Empresa ${newGroupName} cadastrada no Wazuh com sucesso.`);
        queryClient.invalidateQueries({ queryKey: ["wazuh-groups"] });
        setNewGroupName("");
        setIsCreating(false);
      } else {
        toast.error("Falha ao criar empresa (grupo). Verifique os logs e as permissões da API.");
      }
    }
  });

  const assignAgentMutation = useMutation({
    mutationFn: ({ agentId, groupName }: { agentId: string, groupName: string }) => addAgentToGroup(agentId, groupName),
    onSuccess: (success) => {
      if (success) {
        toast.success("Agente vinculado com sucesso.");
        queryClient.invalidateQueries({ queryKey: ["wazuh-groups"] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["overview-stats"] }); // Re-render Overview
        setAgentToAssign("");
      } else {
        toast.error("Erro ao vincular agente.");
      }
    }
  });

  const removeAgentMutation = useMutation({
    mutationFn: ({ agentId, groupName }: { agentId: string, groupName: string }) => removeAgentFromGroup(agentId, groupName),
    onSuccess: (success) => {
      if (success) {
        toast.info("Agente removido da empresa.");
        queryClient.invalidateQueries({ queryKey: ["wazuh-groups"] });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["overview-stats"] }); // Re-render Overview
      } else {
        toast.error("Erro ao remover agente.");
      }
    }
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate(newGroupName.trim());
  };

  const handleAssign = (groupName: string) => {
    if (!agentToAssign) return;
    assignAgentMutation.mutate({ agentId: agentToAssign, groupName });
  };

  if (groupsLoading || agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Carregando registro de empresas...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Empresas e Clientes</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie o cadastro de clientes corporativos usando Grupos do Wazuh e atribua as máquinas.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2"
        >
          {isCreating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isCreating ? "Cancelar Operação" : "Cadastrar Nova Empresa"}
        </button>
      </div>

      {isCreating && (
        <div className="soc-card border-primary/30">
          <h3 className="text-sm font-semibold mb-3">Nova Empresa (Wazuh Group)</h3>
          <form onSubmit={handleCreateGroup} className="flex flex-col md:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="text-xs text-muted-foreground mb-1 block">Nome da Empresa (sem espaços e focado no hífen ou underscore)</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value.replace(/\s+/g, '_'))}
                placeholder="Exemplo: cliente_corporativo_A"
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={createGroupMutation.isPending || !newGroupName.trim()}
              className="bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 px-6 py-2 rounded-md font-medium text-sm flex-shrink-0"
            >
              {createGroupMutation.isPending ? "Processando..." : "Confirmar Criação"}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups?.map((group) => {
          const isExpanded = expandedGroup === group.name;
          const assignedAgents = agents?.filter(a => a.group === group.name) || [];

          return (
            <div key={group.name} className="soc-card p-0 flex flex-col h-full">
              <div className="p-5 border-b border-border/50">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                       <Building className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                       {editingGroup === group.name ? (
                         <div className="flex items-center gap-1.5 min-w-0">
                           <input
                             autoFocus
                             type="text"
                             value={editGroupName}
                             onChange={(e) => setEditGroupName(e.target.value.replace(/\s+/g, '_'))}
                             className="bg-background text-foreground border border-border rounded px-2 py-0.5 text-sm w-full max-w-[140px] focus:outline-none"
                             disabled={renameGroupMutation.isPending}
                           />
                           <button 
                             onClick={() => renameGroupMutation.mutate({ oldName: group.name, newName: editGroupName, agentsToMove: assignedAgents.map(a => a.id) })} 
                             disabled={renameGroupMutation.isPending || !editGroupName.trim() || editGroupName === group.name} 
                             className="text-[hsl(var(--severity-low))] hover:opacity-80 disabled:opacity-50"
                           >
                             <Check className="h-4 w-4" />
                           </button>
                           <button 
                             onClick={() => setEditingGroup(null)} 
                             disabled={renameGroupMutation.isPending} 
                             className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                           >
                             <X className="h-4 w-4" />
                           </button>
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 min-w-0">
                           <h3 className="font-semibold text-lg truncate max-w-[130px]">{group.name}</h3>
                           {group.name !== 'default' && (
                             <button 
                               onClick={() => { setEditingGroup(group.name); setEditGroupName(group.name); }} 
                               className="text-muted-foreground hover:text-foreground transition-colors mt-0.5" 
                               title="Renomear Empresa"
                             >
                               <Edit2 className="h-3.5 w-3.5" />
                             </button>
                           )}
                         </div>
                       )}
                    </div>
                    <span className="text-xs font-mono font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded">
                      {assignedAgents.length} agentes
                    </span>
                 </div>
                 <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.name)}
                    className="w-full mt-3 bg-secondary/50 hover:bg-secondary border border-border transition-colors text-xs font-medium py-1.5 rounded"
                 >
                   {isExpanded ? 'Recolher Gestão' : 'Gerenciar Vínculos'}
                 </button>
              </div>

              {isExpanded && (
                <div className="p-4 bg-muted/10 flex-1">
                  <div className="mb-4 space-y-2">
                    <label className="text-xs text-muted-foreground">Vincular Novo Agente (Máquina)</label>
                    <div className="flex gap-2">
                       <select 
                         value={agentToAssign}
                         onChange={(e) => setAgentToAssign(e.target.value)}
                         className="flex-1 bg-background text-foreground border border-border rounded px-2 py-1.5 text-xs focus:outline-none"
                       >
                         <option value="">-- Selecione o Agente --</option>
                         {agents?.filter(a => a.group !== group.name && a.id !== '000').map(agent => (
                            <option key={agent.id} value={agent.id}>{agent.hostname} ({agent.clientName})</option>
                         ))}
                       </select>
                       <button
                         onClick={() => handleAssign(group.name)}
                         disabled={!agentToAssign || assignAgentMutation.isPending}
                         className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 rounded flex items-center justify-center transition-colors disabled:opacity-50"
                         title="Vincular à Empresa"
                       >
                          <LinkIcon className="h-3 w-3" />
                       </button>
                    </div>
                  </div>

                  <div>
                     <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2 mt-4">Agentes Atuais</h4>
                     {assignedAgents.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4 bg-background/50 rounded border border-border/50 border-dashed">Nenhum agente vinculado.</p>
                     ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                           {assignedAgents.map(agent => (
                             <div key={agent.id} className="flex items-center justify-between bg-background border border-border rounded px-3 py-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                   <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: `hsl(var(--status-${agent.status}))` }} />
                                   <div className="truncate">
                                      <p className="text-xs font-mono font-medium truncate">{agent.hostname}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{agent.os}</p>
                                   </div>
                                </div>
                                <button
                                   onClick={() => removeAgentMutation.mutate({ agentId: agent.id, groupName: group.name })}
                                   disabled={removeAgentMutation.isPending}
                                   className="text-muted-foreground hover:text-destructive transition-colors ml-2 flex-shrink-0"
                                   title="Desvincular Agent (Retorna para 'default')"
                                >
                                   <X className="h-4 w-4" />
                                </button>
                             </div>
                           ))}
                        </div>
                     )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Companies;
