/**
 * 📝 EXEMPLOS DE USO DO SISTEMA DE PERMISSÕES
 * Demonstrações práticas de como usar os componentes de permissão
 */

import React from 'react';
import { 
  PermissionGuard, 
  RoleGuard, 
  MultiRoleGuard, 
  AdminGuard, 
  OTCGuard,
  ConditionalGuard,
  AuthGuard 
} from './PermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 🔐 BOTÕES BASEADOS EM PERMISSÕES
 */
export const PermissionButtons: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-4">
      {/* Botão apenas para admins */}
      <AdminGuard>
        <Button variant="destructive">
          Configurações do Sistema
        </Button>
      </AdminGuard>

      {/* Botão apenas com permissão específica */}
      <PermissionGuard permission="otc.create_clients">
        <Button variant="default">
          Criar Cliente OTC
        </Button>
      </PermissionGuard>

      {/* Botão para múltiplos roles */}
      <MultiRoleGuard roles={['admin', 'manager']}>
        <Button variant="secondary">
          Relatórios Gerenciais
        </Button>
      </MultiRoleGuard>

      {/* Botão apenas para clientes OTC */}
      <OTCGuard clientOnly={true}>
        <Button variant="outline">
          Meu Extrato
        </Button>
      </OTCGuard>

      {/* Botão condicional avançado */}
      <ConditionalGuard
        anyPermissions={['pix.send', 'banking.transfer']}
        showFallback={true}
        fallback={
          <Button variant="ghost" disabled>
            Transferir (Sem Permissão)
          </Button>
        }
      >
        <Button variant="default">
          Transferir PIX
        </Button>
      </ConditionalGuard>
    </div>
  );
};

/**
 * 🎯 NAVEGAÇÃO BASEADA EM ROLES
 */
export const RoleBasedNavigation: React.FC = () => {
  return (
    <nav className="space-y-2">
      {/* Seção Admin */}
      <AdminGuard>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="font-semibold text-red-800 mb-2">Administração</h3>
          <ul className="space-y-1 text-sm">
            <li><a href="/admin/users" className="text-red-600 hover:underline">Gerenciar Usuários</a></li>
            <li><a href="/admin/settings" className="text-red-600 hover:underline">Configurações</a></li>
            <li><a href="/admin/logs" className="text-red-600 hover:underline">Logs do Sistema</a></li>
          </ul>
        </div>
      </AdminGuard>

      {/* Seção OTC */}
      <PermissionGuard permission="otc.view_clients">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">OTC</h3>
          <ul className="space-y-1 text-sm">
            <li><a href="/otc/clients" className="text-blue-600 hover:underline">Clientes</a></li>
            <li><a href="/otc/operations" className="text-blue-600 hover:underline">Operações</a></li>
            <li><a href="/otc/stats" className="text-blue-600 hover:underline">Estatísticas</a></li>
          </ul>
        </div>
      </PermissionGuard>

      {/* Seção PIX */}
      <PermissionGuard permission="pix.view_transactions">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-800 mb-2">PIX</h3>
          <ul className="space-y-1 text-sm">
            <li><a href="/payments" className="text-green-600 hover:underline">Transações</a></li>
            <li><a href="/payments/keys" className="text-green-600 hover:underline">Chaves PIX</a></li>
            <li><a href="/payments/qr" className="text-green-600 hover:underline">QR Codes</a></li>
          </ul>
        </div>
      </PermissionGuard>

      {/* Seção apenas para funcionários */}
      <RoleGuard role="otc_employee">
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 className="font-semibold text-purple-800 mb-2">Funcionário</h3>
          <ul className="space-y-1 text-sm">
            <li><a href="/employee-statement" className="text-purple-600 hover:underline">Meu Extrato</a></li>
            <li><a href="/employee/access" className="text-purple-600 hover:underline">Gerenciar Acesso</a></li>
          </ul>
        </div>
      </RoleGuard>
    </nav>
  );
};

/**
 * 📊 DASHBOARD BASEADO EM PERMISSÕES
 */
