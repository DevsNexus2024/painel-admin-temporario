import TopBarContasOrganizacoes from "@/components/TopBarContasOrganizacoes";
import OrganizacoesPage from "./OrganizacoesPage";

export default function ContasOrganizacoesLayout() {
  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Bar com Resumo */}
      <TopBarContasOrganizacoes />

      {/* Conteúdo Principal - Apenas Lista de Organizações */}
      <div className="container mx-auto px-4 py-6">
        <OrganizacoesPage />
      </div>
    </div>
  );
}

