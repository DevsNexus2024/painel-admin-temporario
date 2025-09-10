import { format, fromUnixTime, startOfDay, endOfDay, getUnixTime, parseISO, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatTimestamp = (timestamp: number | string, formatStr: string = 'dd/MM/yyyy HH:mm'): string => {
    // Verificar se o timestamp é válido
    if (!timestamp || timestamp === null || timestamp === undefined) {
        return 'Data inválida';
    }
    
    let date: Date;
    
    try {
        if (typeof timestamp === 'string') {
            // Se for string, assume que é ISO date
            date = parseISO(timestamp);
        } else {
            // Se for número, assume que é Unix timestamp
            date = fromUnixTime(timestamp);
        }
        
        // Verificar se a data é válida
        if (isNaN(date.getTime())) {
            return 'Data inválida';
        }
        
        return format(date, formatStr, { locale: ptBR });
    } catch (error) {

        return 'Data inválida';
    }
};

export const formatOTCTimestamp = (timestamp: number | string, formatStr: string = 'dd/MM/yyyy HH:mm'): string => {
    // Verificar se o timestamp é válido
    if (!timestamp || timestamp === null || timestamp === undefined) {
        return 'Data inválida';
    }
    
    let date: Date;
    
    try {
        if (typeof timestamp === 'string') {
            // Se for string ISO, parseISO trata como UTC
            // Vamos adicionar 5 horas para corrigir o fuso horário
            date = addHours(parseISO(timestamp), 5);
        } else {
            // Se for número, assume que é Unix timestamp
            date = fromUnixTime(timestamp);
        }
        
        // Verificar se a data é válida
        if (isNaN(date.getTime())) {
            return 'Data inválida';
        }
        
        return format(date, formatStr, { locale: ptBR });
    } catch (error) {

        return 'Data inválida';
    }
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