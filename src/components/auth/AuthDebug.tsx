/**
 * 🐛 COMPONENTE DE DEBUG PARA AUTENTICAÇÃO
 * Use temporariamente para verificar problemas de autenticação
 */

import React from 'react';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthDebugProps {
  showDetails?: boolean;
}

const AuthDebug: React.FC<AuthDebugProps> = ({ showDetails = true }) => {
  const { user, userType, isAuthenticated, isLoading } = useAuth();
  const { permissions } = usePermissions();

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-blue-800 text-sm">🐛 Auth Debug Info</CardTitle>
        <CardDescription>Informações de debug da autenticação</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status básico */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium">Status:</span>
            <div className={`ml-2 text-sm ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
              {isLoading ? '⏳ Carregando...' : (isAuthenticated ? '✅ Autenticado' : '❌ Não autenticado')}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium">Tipo:</span>
            <div className="ml-2 text-sm text-blue-600">
              {userType?.type || 'N/A'}
            </div>
          </div>
        </div>

        {/* Informações do usuário */}
        {showDetails && user && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">👤 Dados do Usuário:</h4>
            <div className="text-xs bg-white p-2 rounded border">
              <pre>{JSON.stringify({
                id: user.id,
                email: user.email,
                name: user.name
              }, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Informações do tipo */}
        {showDetails && userType && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">🏷️ UserType Completo:</h4>
            <div className="text-xs bg-white p-2 rounded border">
              <pre>{JSON.stringify(userType, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Flags específicas */}
        {userType && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">🚩 Flags Específicas:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-1 rounded ${userType.isAdmin ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                Admin: {userType.isAdmin ? '✅' : '❌'}
              </div>
              <div className={`p-1 rounded ${userType.isOTC ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                OTC Client: {userType.isOTC ? '✅' : '❌'}
              </div>
              <div className={`p-1 rounded ${userType.isEmployee ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                OTC Employee: {userType.isEmployee ? '✅' : '❌'}
              </div>
              <div className={`p-1 rounded ${userType.otcAccess ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                OTC Access: {userType.otcAccess ? '✅' : '❌'}
              </div>
            </div>
          </div>
        )}

        {/* Permissões */}
        {showDetails && permissions && permissions.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">🔑 Permissões ({permissions.length}):</h4>
            <div className="text-xs bg-white p-2 rounded border max-h-32 overflow-y-auto">
              {permissions.map(permission => (
                <div key={permission} className="py-1 border-b border-gray-100 last:border-b-0">
                  {permission}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações de debug */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">🔧 Ações de Debug:</h4>
          <div className="flex gap-2">
            <button
              onClick={() => {

              }}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Log no Console
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.reload();
              }}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Limpar & Recarregar
            </button>
          </div>
        </div>

        {/* URL Atual */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">🌐 URL Atual:</h4>
          <div className="text-xs bg-white p-2 rounded border">
            {window.location.pathname}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuthDebug;
