import React from 'react';
import { Download, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ReportProgressBar from './ReportProgress';
import { ReportProgress } from '@/types/reports';

interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  onGenerateCSV: () => void;
  isGenerating: boolean;
  progress: ReportProgress;
  onCancel: () => void;
  error?: Error | null;
  needsConfirmation?: boolean;
  onConfirm?: () => void;
  onDismiss?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

const ReportCard: React.FC<ReportCardProps> = ({
  icon,
  title,
  description,
  children,
  onGenerateCSV,
  isGenerating,
  progress,
  onCancel,
  error,
  needsConfirmation,
  onConfirm,
  onDismiss,
  disabled,
  disabledReason,
}) => {
  return (
    <>
      {/* Card — mesmo padrão do CashClosureDashboard */}
      <div className="rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 py-5 space-y-5">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-4">
          <ReportProgressBar
            progress={progress}
            isGenerating={isGenerating}
            onCancel={onCancel}
          />

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-400">{error.message}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={onGenerateCSV}
              disabled={isGenerating || disabled}
              className="h-11 px-5 bg-gradient-to-r from-[#FF7A3D] to-[#FF8A4D] hover:from-[#FF8A4D] hover:to-[#FF7A3D] text-white border-0 shadow-lg shadow-[#FF7A3D]/25 transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? 'Gerando...' : 'Exportar CSV'}
            </Button>
            {disabled && disabledReason && (
              <span className="text-xs text-gray-500">{disabledReason}</span>
            )}
          </div>
        </div>
      </div>

      {/* Warning dialog */}
      <AlertDialog open={needsConfirmation} onOpenChange={open => { if (!open && onDismiss) onDismiss(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Relatório grande
            </AlertDialogTitle>
            <AlertDialogDescription>
              Aproximadamente{' '}
              <strong className="text-foreground">{progress.total.toLocaleString('pt-BR')}</strong> registros
              ({progress.totalPages} páginas). Pode levar alguns minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onDismiss} className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-gradient-to-r from-[#FF7A3D] to-[#FF8A4D] hover:from-[#FF8A4D] hover:to-[#FF7A3D] text-white border-0 cursor-pointer"
            >
              Gerar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReportCard;
