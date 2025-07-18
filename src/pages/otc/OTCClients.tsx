import React, { useState } from 'react';
import { Plus, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OTCDashboard from './OTCDashboard';
import OTCClientTable from '@/components/otc/OTCClientTable';
import OTCClientModal from '@/components/otc/OTCClientModal';
import OTCOperationModal from '@/components/otc/OTCOperationModal';
import OTCStatementModal from '@/components/otc/OTCStatementModal';
import { OTCClient } from '@/types/otc';

/**
 * Página principal dos clientes OTC
 */
const OTCClients: React.FC = () => {
  // Mudar de 'dashboard' para 'clients'
  const [activeTab, setActiveTab] = useState<string>('clients');
  
  // Estados dos modais
  const [clientModal, setClientModal] = useState<{
    isOpen: boolean;
    client?: OTCClient;
  }>({ isOpen: false });
  
  const [operationModal, setOperationModal] = useState<{
    isOpen: boolean;
    client?: OTCClient;
  }>({ isOpen: false });
  
  const [statementModal, setStatementModal] = useState<{
    isOpen: boolean;
    client?: OTCClient;
  }>({ isOpen: false });

  // Handlers para ações da tabela
  const handleViewStatement = (client: OTCClient) => {
    setStatementModal({ isOpen: true, client });
  };

  const handleEditClient = (client: OTCClient) => {
    setClientModal({ isOpen: true, client });
  };

  const handleCreateOperation = (client: OTCClient) => {
    setOperationModal({ isOpen: true, client });
  };

  const handleViewBalance = (client: OTCClient) => {
    // Por enquanto, redireciona para o extrato
    setStatementModal({ isOpen: true, client });
  };

  const handleNewClient = () => {
    setClientModal({ isOpen: true });
  };

  // Fechar modais
  const closeClientModal = () => {
    setClientModal({ isOpen: false, client: undefined });
  };

  const closeOperationModal = () => {
    setOperationModal({ isOpen: false, client: undefined });
  };

  const closeStatementModal = () => {
    setStatementModal({ isOpen: false, client: undefined });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Sistema OTC
          </h1>
          <p className="text-muted-foreground">
            Gerenciamento de clientes Over-the-Counter
          </p>
        </div>
        <Button 
          onClick={handleNewClient}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Clientes
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo das tabs */}
        <TabsContent value="dashboard" className="space-y-4">
          <OTCDashboard />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <OTCClientTable
            onViewStatement={handleViewStatement}
            onEditClient={handleEditClient}
            onCreateOperation={handleCreateOperation}
            onViewBalance={handleViewBalance}
          />
        </TabsContent>
      </Tabs>

      {/* Modais - Implementação temporária */}
      <OTCClientModal 
        isOpen={clientModal.isOpen}
        onClose={closeClientModal}
        client={clientModal.client}
      />
      
      <OTCOperationModal 
        isOpen={operationModal.isOpen}
        onClose={closeOperationModal}
        client={operationModal.client}
      />
      
      <OTCStatementModal 
        isOpen={statementModal.isOpen}
        onClose={closeStatementModal}
        client={statementModal.client}
      />
    </div>
  );
};

export default OTCClients;