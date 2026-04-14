export type TechniqueGuidance = {
  problem: string;
  solution: string;
  mitreMitigation: string;
};

// Snapshot local (base de conhecimento). Atualize periodicamente com fontes ATT&CK.
export const MITRE_KNOWLEDGE_SNAPSHOT = {
  source: "MITRE ATT&CK (snapshot local)",
  updatedAt: "2026-04-08",
};

export const TACTIC_GUIDANCE_MAP: Record<string, TechniqueGuidance> = {
  "Initial Access": {
    problem: "Há indícios de tentativa de entrada inicial no ambiente (vetor externo ou credenciais comprometidas).",
    solution: "Reforce MFA, bloqueie serviços expostos sem necessidade e aplique hardening em pontos de acesso remoto.",
    mitreMitigation: "M1032 Multi-factor Authentication / M1054 Software Configuration",
  },
  "Execution": {
    problem: "Código/artefato suspeito foi executado em endpoint monitorado.",
    solution: "Restringir execução por allowlist, bloquear scripts não assinados e revisar cadeia de processo pai-filho.",
    mitreMitigation: "M1038 Execution Prevention",
  },
  "Persistence": {
    problem: "Foi observada técnica que busca manter acesso após reinicializações ou troca de sessão.",
    solution: "Auditar mecanismos de auto-start (services, tasks, run keys), remover artefatos e rotacionar credenciais.",
    mitreMitigation: "M1047 Audit / M1022 Restrict File and Directory Permissions",
  },
  "Privilege Escalation": {
    problem: "Comportamento compatível com tentativa de elevação de privilégio.",
    solution: "Aplicar princípio de menor privilégio, corrigir permissões fracas e atualizar binários/sistemas vulneráveis.",
    mitreMitigation: "M1026 Privileged Account Management / M1051 Update Software",
  },
  "Defense Evasion": {
    problem: "Ator tentou ocultar atividade ou burlar mecanismos de segurança.",
    solution: "Fortaleça proteção contra adulteração de logs/EDR, alerte em desativação de defesa e compare baseline de configuração.",
    mitreMitigation: "M1040 Behavior Prevention on Endpoint",
  },
  "Credential Access": {
    problem: "Há sinal de coleta/abuso de credenciais.",
    solution: "Rotacione segredos, force troca de senha em contas afetadas e habilite controles anti-dumping.",
    mitreMitigation: "M1027 Password Policies / M1017 User Training",
  },
  "Discovery": {
    problem: "Foi detectado reconhecimento interno de hosts, contas ou serviços.",
    solution: "Limitar visibilidade de rede, segmentar ativos críticos e alertar para enumerações em massa.",
    mitreMitigation: "M1030 Network Segmentation",
  },
  "Lateral Movement": {
    problem: "Há tentativa de propagação para outros hosts.",
    solution: "Restringir administração remota lateral, aplicar segmentação e monitorar autenticações remotas atípicas.",
    mitreMitigation: "M1030 Network Segmentation / M1042 Disable or Remove Feature",
  },
  "Command and Control": {
    problem: "Endpoint pode estar se comunicando com infraestrutura de controle externa.",
    solution: "Bloquear domínios/IPs suspeitos no egress, inspecionar proxy/DNS e isolar host comprometido.",
    mitreMitigation: "M1037 Filter Network Traffic",
  },
  "Exfiltration": {
    problem: "Há risco de extração de dados sensíveis.",
    solution: "Aplicar DLP, restrições de transferência e monitoramento de volume/tempo anômalo de saída.",
    mitreMitigation: "M1057 Data Loss Prevention",
  },
  "Impact": {
    problem: "A atividade indica potencial de indisponibilidade, destruição ou corrupção de dados.",
    solution: "Isolar imediatamente os ativos, ativar resposta a incidente e validar integridade de backup/restore.",
    mitreMitigation: "M1053 Data Backup / M1048 Application Isolation and Sandboxing",
  },
};

export const TECHNIQUE_GUIDANCE_MAP: Record<string, Partial<TechniqueGuidance>> = {
  T1059: {
    problem: "Uso de interpretador de comando/script para executar ações maliciosas.",
    solution: "Restringir PowerShell/cmd/shell por política, logging avançado e bloqueio de comandos perigosos.",
  },
  T1110: {
    problem: "Padrão compatível com tentativa de brute force/password spraying.",
    solution: "Bloquear origem ofensiva, habilitar lockout inteligente e reforçar MFA imediatamente.",
  },
  T1566: {
    problem: "Indícios de vetor de phishing para obter acesso inicial.",
    solution: "Quarentenar mensagens, reforçar filtros de e-mail e treinamento de usuários alvo.",
  },
  T1021: {
    problem: "Movimento lateral via serviços remotos.",
    solution: "Restringir RDP/SMB/WMI/WinRM por segmentos e exigir jump host com MFA.",
  },
};
