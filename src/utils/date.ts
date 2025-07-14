import { format, fromUnixTime, startOfDay, endOfDay, getUnixTime, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatTimestamp = (timestamp: number | string, formatStr: string = 'dd/MM/yyyy HH:mm'): string => {
    let date: Date;
    
    if (typeof timestamp === 'string') {
        // Se for string, assume que é ISO date
        date = parseISO(timestamp);
    } else {
        // Se for número, assume que é Unix timestamp
        date = fromUnixTime(timestamp);
    }
    
    return format(date, formatStr, { locale: ptBR });
};

export const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(numValue);
};

export const getStartOfDayTimestamp = (date: Date): number => {
    return getUnixTime(startOfDay(date));
};

export const getEndOfDayTimestamp = (date: Date): number => {
    return getUnixTime(endOfDay(date));
}; 