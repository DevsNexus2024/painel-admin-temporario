import React, { useState, useEffect } from 'react';
import { X, User, CreditCard, Key, Mail, Phone, Hash, IdCard } from 'lucide-react';
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
import { OTCClient, PixKeyType, CreateOTCClientRequest } from '@/types/otc';

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
    user_id: '',
    client_name: '',
    client_document: '',
    pix_key: '',
    pix_key_type: 'email' as PixKeyType
  });

  // Estados de validação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      if (client) {
        setFormData({
          user_id: client.user?.id.toString() || '',
          client_name: client.name,
          client_document: client.document,
          pix_key: client.pix_key,
          pix_key_type: client.pix_key_type
        });
      } else {
        setFormData({
          user_id: '',
          client_name: '',
          client_document: '',
          pix_key: '',
          pix_key_type: 'email'
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

    // Validar nome
    if (!formData.client_name.trim()) {
      newErrors.client_name = 'Nome do cliente é obrigatório';
    } else if (formData.client_name.length < 2) {
      newErrors.client_name = 'Nome deve ter pelo menos 2 caracteres';
    }

    // Validar documento
    if (!formData.client_document.trim()) {
      newErrors.client_document = 'Documento é obrigatório';
    } else if (!otcService.validateDocument(formData.client_document)) {
      newErrors.client_document = 'CPF ou CNPJ inválido';
    }

    // Validar chave PIX
    if (!formData.pix_key.trim()) {
      newErrors.pix_key = 'Chave PIX é obrigatória';
    } else if (!otcService.validatePixKey(formData.pix_key, formData.pix_key_type)) {
      newErrors.pix_key = 'Chave PIX inválida para o tipo selecionado';
    }

    // Validar user_id (apenas para criação)
    if (!isEditing && !formData.user_id) {
      newErrors.user_id = 'Usuário é obrigatório';
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
      const clientData: CreateOTCClientRequest = {
        user_id: parseInt(formData.user_id),
        client_name: formData.client_name.trim(),
        client_document: formData.client_document.replace(/[^\d]/g, ''),
        pix_key: formData.pix_key.trim(),
        pix_key_type: formData.pix_key_type
      };

      if (isEditing) {
        await updateClient({ 
          id: client!.id, 
          clientData 
        });
      } else {
        await createClient(clientData);
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {isEditing ? 'Editar Cliente OTC' : 'Novo Cliente OTC'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Edite as informações do cliente OTC'
              : 'Preencha as informações para criar um novo cliente OTC'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Nome do Cliente */}
              <div className="space-y-2">
                <Label htmlFor="client_name">Nome do Cliente *</Label>
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

              {/* Documento */}
              <div className="space-y-2">
                <Label htmlFor="client_document">CPF/CNPJ *</Label>
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

              {/* User ID (apenas para criação) */}
              {!isEditing && (
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
              )}
            </CardContent>
          </Card>

          {/* Chave PIX */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-4 h-4" />
                Chave PIX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de Chave PIX */}
              <div className="space-y-2">
                <Label htmlFor="pix_key_type">Tipo de Chave PIX *</Label>
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
                    {getPixKeyLabel(formData.pix_key_type)} *
                  </div>
                </Label>
                <Input
                  id="pix_key"
                  value={formData.pix_key}
                  onChange={(e) => updateField('pix_key', e.target.value)}
                  placeholder={
                    formData.pix_key_type === 'email' ? 'Ex: joao@exemplo.com' :
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