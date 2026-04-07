import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ReportProgress as ReportProgressType } from '@/types/reports';

interface ReportProgressProps {
  progress: ReportProgressType;
  isGenerating: boolean;
  onCancel: () => void;
}

function formatTimeLeft(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes}min`;
}

const ReportProgressBar: React.FC<ReportProgressProps> = ({ progress, isGenerating, onCancel }) => {
  if (!isGenerating) return null;

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 text-[#FF7A3D] animate-spin" />
          <span className="font-medium text-white">{progress.percentage}%</span>
          <span className="text-gray-400">
            — {progress.current.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')}
          </span>
          {progress.totalPages > 0 && (
            <span className="text-gray-500">
              (pág {progress.page}/{progress.totalPages})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {progress.estimatedTimeLeft && progress.estimatedTimeLeft > 0 && (
            <span className="text-xs text-gray-500">{formatTimeLeft(progress.estimatedTimeLeft)}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 px-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>
      <Progress value={progress.percentage} className="h-1.5" />
    </div>
  );
};

export default ReportProgressBar;
