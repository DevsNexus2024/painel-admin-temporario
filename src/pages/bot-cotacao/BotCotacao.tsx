import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { 
  MessageSquare,
  Users,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Bot,
  AlertCircle,
  CheckCircle,
  Activity,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { botCotacaoService } from '@/services/bot-cotacao';

interface DashboardStats {
  total_clients: number;
  total_groups: number;
  total_active_groups: number;
  average_fee: number;
  last_activity: string;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  participants_count: number;
  is_registered: boolean;
}

interface RegisteredGroup {
  id: string;
  whatsapp_group_name: string;
  whatsapp_group_id: string;
  fee_percentual: number | null;
  client_name: string;
  effective_fee: number;
  id_otc_user: string;
  otc_user: {
    id: string;
    user_name: string;
    user_document: string;
    user_type: string;
    user_friendly_name?: string;
  };
}

interface BotStatus {
  is_active: boolean;
  last_activity: string;
  total_groups: number;
  total_clients: number;
  status_message: string;
}

interface ClientForm {
  user_name: string;
  user_document: string;
  user_type: 'personal' | 'business';
  user_friendly_name?: string;
}

interface GroupForm {
  whatsapp_group_id: string;
  whatsapp_group_name: string;
  id_otc_user: string;
  fee_percentual?: number;
}

const BotCotacao: React.FC = () => {
  // Estados principais
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [registeredGroups, setRegisteredGroups] = useState<RegisteredGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Estados dos modais
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<RegisteredGroup | null>(null);

  // Estados dos formulários
  const [clientForm, setClientForm] = useState<ClientForm>({
    user_name: '',
    user_document: '',
    user_type: 'personal',
    user_friendly_name: ''
  });

  const [groupForm, setGroupForm] = useState<GroupForm>({
    whatsapp_group_id: '',
    whatsapp_group_name: '',
    id_otc_user: '',
    fee_percentual: undefined
  });

  // Clientes únicos extraídos dos grupos
  const [availableClients, setAvailableClients] = useState<Array<{
    id: string;
    name: string;
    document: string;
    type: string;
  }>>([]);

  // Estados para paginação e filtro dos grupos WhatsApp
  const [whatsappFilter, setWhatsappFilter] = useState('');
  const [whatsappPage, setWhatsappPage] = useState(1);
  const [whatsappPageSize] = useState(10);

  // Estados para paginação e filtro dos grupos cadastrados
  const [registeredFilter, setRegisteredFilter] = useState('');
  const [registeredPage, setRegisteredPage] = useState(1);
  const [registeredPageSize] = useState(10);

  // Estados para seleção múltipla e cadastro em lote
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkAddForm, setBulkAddForm] = useState({
    id_otc_user: '',
    fee_percentual_padrao: 0
  });
  const [bulkAddLoading, setBulkAddLoading] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Tentar carregar dados com tratamento individual de erros
      const promises = [
        loadDashboardStats().catch(() => {}),
        loadBotStatus().catch(() => {}),
        loadRegisteredGroups().catch(() => {}),
        loadWhatsAppGroups().catch(() => {})
      ];
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      toast({
        title: 'Aviso',
        description: 'Alguns dados podem não estar disponíveis. Verifique a conexão com a API.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const response = await botCotacaoService.getDashboardStats();
      if (response?.sucesso) {
        setStats(response.data);
      }
    } catch (error) {
      // Falha silenciosa para estatísticas
    }
  };

  const loadBotStatus = async () => {
    try {
      const response = await botCotacaoService.getBotStatus();
      if (response?.sucesso) {
        setBotStatus(response.data);
      } else {
        // Definir um status padrão se não conseguir carregar
        setBotStatus({
          is_active: false,
          last_activity: new Date().toISOString(),
          total_groups: 0,
          total_clients: 0,
          status_message: 'Erro de conexão'
        });
      }
    } catch (error) {
      setBotStatus({
        is_active: false,
        last_activity: new Date().toISOString(),
        total_groups: 0,
        total_clients: 0,
        status_message: 'Erro de conexão'
      });
    }
  };

  const loadWhatsAppGroups = async () => {
    try {
      // Carregar TODOS os grupos do WhatsApp (sem limitação)
      const response = await botCotacaoService.getAllWhatsAppGroups({ page: 1, limit: 100 });
      
      if (response?.sucesso) {
        const groups = response.data?.items || [];
        console.log('📱 Grupos WhatsApp carregados da API:', groups.length);
        console.log('📊 Total no servidor:', response.data?.total || 0);
        
        setWhatsappGroups(groups);
        
        // Verificar se há mais grupos do que o limite
        if ((response.data?.total || 0) > groups.length) {
          toast({
            title: 'Aviso de Paginação WhatsApp',
            description: `Carregados ${groups.length} de ${response.data?.total} grupos WhatsApp. Alguns podem não estar visíveis.`,
            variant: 'destructive'
          });
        } else if (groups.length > 0) {
          toast({
            title: 'Grupos Carregados',
            description: `${groups.length} grupos do WhatsApp encontrados`,
          });
        }
      } else {
        setWhatsappGroups([]);
        toast({
          title: 'Aviso',
          description: response?.mensagem || 'Nenhum grupo encontrado',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar grupos WhatsApp:', error);
      setWhatsappGroups([]);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar grupos do WhatsApp',
        variant: 'destructive'
      });
    }
  };

  const loadRegisteredGroups = async () => {
    try {
      // Carregar TODOS os grupos cadastrados (sem limitação de paginação)
      const response = await botCotacaoService.getRegisteredGroups({}, { page: 1, limit: 100. });
      if (response?.sucesso) {
        console.log('📋 Grupos cadastrados carregados da API:', response.data?.items?.length || 0);
        console.log('📊 Total no servidor:', response.data?.total || 0);
        
        setRegisteredGroups(response.data?.items || []);
        
        // Extrair clientes únicos
        const clientsMap = new Map();
        response.data?.items?.forEach((group: RegisteredGroup) => {
          if (group.otc_user && !clientsMap.has(group.otc_user.id)) {
            clientsMap.set(group.otc_user.id, {
              id: group.otc_user.id,
              name: group.otc_user.user_friendly_name || group.otc_user.user_name,
              document: group.otc_user.user_document,
              type: group.otc_user.user_type
            });
          }
        });
        setAvailableClients(Array.from(clientsMap.values()));
        
        // Se há mais grupos do que o limite, avisar
        if ((response.data?.total || 0) > (response.data?.items?.length || 0)) {
          toast({
            title: 'Aviso de Paginação',
            description: `Carregados ${response.data?.items?.length} de ${response.data?.total} grupos. Alguns podem não estar visíveis.`,
            variant: 'destructive'
          });
        }
      } else {
        setRegisteredGroups([]);
        setAvailableClients([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar grupos cadastrados:', error);
      setRegisteredGroups([]);
      setAvailableClients([]);
    }
  };

  const handleSyncGroups = async () => {
    setSyncLoading(true);
    try {
      const response = await botCotacaoService.syncWhatsAppGroups();
      if (response.sucesso) {
        await loadWhatsAppGroups();
        await loadRegisteredGroups();
        toast({
          title: 'Sucesso',
          description: 'Grupos sincronizados com sucesso',
        });
      } else {
        throw new Error(response.mensagem || 'Erro na sincronização');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao sincronizar grupos',
        variant: 'destructive'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCreateClient = async () => {
    try {
      const clientData = {
        ...clientForm,
        user_friendly_name: clientForm.user_friendly_name || clientForm.user_name
      };
      const response = await botCotacaoService.createClient(clientData);
      if (response.sucesso) {
        toast({
          title: 'Sucesso',
          description: 'Cliente cadastrado com sucesso',
        });
        setShowNewClientModal(false);
        resetClientForm();
        await loadRegisteredGroups(); // Atualizar lista de clientes
      } else {
        throw new Error(response.mensagem || 'Erro ao cadastrar cliente');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao cadastrar cliente',
        variant: 'destructive'
      });
    }
  };

  const handleAddGroup = async () => {
    try {
      const selectedWhatsAppGroup = whatsappGroups.find(g => g.id === groupForm.whatsapp_group_id);
      if (!selectedWhatsAppGroup) {
        throw new Error('Grupo do WhatsApp não encontrado');
      }

      const groupData = {
        ...groupForm,
        whatsapp_group_name: selectedWhatsAppGroup.name
      };

      const response = await botCotacaoService.addGroupToClient(groupData);
      if (response.sucesso) {
        toast({
          title: 'Sucesso',
          description: 'Grupo vinculado com sucesso',
        });
        setShowAddGroupModal(false);
        resetGroupForm();
        await loadRegisteredGroups();
        await loadDashboardStats();
      } else {
        throw new Error(response.mensagem || 'Erro ao vincular grupo');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao vincular grupo',
        variant: 'destructive'
      });
    }
  };

  const handleEditGroup = async () => {
    if (!selectedGroup) return;

    try {
      const updateData: any = {};
      
      if (groupForm.fee_percentual !== undefined) {
        updateData.fee_percentual = groupForm.fee_percentual === 0 ? null : groupForm.fee_percentual;
      }

      const response = await botCotacaoService.updateGroupFee(selectedGroup.id, updateData);
      if (response.sucesso) {
        toast({
          title: 'Sucesso',
          description: 'Grupo atualizado com sucesso',
        });
        setShowEditGroupModal(false);
        setSelectedGroup(null);
        resetGroupForm();
        await loadRegisteredGroups();
        await loadDashboardStats();
      } else {
        throw new Error(response.mensagem || 'Erro ao atualizar grupo');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar grupo',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Tem certeza que deseja remover este grupo?')) return;

    try {
      const response = await botCotacaoService.removeGroup(groupId);
      if (response.sucesso) {
        toast({
          title: 'Sucesso',
          description: 'Grupo removido com sucesso',
        });
        await loadRegisteredGroups();
        await loadDashboardStats();
      } else {
        throw new Error(response.mensagem || 'Erro ao remover grupo');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao remover grupo',
        variant: 'destructive'
      });
    }
  };

  const resetClientForm = () => {
    setClientForm({
      user_name: '',
      user_document: '',
      user_type: 'personal',
      user_friendly_name: ''
    });
  };

  const resetGroupForm = () => {
    setGroupForm({
      whatsapp_group_id: '',
      whatsapp_group_name: '',
      id_otc_user: '',
      fee_percentual: undefined
    });
  };

  const openEditGroupModal = (group: RegisteredGroup) => {
    setSelectedGroup(group);
    setGroupForm({
      whatsapp_group_id: group.whatsapp_group_id,
      whatsapp_group_name: group.whatsapp_group_name,
      id_otc_user: group.id_otc_user,
      fee_percentual: group.fee_percentual || undefined
    });
    setShowEditGroupModal(true);
  };

  // Grupos não cadastrados
  const unregisteredGroups = whatsappGroups.filter(wg => 
    !registeredGroups.some(rg => rg.whatsapp_group_id === wg.id)
  );

  // Debug: Logs para identificar inconsistência
  React.useEffect(() => {
    if (whatsappGroups.length > 0 && registeredGroups.length > 0) {
      console.log('🔍 DEBUG - Análise de Sincronização:');
      console.log('📱 Grupos WhatsApp carregados:', whatsappGroups.length);
      console.log('📋 Grupos cadastrados:', registeredGroups.length);
      
      // Verificar possíveis IDs inconsistentes
      const registeredIds = registeredGroups.map(rg => rg.whatsapp_group_id);
      const whatsappIds = whatsappGroups.map(wg => wg.id);
      
      console.log('🆔 IDs registrados no banco:', registeredIds);
      console.log('🆔 IDs dos grupos WhatsApp:', whatsappIds);
      
      // Análise detalhada: quais IDs estão em cada lista
      const idsNoWhatsAppMasNaoBanco = whatsappIds.filter(id => !registeredIds.includes(id));
      const idsNoBancoMasNaoWhatsApp = registeredIds.filter(id => !whatsappIds.includes(id));
      const idsEmAmbos = whatsappIds.filter(id => registeredIds.includes(id));
      
      console.log('🔵 Grupos só no WhatsApp (não cadastrados):', idsNoWhatsAppMasNaoBanco.length, idsNoWhatsAppMasNaoBanco);
      console.log('🔴 Grupos só no banco (não no WhatsApp):', idsNoBancoMasNaoWhatsApp.length, idsNoBancoMasNaoWhatsApp);
      console.log('🟢 Grupos em ambos (sincronizados):', idsEmAmbos.length, idsEmAmbos);
      
      // Grupos que aparecem como "não cadastrados" mas podem estar no banco
      const suspiciousGroups = whatsappGroups.filter(wg => {
        const isInRegistered = registeredGroups.some(rg => rg.whatsapp_group_id === wg.id);
        if (!isInRegistered) {
          // Verificar se o nome coincide (possível diferença de ID)
          const nameMatch = registeredGroups.find(rg => 
            rg.whatsapp_group_name.toLowerCase() === wg.name.toLowerCase()
          );
          if (nameMatch) {
            console.log(`⚠️ SUSPEITO - Grupo "${wg.name}":
              - ID WhatsApp: ${wg.id}
              - ID no banco: ${nameMatch.whatsapp_group_id}
              - Cliente: ${nameMatch.client_name}`);
            return true;
          }
        }
        return false;
      });
      
      if (suspiciousGroups.length > 0) {
        console.log('🚨 Encontrados', suspiciousGroups.length, 'grupos com possível inconsistência de ID');
      } else {
        console.log('✅ Nenhuma inconsistência de ID detectada');
      }
      
      // Verificar se o número de grupos "não cadastrados" está correto
      const calculatedUnregistered = whatsappGroups.filter(wg => 
        !registeredGroups.some(rg => rg.whatsapp_group_id === wg.id)
      );
      console.log('📊 Grupos não cadastrados calculados:', calculatedUnregistered.length);
      console.log('📋 Primeiros 5 grupos não cadastrados:', calculatedUnregistered.slice(0, 5).map(g => ({ id: g.id, name: g.name })));
    }
  }, [whatsappGroups, registeredGroups]);

  // Grupos filtrados e paginados
  const filteredWhatsappGroups = unregisteredGroups.filter(group =>
    group.name.toLowerCase().includes(whatsappFilter.toLowerCase())
  );

  const totalWhatsappPages = Math.ceil(filteredWhatsappGroups.length / whatsappPageSize);
  const paginatedWhatsappGroups = filteredWhatsappGroups.slice(
    (whatsappPage - 1) * whatsappPageSize,
    whatsappPage * whatsappPageSize
  );

  // Grupos cadastrados filtrados e paginados
  const filteredRegisteredGroups = registeredGroups.filter(group =>
    group.whatsapp_group_name.toLowerCase().includes(registeredFilter.toLowerCase()) ||
    group.client_name.toLowerCase().includes(registeredFilter.toLowerCase())
  );

  const totalRegisteredPages = Math.ceil(filteredRegisteredGroups.length / registeredPageSize);
  const paginatedRegisteredGroups = filteredRegisteredGroups.slice(
    (registeredPage - 1) * registeredPageSize,
    registeredPage * registeredPageSize
  );

  // Resetar página quando filtro mudar
  React.useEffect(() => {
    setWhatsappPage(1);
  }, [whatsappFilter]);

  React.useEffect(() => {
    setRegisteredPage(1);
  }, [registeredFilter]);

  // Funções para seleção múltipla
  const handleSelectGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedGroups.size === paginatedWhatsappGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(paginatedWhatsappGroups.map(g => g.id)));
    }
  };

  const handleBulkAdd = async () => {
    if (selectedGroups.size === 0) {
      toast({
        title: 'Aviso',
        description: 'Selecione pelo menos um grupo para cadastrar',
        variant: 'destructive'
      });
      return;
    }

    setBulkAddLoading(true);
    try {
      const selectedGroupsData = Array.from(selectedGroups).map(groupId => {
        const group = unregisteredGroups.find(g => g.id === groupId);
        return {
          name: group?.name || '',
          phone: groupId
        };
      });

      const response = await botCotacaoService.addGroupsFromWhatsApp({
        id_otc_user: bulkAddForm.id_otc_user,
        grupos_whatsapp: selectedGroupsData,
        fee_percentual_padrao: bulkAddForm.fee_percentual_padrao || undefined
      });

      if (response.sucesso || response.statusCode === 207) {
        const data = response.data;
        
        console.log('📝 Resultado do cadastro em lote:', data);
        
        toast({
          title: 'Sucesso',
          description: `${data?.cadastradosAgora || 0} grupos cadastrados com sucesso`,
        });

        // Mostrar relatório detalhado se houver grupos já existentes
        if (data?.jaExistiam > 0) {
          toast({
            title: 'Aviso',
            description: `${data.jaExistiam} grupos já estavam cadastrados`,
            variant: 'default'
          });
        }

        setShowBulkAddModal(false);
        setSelectedGroups(new Set());
        setBulkAddForm({ id_otc_user: '', fee_percentual_padrao: 0 });
        
        // Forçar recarregamento completo dos dados
        console.log('🔄 Forçando recarregamento completo dos dados...');
        await Promise.all([
          loadRegisteredGroups(),
          loadWhatsAppGroups(), // Recarregar também os grupos WhatsApp
          loadDashboardStats()
        ]);
        
      } else {
        throw new Error(response.mensagem || 'Erro ao cadastrar grupos');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao cadastrar grupos',
        variant: 'destructive'
      });
    } finally {
      setBulkAddLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Bot de Cotação TCR"
          description="Sistema de gestão do bot WhatsApp para cotações automáticas"
          breadcrumbs={[
            { label: "Bot Cotação", isActive: true }
          ]}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Bot de Cotação TCR"
        description="Sistema de gestão do bot WhatsApp para cotações automáticas"
        breadcrumbs={[
          { label: "Bot Cotação", isActive: true }
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header com Status e Ações */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Badge variant={botStatus?.is_active ? 'default' : 'secondary'} className="px-3 py-1">
              <Bot className="h-3 w-3 mr-1" />
              {botStatus?.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {botStatus?.status_message || 'Status desconhecido'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={async () => {
                toast({
                  title: 'Testando Conectividade',
                  description: 'Verificando conexão com a API...'
                });
                
                try {
                  const result = await botCotacaoService.testConnectivity();
                  toast({
                    title: result.sucesso ? 'Sucesso' : 'Erro',
                    description: result.mensagem,
                    variant: result.sucesso ? 'default' : 'destructive'
                  });
                  
                  if (result.sucesso) {
                    loadInitialData();
                  }
                } catch (error) {
                  toast({
                    title: 'Erro de Teste',
                    description: 'Falha ao testar conectividade',
                    variant: 'destructive'
                  });
                }
              }}
              variant="secondary"
              size="sm"
            >
              <Activity className="h-4 w-4 mr-2" />
              Testar API
            </Button>
            <Button
              onClick={handleSyncGroups}
              disabled={syncLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button
              onClick={() => {
                console.log('🔍 DIAGNÓSTICO MANUAL - Analisando inconsistências...');
                console.log('📱 Grupos WhatsApp:', whatsappGroups);
                console.log('📋 Grupos Cadastrados:', registeredGroups);
                
                // Análise detalhada
                const problematicos = [];
                whatsappGroups.forEach(wg => {
                  const found = registeredGroups.find(rg => rg.whatsapp_group_id === wg.id);
                  const nameMatch = registeredGroups.find(rg => 
                    rg.whatsapp_group_name.toLowerCase() === wg.name.toLowerCase()
                  );
                  
                  if (!found && nameMatch) {
                    problematicos.push({
                      nome: wg.name,
                      idWhatsApp: wg.id,
                      idBanco: nameMatch.whatsapp_group_id,
                      cliente: nameMatch.client_name
                    });
                  }
                });
                
                if (problematicos.length > 0) {
                  console.table(problematicos);
                  toast({
                    title: 'Inconsistências Detectadas',
                    description: `${problematicos.length} grupos com possível problema de ID. Verifique o console.`,
                    variant: 'destructive'
                  });
                } else {
                  toast({
                    title: 'Nenhum Problema Detectado',
                    description: 'Todos os grupos estão sincronizados corretamente.',
                  });
                }
              }}
              variant="secondary"
              size="sm"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Debug
            </Button>
          </div>
        </div>



        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_clients || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grupos Ativos</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_groups || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa Média</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.average_fee?.toFixed(2) || '0.00'}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status do Bot</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {botStatus?.is_active ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">Online</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações Principais */}
        <div className="flex space-x-4">
          <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
            <DialogTrigger asChild>
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Adicione um novo cliente ao sistema para vincular grupos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user_name">Nome Completo</Label>
                  <Input
                    id="user_name"
                    value={clientForm.user_name}
                    onChange={(e) => setClientForm(prev => ({ ...prev, user_name: e.target.value }))}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <Label htmlFor="user_document">CPF/CNPJ</Label>
                  <Input
                    id="user_document"
                    value={clientForm.user_document}
                    onChange={(e) => setClientForm(prev => ({ ...prev, user_document: e.target.value }))}
                    placeholder="Documento sem pontuação"
                  />
                </div>
                <div>
                  <Label htmlFor="user_friendly_name">Nome Amigável (opcional)</Label>
                  <Input
                    id="user_friendly_name"
                    value={clientForm.user_friendly_name}
                    onChange={(e) => setClientForm(prev => ({ ...prev, user_friendly_name: e.target.value }))}
                    placeholder="Como o cliente prefere ser chamado"
                  />
                </div>
                <div>
                  <Label htmlFor="user_type">Tipo de Cliente</Label>
                  <Select 
                    value={clientForm.user_type} 
                    onValueChange={(value: 'personal' | 'business') => 
                      setClientForm(prev => ({ ...prev, user_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Pessoa Física</SelectItem>
                      <SelectItem value="business">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewClientModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateClient}>
                  Cadastrar Cliente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


        </div>

        {/* Grupos Disponíveis do WhatsApp com Paginação */}
        {whatsappGroups.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Grupos do WhatsApp Disponíveis</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {filteredWhatsappGroups.length} grupos filtrados de {unregisteredGroups.length} não cadastrados
                  </p>
                </div>
                <div className="w-64">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome do grupo..."
                      value={whatsappFilter}
                      onChange={(e) => setWhatsappFilter(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
                            {filteredWhatsappGroups.length > 0 ? (
                <>
                  {/* Barra de Ações */}
                  {selectedGroups.size > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Badge variant="secondary" className="px-3 py-1">
                            {selectedGroups.size} grupo(s) selecionado(s)
                          </Badge>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => setSelectedGroups(new Set())}
                            className="text-blue-600"
                          >
                            Limpar seleção
                          </Button>
                        </div>
                        <Button
                          onClick={() => setShowBulkAddModal(true)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Cadastrar Selecionados
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Grupos */}
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="w-12">
                           <Checkbox
                             checked={selectedGroups.size === paginatedWhatsappGroups.length && paginatedWhatsappGroups.length > 0}
                             onCheckedChange={handleSelectAll}
                             aria-label="Selecionar todos os grupos"
                           />
                         </TableHead>
                         <TableHead>Nome do Grupo</TableHead>
                         <TableHead>ID do Grupo</TableHead>
                         <TableHead>Mensagens</TableHead>
                         <TableHead>Status</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {paginatedWhatsappGroups.map((group) => (
                         <TableRow key={group.id}>
                           <TableCell>
                             <Checkbox
                               checked={selectedGroups.has(group.id)}
                               onCheckedChange={() => handleSelectGroup(group.id)}
                               aria-label={`Selecionar ${group.name}`}
                             />
                           </TableCell>
                           <TableCell>
                             <div className="font-medium">{group.name}</div>
                           </TableCell>
                           <TableCell>
                             <div className="text-xs text-muted-foreground font-mono">
                               {group.id}
                             </div>
                           </TableCell>
                           <TableCell>
                             <Badge variant="secondary">
                               {group.participants_count} não lidas
                             </Badge>
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className="text-orange-600 border-orange-600">
                               Não Cadastrado
                             </Badge>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>

                  {/* Paginação */}
                  {totalWhatsappPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((whatsappPage - 1) * whatsappPageSize) + 1} a{' '}
                        {Math.min(whatsappPage * whatsappPageSize, filteredWhatsappGroups.length)} de{' '}
                        {filteredWhatsappGroups.length} grupos
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWhatsappPage(1)}
                          disabled={whatsappPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWhatsappPage(prev => Math.max(prev - 1, 1))}
                          disabled={whatsappPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Página {whatsappPage} de {totalWhatsappPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWhatsappPage(prev => Math.min(prev + 1, totalWhatsappPages))}
                          disabled={whatsappPage === totalWhatsappPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWhatsappPage(totalWhatsappPages)}
                          disabled={whatsappPage === totalWhatsappPages}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {whatsappFilter ? (
                    <>
                      <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p>Nenhum grupo encontrado com o termo "{whatsappFilter}"</p>
                      <Button
                        variant="link"
                        onClick={() => setWhatsappFilter('')}
                        className="mt-2"
                      >
                        Limpar filtro
                      </Button>
                    </>
                  ) : (
                    <p>Todos os grupos do WhatsApp já estão cadastrados</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabela de Grupos Cadastrados */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Grupos Cadastrados</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredRegisteredGroups.length} grupos filtrados de {registeredGroups.length} cadastrados
                </p>
              </div>
              <div className="w-64">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por grupo ou cliente..."
                    value={registeredFilter}
                    onChange={(e) => setRegisteredFilter(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRegisteredGroups.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Taxa do Grupo</TableHead>
                      <TableHead>Taxa Efetiva</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRegisteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{group.whatsapp_group_name}</div>
                            <div className="text-sm text-muted-foreground">
                              ID: {group.whatsapp_group_id.slice(-8)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{group.client_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {group.otc_user?.user_type === 'business' ? 'Empresa' : 'Pessoa Física'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {group.fee_percentual !== null ? (
                            <Badge variant="secondary">
                              {group.fee_percentual}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Padrão</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge>
                            <DollarSign className="h-3 w-3 mr-1" />
                            {group.effective_fee}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditGroupModal(group)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteGroup(group.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {totalRegisteredPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((registeredPage - 1) * registeredPageSize) + 1} a{' '}
                      {Math.min(registeredPage * registeredPageSize, filteredRegisteredGroups.length)} de{' '}
                      {filteredRegisteredGroups.length} grupos
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegisteredPage(1)}
                        disabled={registeredPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegisteredPage(prev => Math.max(prev - 1, 1))}
                        disabled={registeredPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Página {registeredPage} de {totalRegisteredPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegisteredPage(prev => Math.min(prev + 1, totalRegisteredPages))}
                        disabled={registeredPage === totalRegisteredPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegisteredPage(totalRegisteredPages)}
                        disabled={registeredPage === totalRegisteredPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {registeredFilter ? (
                  <>
                    <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>Nenhum grupo encontrado com o termo "{registeredFilter}"</p>
                    <Button
                      variant="link"
                      onClick={() => setRegisteredFilter('')}
                      className="mt-2"
                    >
                      Limpar filtro
                    </Button>
                  </>
                ) : (
                  <p>Nenhum grupo cadastrado. Comece vinculando um grupo do WhatsApp.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Edição */}
        <Dialog open={showEditGroupModal} onOpenChange={setShowEditGroupModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Grupo</DialogTitle>
              <DialogDescription>
                Alterar configurações do grupo {selectedGroup?.whatsapp_group_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_fee_percentual">Taxa Específica (%)</Label>
                <Input
                  id="edit_fee_percentual"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={groupForm.fee_percentual || ''}
                  onChange={(e) => setGroupForm(prev => ({ 
                    ...prev, 
                    fee_percentual: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  placeholder="Taxa específica do grupo"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditGroupModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditGroup}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Cadastro em Lote */}
        <Dialog open={showBulkAddModal} onOpenChange={setShowBulkAddModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Grupos Selecionados</DialogTitle>
              <DialogDescription>
                Cadastrar {selectedGroups.size} grupos do WhatsApp no sistema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Resumo dos grupos selecionados */}
              <div>
                <Label>Grupos Selecionados ({selectedGroups.size})</Label>
                <div className="mt-2 max-h-40 overflow-y-auto border rounded p-3 bg-gray-50">
                  {Array.from(selectedGroups).map(groupId => {
                    const group = unregisteredGroups.find(g => g.id === groupId);
                    return (
                      <div key={groupId} className="text-sm py-1 border-b last:border-b-0">
                        <span className="font-medium">{group?.name}</span>
                        <span className="text-muted-foreground ml-2">({groupId})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seleção do cliente */}
              <div>
                <Label htmlFor="bulk_client">Cliente Responsável</Label>
                <Select 
                  value={bulkAddForm.id_otc_user} 
                  onValueChange={(value) => setBulkAddForm(prev => ({ ...prev, id_otc_user: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({client.document})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Taxa padrão */}
              <div>
                <Label htmlFor="bulk_fee">Taxa Padrão para os Grupos (%)</Label>
                <Input
                  id="bulk_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={bulkAddForm.fee_percentual_padrao}
                  onChange={(e) => setBulkAddForm(prev => ({ 
                    ...prev, 
                    fee_percentual_padrao: parseFloat(e.target.value) || 0 
                  }))}
                  placeholder="Deixe 0 para usar taxa do cliente"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Taxa específica para todos os grupos selecionados
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowBulkAddModal(false);
                  setBulkAddForm({ id_otc_user: '', fee_percentual_padrao: 0 });
                }}
                disabled={bulkAddLoading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleBulkAdd}
                disabled={bulkAddLoading || !bulkAddForm.id_otc_user}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkAddLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar {selectedGroups.size} Grupos
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BotCotacao; 