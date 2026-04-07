import React, { useMemo } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

const PRESETS = [
  { label: 'Hoje', getRange: () => ({ from: new Date(), to: new Date() }) },
  { label: '7 dias', getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: '30 dias', getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Mês atual', getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês anterior', getRange: () => {
    const prev = subMonths(new Date(), 1);
    return { from: startOfMonth(prev), to: endOfMonth(prev) };
  }},
  { label: '3 meses', getRange: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: '6 meses', getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
];

function toYMD(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseYMD(str: string): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? undefined : d;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}) => {
  const handlePreset = (preset: typeof PRESETS[number]) => {
    const { from, to } = preset.getRange();
    onDateFromChange(toYMD(from));
    onDateToChange(toYMD(to));
  };

  const activePreset = useMemo(() => {
    for (const preset of PRESETS) {
      const { from, to } = preset.getRange();
      if (toYMD(from) === dateFrom && toYMD(to) === dateTo) {
        return preset.label;
      }
    }
    return null;
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
        Período
      </label>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(preset => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => handlePreset(preset)}
            className={cn(
              'h-9 cursor-pointer transition-all duration-200',
              activePreset === preset.label
                ? 'bg-[#FF7A3D]/15 border-[#FF7A3D]/40 text-[#FF7A3D] hover:bg-[#FF7A3D]/20'
                : 'border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
            )}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Date pickers */}
      <div className="flex items-center gap-3">
        <DatePicker
          label="Data inicial"
          value={parseYMD(dateFrom)}
          onChange={d => onDateFromChange(d ? toYMD(d) : '')}
        />
        <span className="text-gray-500 text-sm">até</span>
        <DatePicker
          label="Data final"
          value={parseYMD(dateTo)}
          onChange={d => onDateToChange(d ? toYMD(d) : '')}
        />
      </div>
    </div>
  );
};

interface DatePickerProps {
  label: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          'w-[160px] justify-start text-left font-normal h-11 bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer',
          value ? 'text-white' : 'text-gray-500'
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
        {value ? format(value, 'dd/MM/yyyy') : label}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={value}
        onSelect={onChange}
        locale={ptBR}
        initialFocus
      />
    </PopoverContent>
  </Popover>
);

export default DateRangeFilter;
