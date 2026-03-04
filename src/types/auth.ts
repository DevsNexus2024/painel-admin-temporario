/**
 * 🔐 TIPOS DE AUTENTICAÇÃO E PERMISSÕES
 * Sistema completo de roles e permissões do frontend
 */

// ===== TIPOS DE USUÁRIO =====
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'tcr_user'
  | 'otc_user'
  // legados/compatibilidade
  | 'otc_client'
  | 'otc_employee'
  | 'manager'
  | 'viewer';

export interface User {
  id: string | number;
  email: string;
  name?: string;
  role?: UserRole;
  createdAt?: string;
  updatedAt?: string;
  // Campos específicos do sistema
  is_admin?: boolean;
  document?: string;
  phone?: string;
  // RBAC v2 (BaaS-W3Build)
  roles?: string[];   // ex: ["PLATFORM:SUPER_ADMIN", "TENANT:OWNER:2"]
  scopes?: string[];  // ex: ["*"]
}

// ===== PERMISSÕES DO SISTEMA =====
export type Permission = 
  // Permissões de Administração
  | 'admin.full_access'
  | 'admin.user_management'
  | 'admin.system_config'
  
  // Permissões OTC
  | 'otc.view_clients'
  | 'otc.create_clients'
  | 'otc.edit_clients'
  | 'otc.delete_clients'
  | 'otc.view_operations'
  | 'otc.create_operations'
  | 'otc.reverse_operations'
  | 'otc.view_stats'
  | 'otc.manage_employees'
  
  // Permissões PIX
  | 'pix.send'
  | 'pix.receive'
  | 'pix.view_keys'
  | 'pix.create_keys'
  | 'pix.delete_keys'
  | 'pix.view_transactions'
  | 'pix.create_qr'
  
  // Permissões Bancárias
  | 'banking.view_balance'
  | 'banking.view_statement'
  | 'banking.transfer'
  | 'banking.view_accounts'
  | 'banking.manage_accounts'
  
  // Permissões de Relatórios
  | 'reports.view_financial'
  | 'reports.export_data'
  | 'reports.view_audit'
  
  // Permissões de Funcionário OTC
  | 'employee.view_own_statement'
  | 'employee.view_access_info'
  | 'employee.manage_access';

// ===== CONFIGURAÇÃO DE ROLES E PERMISSÕES =====
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Super Admin - Acesso total
  super_admin: [
    'admin.full_access',
    'admin.user_management',
    'admin.system_config',
    'otc.view_clients',
    'otc.create_clients',
    'otc.edit_clients',
    'otc.delete_clients',
    'otc.view_operations',
    'otc.create_operations',
    'otc.reverse_operations',
    'otc.view_stats',
    'otc.manage_employees',
    'pix.send',
    'pix.receive',
    'pix.view_keys',
    'pix.create_keys',
    'pix.delete_keys',
    'pix.view_transactions',
    'pix.create_qr',
    'banking.view_balance',
    'banking.view_statement',
    'banking.transfer',
    'banking.view_accounts',
    'banking.manage_accounts',
    'reports.view_financial',
    'reports.export_data',
    'reports.view_audit'
  ],

  // Administrador - Acesso completo
  admin: [
    'admin.full_access',
    'admin.user_management',
    'admin.system_config',
    'otc.view_clients',
    'otc.create_clients',
    'otc.edit_clients',
    'otc.delete_clients',
    'otc.view_operations',
    'otc.create_operations',
    'otc.reverse_operations',
    'otc.view_stats',
    'otc.manage_employees',
    'pix.send',
    'pix.receive',
    'pix.view_keys',
    'pix.create_keys',
    'pix.delete_keys',
    'pix.view_transactions',
    'pix.create_qr',
    'banking.view_balance',
    'banking.view_statement',
    'banking.transfer',
    'banking.view_accounts',
    'banking.manage_accounts',
    'reports.view_financial',
    'reports.export_data',
    'reports.view_audit'
  ],

  // Usuário OTC (painel) - acesso aos módulos OTC
  otc_user: [
    'otc.view_clients',
    'otc.create_clients',
    'otc.edit_clients',
    'otc.delete_clients',
    'otc.view_operations',
    'otc.create_operations',
    'otc.reverse_operations',
    'otc.view_stats',
    'otc.manage_employees',
    'pix.send',
    'pix.receive',
    'pix.view_keys',
    'pix.create_keys',
    'pix.delete_keys',
    'pix.view_transactions',
    'pix.create_qr',
    'banking.view_balance',
    'banking.view_statement',
    'banking.transfer',
    'reports.view_financial',
  ],

  // Usuário TCR - acesso limitado às telas TCR específicas
  tcr_user: [
    'banking.view_balance',
    'banking.view_statement',
    'reports.view_financial',
    'reports.view_audit',
  ],
  
  // Cliente OTC - Acesso limitado ao próprio extrato
  otc_client: [
    'employee.view_own_statement',
    'banking.view_balance',
    'banking.view_statement'
  ],
  
  // Funcionário OTC - Acesso a informações de funcionários
  otc_employee: [
    'employee.view_own_statement',
    'employee.view_access_info',
    'employee.manage_access',
    'banking.view_balance',
    'banking.view_statement'
  ],
  
  // Gerente - Acesso intermediário
  manager: [
    'otc.view_clients',
    'otc.view_operations',
    'otc.view_stats',
    'pix.send',
    'pix.receive',
    'pix.view_keys',
    'pix.view_transactions',
    'pix.create_qr',
    'banking.view_balance',
    'banking.view_statement',
    'banking.transfer',
    'banking.view_accounts',
    'reports.view_financial'
  ],
  
  // Visualizador - Apenas leitura
  viewer: [
    'otc.view_clients',
    'otc.view_operations',
    'pix.view_keys',
    'pix.view_transactions',
    'banking.view_balance',
    'banking.view_statement',
    'banking.view_accounts',
    'reports.view_financial'
  ]
};

