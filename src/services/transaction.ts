import { TransactionsResponse } from "../types/transaction";

export const fetchTransactions = async (
    accountNumber: string,
    startDate: number,
    endDate: number,
    order: 'asc' | 'desc' = 'asc',
    limit: number = 50000
): Promise<TransactionsResponse> => {
    try {
        const url = `${import.meta.env.X_DIAGNOSTICO_API_URL}/api/b8cash/consultarTransacoes?accountNumber=${accountNumber}&startDate=${startDate}&endDate=${endDate}&order=${order}&limit=${limit}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-enterprise': 'tcr'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {

        throw error;
    }
}; 