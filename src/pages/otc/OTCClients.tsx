import React, { useState } from 'react';
import { Plus, Users, BarChart3, UserPlus, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OTCDashboard from './OTCDashboard';
import OTCClientTable from '@/components/otc/OTCClientTable';
import OTCOperations from './OTCOperations';
import OTCClientModal from '@/components/otc/OTCClientModal';
import OTCOperationModal from '@/components/otc/OTCOperationModal';

import OTCEmployeeModal from '@/components/otc/OTCEmployeeModal';
import { OTCClient } from '@/types/otc';

/**
 * Página principal dos clientes OTC
 */
const OTCClients: React.FC = () => {
  const navigate = useNavigate();
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
  


  const [employeeModal, setEmployeeModal] = useState<{
    isOpen: boolean;
  }>({ isOpen: false });

  // Handlers para ações da tabela
  const handleViewStatement = (client: OTCClient) => {
    // Navegar para a nova página de extrato administrativo
    navigate(`/otc/admin-statement/${client.id}`);
  };

  const handleEditClient = (client: OTCClient) => {
    setClientModal({ isOpen: true, client });
  };

  const handleCreateOperation = (client: OTCClient) => {
    setOperationModal({ isOpen: true, client });
  };

  const handleViewBalance = (client: OTCClient) => {
    // Redireciona para o extrato administrativo
    navigate(`/otc/admin-statement/${client.id}`);
  };

  const handleNewClient = () => {
    setClientModal({ isOpen: true });
  };

  const handleManageEmployees = () => {
    setEmployeeModal({ isOpen: true });
  };

  // Fechar modais
  const closeClientModal = () => {
    setClientModal({ isOpen: false, client: undefined });
  };

  const closeOperationModal = () => {
    setOperationModal({ isOpen: false, client: undefined });
  };



  const closeEmployeeModal = () => {
    setEmployeeModal({ isOpen: false });
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
        
        {/* Grupo de botões */}
        <div className="flex gap-3">
          <Button 
            onClick={handleNewClient}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
          
          <Button 
            onClick={handleManageEmployees}
            variant="outline"
            disabled={true}
            className="border-gray-300 text-gray-400 cursor-not-allowed"
            title="Funcionalidade em desenvolvimento"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Funcionários OTC
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Travas/Saques
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

        <TabsContent value="operations" className="space-y-4">
          <OTCOperations />
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
      

      
      <OTCEmployeeModal 
        isOpen={employeeModal.isOpen}
        onClose={closeEmployeeModal}
      />
    </div>
  );
};

export default OTCClients;