export const PermissionDashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Card apenas para admins */}
      <AdminGuard>
        <Card className="border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-800">Sistema</CardTitle>
            <CardDescription>Configurações administrativas</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">Admin</div>
            <p className="text-sm text-red-500 mt-2">
              Você tem acesso total ao sistema
            </p>
          </CardContent>
        </Card>
      </AdminGuard>

      {/* Card para quem pode ver clientes OTC */}
      <PermissionGuard permission="otc.view_clients">
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-blue-800">Clientes OTC</CardTitle>
            <CardDescription>Gerenciamento de clientes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">156</div>
            <p className="text-sm text-blue-500 mt-2">
              Clientes ativos no sistema
            </p>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Card para quem pode ver transações PIX */}
      <PermissionGuard permission="pix.view_transactions">
        <Card className="border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-800">Transações PIX</CardTitle>
            <CardDescription>Movimentação financeira</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">R$ 45.2k</div>
            <p className="text-sm text-green-500 mt-2">
              Volume do dia
            </p>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Card para funcionários OTC */}
      <OTCGuard>
        <Card className="border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-purple-800">Meu Acesso</CardTitle>
            <CardDescription>Informações da conta</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">Ativo</div>
            <p className="text-sm text-purple-500 mt-2">
              Status do seu acesso
            </p>
          </CardContent>
        </Card>
      </OTCGuard>

      {/* Card condicional para relatórios */}
      <ConditionalGuard
        anyPermissions={['reports.view_financial', 'otc.view_stats']}
        showFallback={true}
        fallback={
          <Card className="border-gray-200 opacity-50">
            <CardHeader className="bg-gray-50">
              <CardTitle className="text-gray-400">Relatórios</CardTitle>
              <CardDescription>Acesso restrito</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-400">---</div>
              <p className="text-sm text-gray-400 mt-2">
                Sem permissão de acesso
              </p>
            </CardContent>
          </Card>
        }
      >
        <Card className="border-orange-200">
          <CardHeader className="bg-orange-50">
            <CardTitle className="text-orange-800">Relatórios</CardTitle>
            <CardDescription>Análises e estatísticas</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">24</div>
            <p className="text-sm text-orange-500 mt-2">
              Relatórios disponíveis
            </p>
          </CardContent>
        </Card>
      </ConditionalGuard>
    </div>
  );
};

/**
 * 🔄 MENU CONTEXTUAL BASEADO EM PERMISSÕES
 */
export const ContextualMenu: React.FC = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48">
      <AuthGuard>
        <div className="py-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Ações Disponíveis
          </div>
          
          <PermissionGuard permission="pix.send">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded">
              Enviar PIX
            </button>
          </PermissionGuard>
          
          <PermissionGuard permission="pix.create_qr">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded">
              Gerar QR Code
            </button>
          </PermissionGuard>
          
          <PermissionGuard permission="banking.view_statement">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded">
              Ver Extrato
            </button>
          </PermissionGuard>
          
          <div className="border-t border-gray-100 my-1"></div>
          
          <AdminGuard>
            <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded">
              Configurações Admin
            </button>
          </AdminGuard>
        </div>
      </AuthGuard>
    </div>
  );
};

/**
 * 📋 FORMULÁRIO COM CAMPOS CONDICIONAIS
 */
export const ConditionalForm: React.FC = () => {
  return (
    <form className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome</label>
        <input 
          type="text" 
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="Digite o nome"
        />
      </div>

      {/* Campo apenas para admins */}
      <AdminGuard>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Configuração Avançada (Admin)
          </label>
          <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <option>Opção 1</option>
            <option>Opção 2</option>
          </select>
        </div>
      </AdminGuard>

      {/* Campo para quem pode criar clientes */}
      <PermissionGuard permission="otc.create_clients">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Limite OTC
          </label>
          <input 
            type="number" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            placeholder="0.00"
          />
        </div>
      </PermissionGuard>

      {/* Botões condicionais */}
      <div className="flex gap-2">
        <button 
          type="submit" 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Salvar
        </button>
        
        <AdminGuard>
          <button 
            type="button" 
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Excluir
          </button>
        </AdminGuard>
      </div>
    </form>
  );
};

export default {
  PermissionButtons,
  RoleBasedNavigation,
  PermissionDashboard,
  ContextualMenu,
  ConditionalForm
};
