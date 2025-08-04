import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Users, Eye, EyeOff, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/config/api';

interface OTCEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OTCClient {
  id: number;
  client_name: string;
  client_document: string;
}

interface Employee {
  id: number;
  employee_user_id: number;
  is_active: boolean;
  granted_at: string;
  created_at: string;
  funcionario: {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
  };
  concedido_por: {
    id: number;
    name: string;
    email: string;
  };
}

const OTCEmployeeModal: React.FC<OTCEmployeeModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<OTCClient[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  // Estados do formulário de criação
  const [createForm, setCreateForm] = useState({
    employee_name: '',
    employee_email: '',
    employee_password: '',
    otc_client_id: ''
  });

  // Buscar lista de clientes OTC
  const fetchClients = async () => {
    try {
      const response = await api.get('/api/otc/clients');
      if (response.data.sucesso) {
        setClients(response.data.dados);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes OTC');
    }
  };

  // Buscar funcionários de um cliente específico
  const fetchEmployees = async (clientId?: number) => {
    try {
      setLoading(true);
      const targetClientId = clientId || selectedClientId;
      
      if (!targetClientId) {
        setEmployees([]);
        return;
      }

      const response = await api.get(`/api/otc/employees/${targetClientId}`);
      if (response.data.sucesso) {
        setEmployees(response.data.dados.funcionarios);
      }
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  // Criar funcionário
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.employee_name || !createForm.employee_email || 
        !createForm.employee_password || !createForm.otc_client_id) {
      toast.error('Todos os campos são obrigatórios');
      return;
    }

    try {
      setLoading(true);
      
      const response = await api.post('/api/otc/employees', {
        employee_name: createForm.employee_name,
        employee_email: createForm.employee_email,
        employee_password: createForm.employee_password,
        otc_client_id: parseInt(createForm.otc_client_id)
      });

      if (response.data.sucesso) {
        toast.success('Funcionário criado com sucesso!');
        
        // Limpar formulário
        setCreateForm({
          employee_name: '',
          employee_email: '',
          employee_password: '',
          otc_client_id: ''
        });

        // Se estamos visualizando funcionários do mesmo cliente, atualizar a lista
        if (selectedClientId === parseInt(createForm.otc_client_id)) {
          await fetchEmployees();
        }

        // Mudar para aba de gerenciamento
        setActiveTab('manage');
        setSelectedClientId(parseInt(createForm.otc_client_id));
        await fetchEmployees(parseInt(createForm.otc_client_id));
      }
    } catch (error: any) {
      console.error('Erro ao criar funcionário:', error);
      const errorMessage = error.response?.data?.mensagem || 'Erro ao criar funcionário';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Alterar status do funcionário
  const handleToggleEmployeeStatus = async (employeeId: number, currentStatus: boolean) => {
    try {
      setLoading(true);
      
      const response = await api.put(`/api/otc/employees/${employeeId}/status`, {
        is_active: !currentStatus
      });

      if (response.data.sucesso) {
        toast.success(`Funcionário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
        await fetchEmployees();
      }
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      const errorMessage = error.response?.data?.mensagem || 'Erro ao alterar status';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Revogar acesso do funcionário
  const handleRevokeAccess = async (employeeId: number) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste funcionário?')) {
      return;
    }

    try {
      setLoading(true);
      
      const response = await api.delete(`/api/otc/employees/${employeeId}`);

      if (response.data.sucesso) {
        toast.success('Acesso revogado com sucesso!');
        await fetchEmployees();
      }
    } catch (error: any) {
      console.error('Erro ao revogar acesso:', error);
      const errorMessage = error.response?.data?.mensagem || 'Erro ao revogar acesso';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  // Carregar funcionários quando cliente selecionado mudar
  useEffect(() => {
    if (selectedClientId && activeTab === 'manage') {
      fetchEmployees();
    }
  }, [selectedClientId, activeTab]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gerenciar Funcionários OTC
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Criar Funcionário
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Gerenciar Acessos
            </TabsTrigger>
          </TabsList>

          {/* Aba Criar Funcionário */}
          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Novo Funcionário OTC</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employee_name">Nome do Funcionário</Label>
                      <Input
                        id="employee_name"
                        value={createForm.employee_name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, employee_name: e.target.value }))}
                        placeholder="Nome completo"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="employee_email">Email</Label>
                      <Input
                        id="employee_email"
                        type="email"
                        value={createForm.employee_email}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, employee_email: e.target.value }))}
                        placeholder="email@empresa.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employee_password">Senha Inicial</Label>
                      <Input
                        id="employee_password"
                        type="password"
                        value={createForm.employee_password}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, employee_password: e.target.value }))}
                        placeholder="Senha (mín. 6 caracteres)"
                        minLength={6}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="otc_client_id">Cliente OTC</Label>
                      <Select
                        value={createForm.otc_client_id}
                        onValueChange={(value) => setCreateForm(prev => ({ ...prev, otc_client_id: value }))}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.client_name} - {client.client_document}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Funcionário
                    </Button>
                  </div>
                </form>

                {/* Aviso sobre acesso */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Acesso limitado de funcionários
                      </p>
                      <ul className="text-sm text-blue-700 mt-1 space-y-1">
                        <li>• Ver apenas depósitos PIX automáticos</li>
                        <li>• Não ver saldos BRL/USD</li>
                        <li>• Não ver operações manuais</li>
                        <li>• Interface simplificada</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Gerenciar Funcionários */}
          <TabsContent value="manage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Funcionários por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <Label>Selecionar Cliente</Label>
                    <Select
                      value={selectedClientId?.toString() || ''}
                      onValueChange={(value) => setSelectedClientId(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um cliente para ver funcionários" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.client_name} - {client.client_document}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button 
                      onClick={() => fetchEmployees()} 
                      disabled={!selectedClientId || loading}
                      variant="outline"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {selectedClientId && (
                  <div>
                    {loading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-500">Carregando funcionários...</p>
                      </div>
                    ) : employees.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-500">Nenhum funcionário encontrado para este cliente</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Use a aba "Criar Funcionário" para adicionar o primeiro funcionário
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Concedido em</TableHead>
                            <TableHead>Concedido por</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">
                                {employee.funcionario.name}
                              </TableCell>
                              <TableCell>{employee.funcionario.email}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={employee.is_active ? 'default' : 'destructive'}
                                >
                                  {employee.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(employee.granted_at).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell>{employee.concedido_por.name}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleEmployeeStatus(employee.id, employee.is_active)}
                                    disabled={loading}
                                  >
                                    {employee.is_active ? (
                                      <>
                                        <EyeOff className="w-4 h-4 mr-1" />
                                        Desativar
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-4 h-4 mr-1" />
                                        Ativar
                                      </>
                                    )}
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRevokeAccess(employee.id)}
                                    disabled={loading}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Revogar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OTCEmployeeModal;