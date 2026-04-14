import { AlertTriangle, Monitor, Bug, LayoutDashboard, Shield, Network, ShieldCheck, FileWarning, Building2, Activity } from "lucide-react";
import logo from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard },
  { title: "Clientes (Empresas)", url: "/companies", icon: Building2 },
  { title: "Alertas", url: "/alerts", icon: AlertTriangle },
  { title: "Agentes", url: "/agents", icon: Monitor },
  { title: "Vulnerabilidades", url: "/vulnerabilities", icon: Bug },
  { title: "VirusTotal", url: "/virustotal", icon: Activity },
  { title: "MITRE ATT&CK", url: "/mitre", icon: Shield },
  { title: "Rede & NDR", url: "/ndr", icon: Network },
  { title: "Conformidade (SCA)", url: "/sca", icon: ShieldCheck },
  { title: "Integridade (FIM)", url: "/fim", icon: FileWarning },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? "px-2" : ""}`}>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-6 w-6 flex-shrink-0 object-contain" />
            {!collapsed && (
              <span className="text-sm font-semibold tracking-tight">
                Titan<span className="text-primary">SOC</span>
              </span>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-accent" activeClassName="bg-accent text-foreground dark:text-white font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
