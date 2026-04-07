import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface LogTailProps {
  lines: string[];
  isLoading?: boolean;
  onRefresh: () => void;
  fileName?: string;
}

export default function LogTail({ lines, isLoading, onRefresh, fileName = 'logs/pm2-out.log' }: LogTailProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2">
        <span className="text-xs font-mono text-zinc-400">
          $ tail -f {fileName}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-6 px-2 text-zinc-400 hover:text-zinc-200"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      <div className="bg-zinc-950 p-4 max-h-72 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="text-zinc-500 text-xs font-mono">
            {isLoading ? 'Carregando...' : 'Sem linhas de log'}
          </p>
        ) : (
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {lines.join('\n')}
          </pre>
        )}
      </div>
    </div>
  );
}
