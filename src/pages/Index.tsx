import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/useAuth';

/**
 * Página inicial: redireciona para a rota apropriada conforme o role.
 * Dashboard financeiro está oculto e inacessível.
 */
const Index = () => {
  const { hasRole, hasAnyRole } = usePermissions();

  if (hasRole('tcr_user')) return <Navigate to="/grupo-tcr/tcr" replace />;
  if (hasRole('otc_user')) return <Navigate to="/otc" replace />;
  if (hasAnyRole(['super_admin', 'admin'])) return <Navigate to="/dashboard/cash-closure" replace />;
  return <Navigate to="/login" replace />;
};

export default Index;
