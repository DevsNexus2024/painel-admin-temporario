import { Transaction } from "@/types/transaction";
import { formatCurrency, formatTimestamp } from "@/utils/date";
// Não vamos usar ícones Lucide nesta versão simplificada

interface TransactionReceiptProps {
    transaction: Transaction;
    receiptRef: React.RefObject<HTMLDivElement>;
}

export const TransactionReceipt = ({ transaction, receiptRef }: TransactionReceiptProps) => {
    const isEntry = transaction.side === 'in';
    const personData = isEntry ? transaction.from : transaction.to;
    const personLabel = isEntry ? "Remetente" : "Destinatário";

    const bankData = isEntry
        ? `Banco: ${personData.bankNumber || 'N/A'}`
        : `Banco: ${personData.bankNumber || 'N/A'}, Agência: ${transaction.to.agencyNumber || 'N/A'}, Conta: ${transaction.to.accountNumber || 'N/A'}`;

    const tdLabelStyle: React.CSSProperties = { padding: '5px 8px 5px 0', textAlign: 'left', color: '#555', verticalAlign: 'top', whiteSpace: 'nowrap' };
    const tdValueStyle: React.CSSProperties = { padding: '5px 0 5px 8px', textAlign: 'left', fontWeight: '500', verticalAlign: 'top', wordBreak: 'break-word' };
    const tdValueRightStyle: React.CSSProperties = { ...tdValueStyle, textAlign: 'right' }; // Estilo para valores alinhados à direita

    return (
        // Wrapper com estilos inline básicos
        <div ref={receiptRef} style={{
            backgroundColor: '#fff',
            color: '#333',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '14px',
            padding: '25px',
            border: '1px solid #ddd',
            maxWidth: '700px',
            margin: 'auto' // Para centralizar se necessário
        }}>
            {/* Cabeçalho Simples */}
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ff6b35' }}>
                    Comprovante de Transação
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ color: '#777' }}>Gerado em:</div>
                    <div>{formatTimestamp(Date.now() / 1000, "dd/MM/yyyy HH:mm:ss")}</div>
                </div>
            </div>

            {/* Status Simples */}
            <div style={{ backgroundColor: '#e6fffa', border: '1px solid #b2f5ea', borderRadius: '4px', padding: '10px 15px', textAlign: 'center', marginBottom: '20px', color: '#2c7a7b', fontWeight: 'bold' }}>
                &#10004; Transação Concluída
            </div>

            {/* Detalhes da Transação - Tabela Simplificada */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                    Detalhes da Transação
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={tdLabelStyle}>Data/Hora:</td>
                            <td style={tdValueStyle}>{formatTimestamp(transaction.createdTimestamp, "dd/MM/yyyy HH:mm:ss")}</td>
                            <td style={tdLabelStyle}>Valor:</td>
                            <td style={{ ...tdValueRightStyle, color: isEntry ? 'green' : 'red', fontWeight: 'bold' }}>
                                {isEntry ? '+' : '-'} {formatCurrency(parseFloat(transaction.amount))}
                            </td>
                        </tr>
                        <tr>
                            <td style={tdLabelStyle}>Tipo:</td>
                            <td style={{ ...tdValueStyle, textTransform: 'capitalize' }}>{transaction.type.toLowerCase()}</td>
                            <td style={tdLabelStyle}>MediaTaxa:</td>
                            <td style={tdValueRightStyle}>{formatCurrency(parseFloat(transaction.fee))}</td>
                        </tr>
                        <tr>
                            <td style={tdLabelStyle}>Descrição:</td>
                            <td colSpan={3} style={tdValueStyle}>{transaction.description || transaction.identifier || "-"}</td>
                        </tr>
                        <tr>
                            <td style={tdLabelStyle}>ID Transação:</td>
                            <td colSpan={3} style={{ ...tdValueStyle, fontFamily: 'monospace', fontSize: '12px' }}>{transaction.id}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Dados Remetente/Destinatário - Tabela Simplificada */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                    {personLabel}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ ...tdLabelStyle, width: '20%' }}>Nome:</td>
                            <td colSpan={3} style={tdValueStyle}>{personData.name || 'Não informado'}</td>
                        </tr>
                        <tr>
                            <td style={tdLabelStyle}>Documento:</td>
                            <td colSpan={3} style={tdValueStyle}>{personData.userDocument || 'Não informado'}</td>
                        </tr>
                        <tr>
                            <td style={tdLabelStyle}>Dados Bancários:</td>
                            <td colSpan={3} style={tdValueStyle}>{bankData}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Rodapé Simples */}
            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '10px', color: '#999' }}>
                Comprovante gerado automaticamente.
            </div>
        </div>
    );
}; 