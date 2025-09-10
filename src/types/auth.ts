/**
 * 🔐 TIPOS DE AUTENTICAÇÃO E PERMISSÕES
 * Sistema completo de roles e permissões do frontend
 */

// ===== TIPOS DE USUÁRIO =====
export type UserRole = 'admin' | 'otc_client' | 'otc_employee' | 'manager' | 'viewer';

export interface User {
  id: string | number;
  email: string;
  name?: string;
  role?: UserRole;
  createdAt: string;
  updatedAt: string;
  // Campos específicos do sistema
  is_admin?: boolean;
  document?: string;
  phone?: string;
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
  // Rotas administrativas
  '/': { allowedRoles: ['admin', 'manager'] },
  '/admin': { requiredRole: 'admin' },
  '/users': { requiredPermissions: ['admin.user_management'] },
  
  // Rotas OTC
  '/otc': { requiredPermissions: ['otc.view_clients'] },
  '/otc/clients': { requiredPermissions: ['otc.view_clients'] },
  '/otc/operations': { requiredPermissions: ['otc.view_operations'] },
  '/otc/stats': { requiredPermissions: ['otc.view_stats'] },
  
  // Rotas PIX
  '/payments': { requiredPermissions: ['pix.view_transactions'] },
  '/payments/send': { requiredPermissions: ['pix.send'] },
  '/payments/qr': { requiredPermissions: ['pix.create_qr'] },
  
  // Rotas de funcionários
  '/employee-statement': { requiredRole: 'otc_employee' },
  '/client-statement': { requiredRole: 'otc_client' },
  
  // Rotas de relatórios
  '/reports': { requiredPermissions: ['reports.view_financial'] },
  '/extrato': { requiredPermissions: ['banking.view_statement'] }
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
