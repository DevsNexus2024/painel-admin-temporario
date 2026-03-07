import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  Trash2, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Filter,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { pixPermissionsService, PixPermission, CreatePixPermissionDTO, PixPermissionScopeType } from "@/services/pixPermissions";
import { CORPX_ACCOUNTS, TCR_CORPX_ALIAS } from "@/contexts/CorpXContext";

export default function PixPermissionsPage() {
  const [permissions, setPermissions] = useState<PixPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<PixPermission | null>(null);
  const [revokeNote, setRevokeNote] = useState("");
  
  // Filtros
  const [scopeTypeFilter, setScopeTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Form de criação
  const [newPermission, setNewPermission] = useState<CreatePixPermissionDTO>({
    scopeType: 'TENANT',
    scopeId: '2', // Default para TCR
    keyType: 'PIX_KEY',
    keyValue: '',
    label: '',
    expiresAt: ''
  });

  const fetchPermissions = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (scopeTypeFilter !== "ALL") filters.scopeType = scopeTypeFilter;
      if (statusFilter !== "ALL") filters.isActive = statusFilter === "true";
      
      const response = await pixPermissionsService.list(filters);
      setPermissions(response.data);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
      toast.error("Erro ao carregar lista de permissões");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [scopeTypeFilter, statusFilter]);

  const handleCreate = async () => {
    try {
      // Validações básicas
      if (!newPermission.scopeId) {
        toast.error("ID do Escopo é obrigatório");
        return;
      }
      if (!newPermission.keyValue) {
        toast.error("Chave/Valor é obrigatório");
        return;
      }
      if (newPermission.keyType === 'ANY' && newPermission.keyValue !== '*') {
        toast.error("Para tipo ANY, o valor deve ser *");
        return;
      }

      await pixPermissionsService.create(newPermission);
      toast.success("Permissão criada com sucesso");
      setIsCreateOpen(false);
      setNewPermission({
        scopeType: 'TENANT',
        scopeId: '2',
        keyType: 'PIX_KEY',
        keyValue: '',
        label: '',
        expiresAt: ''
      });
      fetchPermissions();
    } catch (error: any) {
      console.error("Erro ao criar permissão:", error);
      const msg = error.response?.data?.message || "Erro ao criar permissão";
      toast.error(msg);
    }
  };

  const handleRevoke = async () => {
    if (!selectedPermission) return;
    
    try {
      await pixPermissionsService.revoke(selectedPermission.id, revokeNote);
      toast.success("Permissão revogada com sucesso");
      setIsRevokeOpen(false);
      setRevokeNote("");
      setSelectedPermission(null);
      fetchPermissions();
    } catch (error: any) {
      console.error("Erro ao revogar permissão:", error);
      toast.error("Erro ao revogar permissão");
    }
  };

  const openRevokeModal = (permission: PixPermission) => {
    setSelectedPermission(permission);
    setIsRevokeOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permissões PIX-Out</h1>
          <p className="text-muted-foreground">
            Gerencie quais chaves e destinos estão autorizados a receber transferências.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Permissão
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine a lista de permissões exibida.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="w-[200px]">
              <Label htmlFor="scope-filter" className="mb-2 block text-xs">Tipo de Escopo</Label>
              <Select value={scopeTypeFilter} onValueChange={setScopeTypeFilter}>
                <SelectTrigger id="scope-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="TENANT">Tenant</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="API_CLIENT">API Client</SelectItem>
                  <SelectItem value="GLOBAL">Global</SelectItem>
                  <SelectItem value="CORPX_ACCOUNT">Conta CorpX</SelectItem>
                  <SelectItem value="BRASILCASH_ACCOUNT">Conta BrasilCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[200px]">
              <Label htmlFor="status-filter" className="mb-2 block text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="true">Ativos</SelectItem>
                  <SelectItem value="false">Revogados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button variant="outline" onClick={fetchPermissions}>
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead>Tipo Chave</TableHead>
              <TableHead>Valor / Chave</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : permissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma permissão encontrada.
                </TableCell>
              </TableRow>
            ) : (
              permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell className="font-medium">{perm.label || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">{perm.scopeType}</span>
                      <span className="text-xs text-muted-foreground">{perm.scopeId}</span>
                    </div>
                  </TableCell>
                  <TableCell>{perm.keyType}</TableCell>
                  <TableCell className="font-mono text-xs">{perm.keyValue}</TableCell>
                  <TableCell>
                    {perm.isActive ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex w-fit items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex w-fit items-center gap-1">
                        <XCircle className="h-3 w-3" /> Revogado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(perm.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="text-right">
                    {perm.isActive && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => openRevokeModal(perm)}
                        title="Revogar permissão"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Permissão PIX-Out</DialogTitle>
            <DialogDescription>
              Autorize um destino para transferências PIX.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scopeType">Tipo de Escopo</Label>
                <Select 
                  value={newPermission.scopeType} 
                  onValueChange={(val: PixPermissionScopeType) => {
                    const resetScopeId = val === 'CORPX_ACCOUNT' ? '' : val === 'GLOBAL' ? '*' : newPermission.scopeId;
                    setNewPermission({...newPermission, scopeType: val, scopeId: resetScopeId});
                  }}
                >
                  <SelectTrigger id="scopeType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TENANT">Tenant</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="API_CLIENT">API Client</SelectItem>
                    <SelectItem value="GLOBAL">Global</SelectItem>
                    <SelectItem value="CORPX_ACCOUNT">Conta CorpX</SelectItem>
                    <SelectItem value="BRASILCASH_ACCOUNT">Conta BrasilCash (UUID)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scopeId">ID do Escopo / Conta</Label>
                {newPermission.scopeType === 'CORPX_ACCOUNT' ? (
                  <Select
                    value={newPermission.scopeId}
                    onValueChange={(val) => setNewPermission({...newPermission, scopeId: val})}
                  >
                    <SelectTrigger id="scopeId">
                      <SelectValue placeholder="Selecione a conta CorpX" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TCR_CORPX_ALIAS}>
                        TCR FINANCE LTDA ({TCR_CORPX_ALIAS})
                      </SelectItem>
                      {CORPX_ACCOUNTS.filter((acc) => acc.id !== 'ALL' && acc.corpxAlias).map((acc) => (
                        <SelectItem key={acc.id} value={acc.corpxAlias!}>
                          {acc.razaoSocial} ({acc.corpxAlias})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    id="scopeId" 
                    value={newPermission.scopeId} 
                    onChange={(e) => setNewPermission({...newPermission, scopeId: e.target.value})}
                    placeholder={
                      newPermission.scopeType === 'GLOBAL' ? '*' :
                      newPermission.scopeType === 'BRASILCASH_ACCOUNT' ? 'UUID (brasilcash account_id)' :
                      'ID...'
                    }
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keyType">Tipo de Chave</Label>
                <Select 
                  value={newPermission.keyType} 
                  onValueChange={(val: any) => setNewPermission({...newPermission, keyType: val})}
                >
                  <SelectTrigger id="keyType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX_KEY">Chave PIX</SelectItem>
                    <SelectItem value="QR_PREFIX">Prefixo QR</SelectItem>
                    <SelectItem value="ANY">Qualquer (ANY)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="keyValue">Valor da Chave</Label>
                <Input 
                  id="keyValue" 
                  value={newPermission.keyValue} 
                  onChange={(e) => setNewPermission({...newPermission, keyValue: e.target.value})}
                  placeholder={newPermission.keyType === 'ANY' ? '*' : 'Chave PIX...'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Descrição (Label)</Label>
              <Input 
                id="label" 
                value={newPermission.label} 
                onChange={(e) => setNewPermission({...newPermission, label: e.target.value})}
                placeholder="Ex: Conta Cliente João"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expira em (Opcional)</Label>
              <Input 
                id="expiresAt" 
                type="datetime-local"
                value={newPermission.expiresAt} 
                onChange={(e) => setNewPermission({...newPermission, expiresAt: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Permissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Revogação */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Revogar Permissão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja revogar esta permissão? Esta ação impedirá novos pagamentos para este destino.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-muted p-3 rounded-md mb-4 text-sm">
              <p><strong>Label:</strong> {selectedPermission?.label}</p>
              <p><strong>Chave:</strong> {selectedPermission?.keyValue}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="revokeNote">Motivo (Opcional)</Label>
              <Input 
                id="revokeNote" 
                value={revokeNote} 
                onChange={(e) => setRevokeNote(e.target.value)}
                placeholder="Ex: Cliente solicitou encerramento"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevokeOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRevoke}>Confirmar Revogação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
