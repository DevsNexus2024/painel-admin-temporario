import React, { useState, useEffect } from 'react';
import { X, User, CreditCard, Key, Mail, Phone, Hash, IdCard, Lock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useOTCClients } from '@/hooks/useOTCClients';
import { otcService } from '@/services/otc';
import { 
  OTCClient, 
  PixKeyType, 
  CreateOTCClientRequest, 
  CreateCompleteOTCClientRequest 
} from '@/types/otc';

interface OTCClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: OTCClient;
}

/**
 * Modal para criar/editar clientes OTC
 */
const OTCClientModal: React.FC<OTCClientModalProps> = ({
  isOpen,
  onClose,
  client
}) => {
  const { createClient, updateClient, isCreating, isUpdating } = useOTCClients();
  const isEditing = !!client;
  const isLoading = isCreating || isUpdating;

  // Estado do formulário
  const [formData, setFormData] = useState({
    // Dados simplificados
    name: '', // Nome reaproveitado para usuário e cliente
    email: '',
    password: '',
    pix_key: '',
    pix_key_type: 'email' as PixKeyType,
    // Dados para edição (mantidos para compatibilidade)
    user_id: '',
    client_name: '',
    client_document: ''
  });

  // Estados de validação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      if (client) {
        setFormData({
          name: '',
          email: '',
          password: '',
          pix_key: client.pix_key,
          pix_key_type: client.pix_key_type,
          user_id: client.user?.id.toString() || '',
          client_name: client.name,
          client_document: client.document
        });
      } else {
        setFormData({
          name: '',
          email: '',
          password: '',
          pix_key: '',
          pix_key_type: 'email',
          user_id: '',
          client_name: '',
          client_document: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, client]);

  // Atualizar campo do formulário
  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpar erro do campo quando o usuário começa a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validações para novo usuário (apenas se não for edição)
    if (!isEditing) {
      // Validar nome (opcional, mas se preenchido deve ter pelo menos 2 caracteres)
      if (formData.name.trim() && formData.name.length < 2) {
        newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
      }

      // Validar email (opcional, mas se preenchido deve ter formato válido)
      if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Email inválido';
      }

      // Validar senha (opcional, mas se preenchida deve ter pelo menos 6 caracteres)
      if (formData.password.trim() && formData.password.length < 6) {
        newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
      }

      // Validar chave PIX (opcional, mas se preenchida deve ser válida)
      if (formData.pix_key.trim() && !otcService.validatePixKey(formData.pix_key, formData.pix_key_type)) {
        newErrors.pix_key = 'Chave PIX inválida para o tipo selecionado';
      }
    } else {
      // Para edição, manter validações existentes mas tornar campos opcionais
      if (formData.client_name.trim() && formData.client_name.length < 2) {
        newErrors.client_name = 'Nome do cliente deve ter pelo menos 2 caracteres';
      }

      if (formData.client_document.trim() && !otcService.validateDocument(formData.client_document)) {
        newErrors.client_document = 'CPF ou CNPJ inválido';
      }

      if (formData.pix_key.trim() && !otcService.validatePixKey(formData.pix_key, formData.pix_key_type)) {
        newErrors.pix_key = 'Chave PIX inválida para o tipo selecionado';
      }

      // User ID ainda obrigatório para edição
      if (!formData.user_id) {
        newErrors.user_id = 'Usuário é obrigatório';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setIsValidating(true);

    try {
      if (isEditing) {
        // Editar cliente existente
        const clientData: CreateOTCClientRequest = {
          user_id: parseInt(formData.user_id),
          client_name: formData.client_name.trim(),
          client_document: formData.client_document.replace(/[^\d]/g, ''),
          pix_key: formData.pix_key.trim(),
          pix_key_type: formData.pix_key_type
        };

        await updateClient({ 
          id: client!.id, 
          clientData 
        });
      } else {
        // Criar novo usuário + cliente (simplificado)
        const completeData: CreateCompleteOTCClientRequest = {
          user_name: formData.name.trim(),
          user_email: formData.email.trim().toLowerCase(),
          user_password: formData.password,
          user_document: '', // Opcional
          user_phone: '', // Opcional
          client_name: formData.name.trim(), // Reaproveita o nome
          client_document: '', // Opcional inicialmente
          pix_key: formData.pix_key.trim(),
          pix_key_type: formData.pix_key_type
        };

        await createClient(completeData, true);
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // Ícones para tipos de chave PIX
  const getPixKeyIcon = (type: PixKeyType) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'cpf':
      case 'cnpj':
        return <IdCard className="w-4 h-4" />;
      case 'random':
        return <Hash className="w-4 h-4" />;
      default:
        return <Key className="w-4 h-4" />;
    }
  };

  // Labels para tipos de chave PIX
  const getPixKeyLabel = (type: PixKeyType) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'phone':
        return 'Telefone';
      case 'cpf':
        return 'CPF';
      case 'cnpj':
        return 'CNPJ';
      case 'random':
        return 'Chave Aleatória';
      default:
        return 'Chave PIX';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <User className="w-5 h-5" />
                Editar Cliente OTC
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Novo Cliente OTC
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Edite as informações do cliente OTC (todos os campos são opcionais)'
              : 'Cadastro simplificado: todos os campos são opcionais'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Básicos (sempre visível) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {isEditing ? (
                  <>
                    <User className="w-4 h-4" />
                    Editar Cliente OTC
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Dados Básicos
                  </>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isEditing 
                  ? 'Edite as informações do cliente OTC (campos opcionais)'
                  : 'Informações para login e identificação (campos opcionais)'
                }
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isEditing ? (
                // Formulário simplificado para novo cliente
                <>
                  {/* Nome */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Ex: João Silva"
                      className={errors.name ? 'border-red-500' : ''}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Este nome será usado tanto para login quanto para o cliente OTC (opcional)
                    </p>
                  </div>

                  {/* Email e Senha */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Login)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="joao@exemplo.com"
                        className={errors.email ? 'border-red-500' : ''}
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={errors.password ? 'border-red-500' : ''}
                      />
                      {errors.password && (
                        <p className="text-sm text-red-500">{errors.password}</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                // Formulário para edição (mantém campos existentes)
                <>
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Nome do Cliente</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name}
                      onChange={(e) => updateField('client_name', e.target.value)}
                      placeholder="Ex: João Silva"
                      className={errors.client_name ? 'border-red-500' : ''}
                    />
                    {errors.client_name && (
                      <p className="text-sm text-red-500">{errors.client_name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client_document">CPF/CNPJ</Label>
                    <Input
                      id="client_document"
                      value={formData.client_document}
                      onChange={(e) => updateField('client_document', e.target.value)}
                      placeholder="Ex: 123.456.789-00"
                      className={errors.client_document ? 'border-red-500' : ''}
                    />
                    {errors.client_document && (
                      <p className="text-sm text-red-500">{errors.client_document}</p>
                    )}
                    {formData.client_document && otcService.validateDocument(formData.client_document) && (
                      <p className="text-sm text-green-600">
                        ✓ {otcService.formatDocument(formData.client_document)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user_id">ID do Usuário *</Label>
                    <Input
                      id="user_id"
                      type="number"
                      value={formData.user_id}
                      onChange={(e) => updateField('user_id', e.target.value)}
                      placeholder="Ex: 123"
                      className={errors.user_id ? 'border-red-500' : ''}
                    />
                    {errors.user_id && (
                      <p className="text-sm text-red-500">{errors.user_id}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Chave PIX */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-4 h-4" />
                Chave PIX para Recebimentos
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configurar chave PIX para receber depósitos automaticamente
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de Chave PIX */}
              <div className="space-y-2">
                <Label htmlFor="pix_key_type">Tipo de Chave PIX</Label>
                <Select
                  value={formData.pix_key_type}
                  onValueChange={(value) => updateField('pix_key_type', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="phone">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Telefone
                      </div>
                    </SelectItem>
                    <SelectItem value="cpf">
                      <div className="flex items-center gap-2">
                        <IdCard className="w-4 h-4" />
                        CPF
                      </div>
                    </SelectItem>
                    <SelectItem value="cnpj">
                      <div className="flex items-center gap-2">
                        <IdCard className="w-4 h-4" />
                        CNPJ
                      </div>
                    </SelectItem>
                    <SelectItem value="random">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Chave Aleatória
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chave PIX */}
              <div className="space-y-2">
                <Label htmlFor="pix_key">
                  <div className="flex items-center gap-2">
                    {getPixKeyIcon(formData.pix_key_type)}
                    {getPixKeyLabel(formData.pix_key_type)}
                  </div>
                </Label>
                <Input
                  id="pix_key"
                  value={formData.pix_key}
                  onChange={(e) => updateField('pix_key', e.target.value)}
                  placeholder={
                    formData.pix_key_type === 'email' ? 'Ex: otc@tcr.finance' :
                    formData.pix_key_type === 'phone' ? 'Ex: +5511999999999' :
                    formData.pix_key_type === 'cpf' ? 'Ex: 123.456.789-00' :
                    formData.pix_key_type === 'cnpj' ? 'Ex: 12.345.678/0001-90' :
                    'Ex: 123e4567-e12b-12d3-a456-426614174000'
                  }
                  className={errors.pix_key ? 'border-red-500' : ''}
                />
                {errors.pix_key && (
                  <p className="text-sm text-red-500">{errors.pix_key}</p>
                )}
                {formData.pix_key && otcService.validatePixKey(formData.pix_key, formData.pix_key_type) && (
                  <p className="text-sm text-green-600">
                    ✓ Chave PIX válida
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isValidating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading || isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isEditing ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                <>
                  {isEditing ? 'Salvar Alterações' : 'Criar Cliente'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OTCClientModal; 