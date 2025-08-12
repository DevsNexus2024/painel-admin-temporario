/**
 * Account Selector - Seletor Simples de Contas
 * Para alternar entre BMP e Bitso na página de pagamentos
 */

import React, { useState } from 'react';
import { ChevronDown, Building, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRouter, ACCOUNTS, type Account } from './apiRouter';

interface AccountSelectorProps {
  onAccountChange?: (account: Account) => void;
}

export function AccountSelector({ onAccountChange }: AccountSelectorProps) {
  const [currentAccount, setCurrentAccount] = useState<Account>(apiRouter.getCurrentAccount());

  const handleAccountSwitch = (accountId: string) => {
    const success = apiRouter.switchAccount(accountId);
    if (success) {
      const newAccount = apiRouter.getCurrentAccount();
      setCurrentAccount(newAccount);
      onAccountChange?.(newAccount);
      
      // Salvar no localStorage para persistência
      localStorage.setItem('selected_account_id', accountId);
    }
  };

  const getProviderBadge = (provider: string) => {
    const badges = {
      'bmp': { label: 'BMP', color: 'bg-blue-100 text-blue-800' },
      'bmp-531': { label: 'BMP-531', color: 'bg-indigo-100 text-indigo-800' },
      'bitso': { label: 'Bitso', color: 'bg-orange-100 text-orange-800' }
    };
    return badges[provider] || { label: provider.toUpperCase(), color: 'bg-gray-100 text-gray-800' };
  };

  const getStatusIcon = (provider: string) => {
    // BMP e BMP-531 são reais, Bitso é mock
    return (provider === 'bmp' || provider === 'bmp-531') ? 
      <CheckCircle className="h-3 w-3 text-green-500" /> : 
      <AlertTriangle className="h-3 w-3 text-orange-500" />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent w-full">
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl w-full transition-all duration-200 hover:shadow-xl hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20">
                <Building className="h-5 w-5 text-blue-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-muted-foreground text-sm">Conta Ativa</p>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(currentAccount.provider)}
                    <Badge className={`text-xs ${getProviderBadge(currentAccount.provider).color}`}>
                      {getProviderBadge(currentAccount.provider).label}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-foreground font-bold text-sm truncate">
                    {currentAccount.bankInfo.bank}
                    {currentAccount.bankInfo.agency && ` • Ag: ${currentAccount.bankInfo.agency}`}
                    {currentAccount.bankInfo.account && ` • Conta: ${currentAccount.bankInfo.account}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentAccount.displayName}
                  </p>
                </div>
              </div>
              
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80" align="end" sideOffset={8}>
        {ACCOUNTS.map(account => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => handleAccountSwitch(account.id)}
            className={`cursor-pointer p-3 ${
              account.id === currentAccount.id ? 'bg-accent' : ''
            }`}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="p-2 rounded-lg bg-muted">
                <Building className="h-4 w-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{account.displayName}</p>
                  {account.id === currentAccount.id && (
                    <Badge variant="default" className="text-xs">
                      Ativa
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`text-xs ${getProviderBadge(account.provider).color}`}>
                    {getProviderBadge(account.provider).label}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(account.provider)}
                    <span className="text-xs text-muted-foreground">
                      {account.provider === 'bmp' ? 'Produção' : 'Mock'}
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground truncate">
                  {account.bankInfo.bank}
                  {account.bankInfo.agency && ` • ${account.bankInfo.agency}`}
                  {account.bankInfo.account && ` • ${account.bankInfo.account}`}
                </p>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 