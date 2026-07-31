import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationFooterProps {
  from: number;
  to: number;
  total: number;
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** Rodapé de paginação padrão das tabelas de extrato. */
export default function PaginationFooter({ from, to, total, page, totalPages, hasPrev, hasNext, onPrev, onNext }: PaginationFooterProps) {
  return (
    <div className="flex items-center justify-between p-4 border-t bg-muted/20">
      <div className="text-sm text-muted-foreground">
        Mostrando {from} - {to} de {total}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