// ===== RESULTADO DA VERIFICAÇÃO DE TIPO =====
export interface UserTypeResult {
  type: UserRole;
  isOTC: boolean;
  isAdmin: boolean;
  isEmployee?: boolean;
  isManager?: boolean;
  otcClient?: any;
  hasOTCRole?: boolean;
  otcAccess?: {
    client_id: number;
    client_name: string;
    client_document: string;
  };
  permissions: Permission[];
}

// ===== CONTEXTO DE AUTENTICAÇÃO =====
export interface AuthContextType {
  // Estado
  user: User | null;
  userType: UserTypeResult | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Ações
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  checkPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
}

// ===== CREDENCIAIS =====
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

// ===== ROTAS PROTEGIDAS =====
export interface RoutePermissions {
  requiredRole?: UserRole;
  requiredPermissions?: Permission[];
  requireAdmin?: boolean;
  requireEmployee?: boolean;
  allowedRoles?: UserRole[];
}

// ===== CONFIGURAÇÃO DE ROTAS =====
export const ROUTE_PERMISSIONS: Record<string, RoutePermissions> = {
  // ==================== SUPER ADMIN ONLY ====================
  // Home: permitido para todos os usuários "de painel" autenticados.
  // A página (`Index`) faz redirect para a melhor rota permitida quando não for admin.
  '/': { allowedRoles: ['super_admin', 'admin', 'tcr_user', 'otc_user'] },
  '/grupo-tcr/saldos': { allowedRoles: ['super_admin', 'admin'] },
  '/analise-usuario/:id': { allowedRoles: ['super_admin'] },
  '/contas-organizacoes': { allowedRoles: ['super_admin'] },
  '/contas-organizacoes/organizacao/:id': { allowedRoles: ['super_admin'] },
  '/contas-organizacoes/conta/:id': { allowedRoles: ['super_admin'] },
  '/bitso-api': { allowedRoles: ['super_admin'] },
  '/suporte': { allowedRoles: ['super_admin'] },

  // ==================== GRUPO TCR ====================
  '/grupo-tcr/tcr': { allowedRoles: ['super_admin', 'admin', 'tcr_user'] },
  '/brasilcash-tcr': { allowedRoles: ['super_admin', 'admin', 'tcr_user'] },
  '/brasilcash-otc': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/belmontx-tcr': { allowedRoles: ['super_admin', 'admin', 'tcr_user'] },
  '/auditoria-depositos': { allowedRoles: ['super_admin', 'tcr_user'] },

  // (Feature-flagged hoje, mas protegidas)
  '/grupo-tcr/corpx-ttf': { allowedRoles: ['super_admin'] },
  '/bmp-531': { allowedRoles: ['super_admin'] },
  '/extrato_tcr': { allowedRoles: ['super_admin'] },
  '/compensacao-depositos': { allowedRoles: ['super_admin'] },

  // ==================== GRUPO OTC ====================
  '/cotacoes': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/bot-cotacao': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/otc': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/otc/negociar': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/otc/admin-statement/:clientId': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/bitso': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/belmontx-otc': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },
  '/corpx': { allowedRoles: ['super_admin', 'admin', 'otc_user'] },

  // Rotas de funcionários / cliente OTC (mantidas)
  '/employee-statement': { requiredRole: 'otc_employee' },
  '/client-statement': { requiredRole: 'otc_client' },

  // ==================== DASHBOARDS ====================
  // Cash Closure - super_admin, admin e otc_user (exceto IDs específicos bloqueados)
  '/dashboard/cash-closure': { allowedRoles: ['super_admin', 'admin', 'otc_user'] }
};

// ===== UTILITÁRIOS =====
export const getUserPermissions = (role: UserRole): Permission[] => {
  return ROLE_PERMISSIONS[role] || [];
};

export const hasPermission = (userPermissions: Permission[], permission: Permission): boolean => {
  return userPermissions.includes(permission) || userPermissions.includes('admin.full_access');
};

export const hasAnyPermission = (userPermissions: Permission[], permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(userPermissions, permission));
};

export const hasAllPermissions = (userPermissions: Permission[], permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(userPermissions, permission));
};
