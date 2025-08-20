/**
 * 🏢 Componente para gerenciar funcionários OTC
 * 
 * Permite aos clientes OTC:
 * - Visualizar lista de funcionários
 * - Conceder novo acesso
 * - Revogar acessos existentes
 * - Gerenciar permissões
 */

import React, { useState } from 'react';
import { Plus, Users, UserX, Settings, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEmployeeManagement } from '@/hooks/useOTCEmployees';
import { otcEmployeeService, GrantAccessRequest } from '@/services/otc-employee';
import { formatTimestamp } from '@/utils/date';

// ==================== INTERFACES ====================

interface OTCEmployeeManagerProps {
  clientId: number;
  clientName: string;
}

interface GrantAccessFormData {
  employee_user_id: string;
  employee_name: string;
  employee_email: string;
  employee_document: string;
  permissions: string[];
  access_notes: string;
}

// ==================== COMPONENTE PRINCIPAL ====================

const OTCEmployeeManager: React.FC<OTCEmployeeManagerProps> = ({
  clientId,
  clientName
}) => {
  // ==================== HOOKS ====================
  
  const {
    employees,
    stats,
    isLoading,
    isGrantModalOpen,
    isRevokeModalOpen,
    isGranting,
    isRevoking,
    selectedEmployee,
    refetch,
    openGrantModal,
    closeGrantModal,
    openRevokeModal,
    closeRevokeModal,
    handleGrantAccess,
    handleRevokeAccess
  } = useEmployeeManagement(clientId);

  // ==================== ESTADOS LOCAIS ====================

  const [formData, setFormData] = useState<GrantAccessFormData>({
    employee_user_id: '',
    employee_name: '',
    employee_email: '',
    employee_document: '',
    permissions: ['view_transactions', 'view_balance_summary'],
    access_notes: ''
  });

  const [revokeReason, setRevokeReason] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // ==================== FUNÇÕES ====================

  const resetForm = () => {
    setFormData({
      employee_user_id: '',
      employee_name: '',
      employee_email: '',
      employee_document: '',
      permissions: ['view_transactions', 'view_balance_summary'],
      access_notes: ''
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_user_id || !formData.employee_name || !formData.employee_email) {
      return;
    }

    const requestData: GrantAccessRequest = {
      otc_client_id: clientId,
      employee_user_id: parseInt(formData.employee_user_id),
      employee_name: formData.employee_name,
      employee_email: formData.employee_email,
      employee_document: formData.employee_document || undefined,
      permissions: formData.permissions,
      access_notes: formData.access_notes || undefined
    };

    await handleGrantAccess(requestData);
    resetForm();
  };

  const handleRevokeSubmit = async () => {
    if (!revokeReason.trim() || revokeReason.trim().length < 10) {
      return;
    }

    await handleRevokeAccess(revokeReason.trim());
    setRevokeReason('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'suspended':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = otcEmployeeService.formatStatus(status);
    return (
      <Badge 
        className={`
          ${statusInfo.color === 'green' ? 'bg-green-100 text-green-800 border-green-200' : ''}
          ${statusInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''}
          ${statusInfo.color === 'orange' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
          ${statusInfo.color === 'red' ? 'bg-red-100 text-red-800 border-red-200' : ''}
          ${statusInfo.color === 'gray' ? 'bg-gray-100 text-gray-800 border-gray-200' : ''}
        `}
      >
        {statusInfo.label}
      </Badge>
    );
  };

  const filteredEmployees = employees.filter(emp => {
    if (!searchFilter) return true;
    const search = searchFilter.toLowerCase();
    return (
      emp.employee_name.toLowerCase().includes(search) ||
      emp.employee_email.toLowerCase().includes(search) ||
      emp.employee_document?.toLowerCase().includes(search)
    );
  });

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Funcionários OTC
          </h2>
          <p className="text-muted-foreground">
            Gerencie o acesso de funcionários ao extrato de {clientName}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button onClick={openGrantModal}>
            <Plus className="w-4 h-4 mr-2" />
            Conceder Acesso
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revogados</p>
                <p className="text-2xl font-bold text-red-600">{stats.revoked}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar funcionário</Label>
              <Input
                id="search"
                placeholder="Nome, email ou documento..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Funcionários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Lista de Funcionários ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando funcionários...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchFilter ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário cadastrado'}
              </p>
              {!searchFilter && (
                <Button onClick={openGrantModal} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Conceder Primeiro Acesso
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Concedido em</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee.employee_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {employee.employee_email}
                          </div>
                          {employee.employee_document && (
                            <div className="text-xs text-muted-foreground">
                              Doc: {employee.employee_document}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(employee.status)}
                          {getStatusBadge(employee.status)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {otcEmployeeService.formatPermissions(employee.permissions)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {formatTimestamp(employee.granted_at, 'dd/MM/yyyy HH:mm')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          por {employee.granted_by}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {employee.last_access ? (
                          <div className="text-sm">
                            {formatTimestamp(employee.last_access, 'dd/MM/yyyy HH:mm')}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nunca</span>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        {employee.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRevokeModal(employee)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <UserX className="w-3 h-3 mr-1" />
                            Revogar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Conceder Acesso */}
      <Dialog open={isGrantModalOpen} onOpenChange={closeGrantModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conceder Acesso de Funcionário</DialogTitle>
            <DialogDescription>
              Conceda acesso limitado ao extrato para um funcionário da sua empresa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <Label htmlFor="employee_user_id">ID do Usuário *</Label>
              <Input
                id="employee_user_id"
                type="number"
                required
                value={formData.employee_user_id}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_user_id: e.target.value }))}
                placeholder="ID do usuário no sistema"
              />
            </div>

            <div>
              <Label htmlFor="employee_name">Nome do Funcionário *</Label>
              <Input
                id="employee_name"
                required
                value={formData.employee_name}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label htmlFor="employee_email">Email *</Label>
              <Input
                id="employee_email"
                type="email"
                required
                value={formData.employee_email}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_email: e.target.value }))}
                placeholder="email@empresa.com"
              />
            </div>

            <div>
              <Label htmlFor="employee_document">Documento (opcional)</Label>
              <Input
                id="employee_document"
                value={formData.employee_document}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_document: e.target.value }))}
                placeholder="CPF ou outro documento"
              />
            </div>

            <div>
              <Label htmlFor="access_notes">Observações (opcional)</Label>
              <Textarea
                id="access_notes"
                value={formData.access_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, access_notes: e.target.value }))}
                placeholder="Motivo do acesso, departamento, etc."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeGrantModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isGranting}>
                {isGranting ? 'Concedendo...' : 'Conceder Acesso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Revogar Acesso */}
      <AlertDialog open={isRevokeModalOpen} onOpenChange={closeRevokeModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" />
              Revogar Acesso do Funcionário
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">
                    Esta ação irá revogar o acesso de <strong>{selectedEmployee?.employee_name}</strong> 
                    ao extrato do cliente. O funcionário não poderá mais visualizar as transações.
                  </p>
                </div>

                <div>
                  <Label htmlFor="revoke_reason">Motivo da Revogação *</Label>
                  <Textarea
                    id="revoke_reason"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="Informe o motivo da revogação (mínimo 10 caracteres)"
                    rows={3}
                    className={revokeReason.length > 0 && revokeReason.length < 10 ? 'border-red-300' : ''}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <span className={`text-xs ${revokeReason.length < 10 ? 'text-red-500' : 'text-green-600'}`}>
                      {revokeReason.length < 10 
                        ? `Mínimo 10 caracteres (atual: ${revokeReason.length})`
                        : `✓ Motivo válido (${revokeReason.length} caracteres)`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeSubmit}
              disabled={isRevoking || revokeReason.trim().length < 10}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRevoking ? 'Revogando...' : 'Confirmar Revogação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OTCEmployeeManager;
