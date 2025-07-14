import { useQuery } from "@tanstack/react-query";
import { fetchTransactions } from "../services/transaction";
import { TransactionsResponse } from "../types/transaction";

interface UseTransactionsParams {
    accountNumber: string;
    startDate: number;
    endDate: number;
    order?: 'asc' | 'desc';
    limit?: number;
    enabled?: boolean;
}

export const useTransactions = ({
    accountNumber,
    startDate,
    endDate,
    order = 'asc',
    limit = 500,
    enabled = true
}: UseTransactionsParams) => {
    return useQuery<TransactionsResponse, Error>({
        queryKey: ['transactions', accountNumber, startDate, endDate, order, limit],
        queryFn: () => fetchTransactions(accountNumber, startDate, endDate, order, limit),
        enabled: enabled && !!accountNumber && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000 // 5 minutos
    });
}; 