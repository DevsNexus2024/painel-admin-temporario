import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, X, Loader2, Filter, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface FilterSelectSpec {
  label: string;
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
}

export interface FilterTextSpec {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: 'text' | 'number';
}

interface ExtractFilterBarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /** Selects da linha 1 (tipo, status, método...). Grade se adapta à contagem. */
  selects: FilterSelectSpec[];
  /** Inputs de identificação/valor da linha 2 (e2e, externalId, valor específico...). */
  idFilters: FilterTextSpec[];
  dateRange: { from: Date | null; to: Date | null };
  onDateRangeChange: (r: { from: Date | null; to: Date | null }) => void;
  minAmount: string;
  onMinAmountChange: (v: string) => void;
  maxAmount: string;
  onMaxAmountChange: (v: string) => void;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (v: boolean) => void;
  /** Nota curta sobre limitações (ex.: janela máx da API). */
  hint?: string;
  loading: boolean;
  onApply: () => void;
  onClear: () => void;
}

const ROW1_GRID: Record<number, string> = {
  1: "grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4",
  2: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4",
  3: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4",
};

const ROW2_GRID: Record<number, string> = {
  1: "grid grid-cols-1 gap-3 lg:gap-4",
  2: "grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4",
  3: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4",
};

const INPUT_CLASS = "h-10 bg-background border-2 focus:border-[color:var(--provider-border)]";

/**
 * Barra de filtros padrão das telas de extrato de provider.
 * Requer wrapper com providerCssVars() no ancestral (consome var(--provider-*)).
 * Busca/valores são refino client-side por convenção; selects/ids/datas vão pra API no Aplicar.
 */
export default function ExtractFilterBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Nome, documento, ID...",
  selects,
  idFilters,
  dateRange,
  onDateRangeChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  checkboxLabel,
  checkboxChecked = false,
  onCheckboxChange,
  hint,
  loading,
  onApply,
  onClear,
}: ExtractFilterBarProps) {
  const datePicker = (which: 'from' | 'to', label: string) => {
    const selected = dateRange[which];
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 w-full justify-start text-left font-normal bg-background border-2 transition-all",
                !selected && "text-muted-foreground",
                selected && "border-[color:var(--provider-border)]"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selected ? format(selected, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (date) {
                  onDateRangeChange({ ...dateRange, [which]: date });
                }
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
      <div className="space-y-3 lg:space-y-4">
        {/* Linha 1: Busca + selects */}
        <div className={ROW1_GRID[selects.length] || ROW1_GRID[3]}>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className={cn(INPUT_CLASS, "pl-10")}
              />
            </div>
          </div>

          {selects.map((s) => (
            <div key={s.label} className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</label>
              <Select value={s.value} onValueChange={s.onChange}>
                <SelectTrigger className={INPUT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {s.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Linha 2: filtros de identificação/valor específico */}
        {idFilters.length > 0 && (
          <div className={ROW2_GRID[idFilters.length] || ROW2_GRID[3]}>
            {idFilters.map((f) => (
              <div key={f.label} className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                <Input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  className={cn(INPUT_CLASS, f.mono && "font-mono text-xs")}
                />
              </div>
            ))}
          </div>
        )}

        {/* Linha 3: datas + faixa de valor */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {datePicker('from', 'Data inicial')}
          {datePicker('to', 'Data final')}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor mínimo</label>
            <Input
              type="number"
              placeholder="0.00"
              value={minAmount}
              onChange={(e) => onMinAmountChange(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor máximo</label>
            <Input
              type="number"
              placeholder="0.00"
              value={maxAmount}
              onChange={(e) => onMaxAmountChange(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Linha 4: checkbox + hint + ações */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-6">
            {checkboxLabel && onCheckboxChange && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="filter-bar-checkbox"
                  checked={checkboxChecked}
                  onCheckedChange={(checked) => onCheckboxChange(checked as boolean)}
                  className="border-2"
                />
                <label htmlFor="filter-bar-checkbox" className="text-sm font-medium cursor-pointer">
                  {checkboxLabel}
                </label>
              </div>
            )}

            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aplicando filtros...
              </div>
            )}
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button
              onClick={onApply}
              className="h-10 bg-[color:var(--provider-accent)] hover:opacity-90 text-white transition-all duration-200 rounded-md px-3 lg:px-4"
              disabled={loading}
            >
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button
              variant="outline"
              onClick={onClear}
              className="h-10 bg-black border border-[color:var(--provider-accent)] text-white hover:bg-[color:var(--provider-accent)] hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
