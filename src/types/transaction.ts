export interface TransactionFrom {
    name: string;
    userDocument: string;
    bankNumber: string | null;
    bankISPB: string;
}

export interface TransactionTo {
    name: string;
    agencyNumber: string;
    agencyDigit: string;
    accountNumber: string;
    accountDigit: string;
    bankNumber: string;
    userDocument: string;
    key: string;
}

export interface Transaction {
    type: string;
    event: string;
    side: 'in' | 'out';
    amount: string;
    fee: string;
    userDocument: string;
    id: string;
    transactionId: string;
    movementId: string;
    operationId: string;
    uniqueId: string | null;
    from: TransactionFrom;
    to: TransactionTo;
    description: string | null;
    identifier: string;
    balanceAfter: string;
    createdTimestamp: number;
}

export interface TransactionsResponse {
    mensagem: string;
    response: {
        success: boolean;
        transactions: Transaction[];
    };
} 