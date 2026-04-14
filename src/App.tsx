import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import Overview from "./pages/Overview";
import ClientDetail from "./pages/ClientDetail";
import Alerts from "./pages/Alerts";
import Agents from "./pages/Agents";
import Vulnerabilities from "./pages/Vulnerabilities";
import Mitre from "./pages/Mitre";
import Ndr from "./pages/Ndr";
import Sca from "./pages/Sca";
import Fim from "./pages/Fim";
import Companies from "./pages/Companies";
import VirusTotal from "./pages/VirusTotal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-12 flex items-center justify-between border-b border-border px-4 flex-shrink-0">
                <SidebarTrigger />
                <ThemeToggle />
              </header>
              <main className="flex-1 p-6 overflow-auto">
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/vulnerabilities" element={<Vulnerabilities />} />
                  <Route path="/mitre" element={<Mitre />} />
                  <Route path="/ndr" element={<Ndr />} />
                  <Route path="/sca" element={<Sca />} />
                  <Route path="/fim" element={<Fim />} />
                  <Route path="/virustotal" element={<VirusTotal />} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
