"use client";

import { useState, useRef, Fragment } from "react";
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    ExpandedState,
} from "@tanstack/react-table";
import {
    ArrowUpDown,
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
    Download,
    ListFilter,
    MoreHorizontal,
    ArrowDown,
    ArrowUp,
    CircleX,
    Banknote,
    CreditCard,
    Send,
    RefreshCw,
    Info,
    Calendar,
    User,
    FileText,
    Building,
    Hash,
    ChevronDown,
    DollarSign,
    Landmark,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatTimestamp } from "@/utils/date";
import { Transaction } from "@/types/transaction";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { TransactionReceipt } from "./TransactionReceipt";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PDFExportService, ExportData } from "@/services/pdfExport";

// Função auxiliar para obter o ícone correto com base no tipo de transação
const getTransactionIcon = (type: string, side: 'in' | 'out') => {
    switch (type.toLowerCase()) {
        case 'pix':
            return side === 'in' ? <ArrowDown className="h-4 w-4 text-green-500" /> : <ArrowUp className="h-4 w-4 text-red-500" />;
        case 'transfer':
            return <Send className="h-4 w-4 text-blue-500" />;
        case 'card':
            return <CreditCard className="h-4 w-4 text-purple-500" />;
        case 'cash':
            return <Banknote className="h-4 w-4 text-yellow-500" />;
        default:
            return <RefreshCw className="h-4 w-4 text-gray-500" />;
    }
};

// Função auxiliar para obter o nome correto com base no tipo de transação
const getPersonName = (transaction: Transaction) => {
    if (transaction.side === 'in') {
        return transaction.from.name || 'Não informado';
    } else {
        return transaction.to.name || 'Não informado';
    }
};

interface TransactionTableProps {
  data: Transaction[];
  exportData?: ExportData;
}

export function TransactionTable({ data, exportData }: TransactionTableProps) {
    const [sorting, setSorting] = useState<SortingState>([
        {
            id: "createdTimestamp",
            desc: true,
        },
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = useState({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptDataForModal, setReceiptDataForModal] = useState<Transaction | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const handleShowReceipt = (transaction: Transaction) => {

        setReceiptDataForModal(transaction);
        setIsReceiptModalOpen(true);
    };

    const handleRequestPdfGeneration = async () => {
        const transaction = receiptDataForModal;
        if (!transaction) {
            toast.error("Erro: Dados da transação não encontrados.");
            return;
        }

        setIsGeneratingPdf(true);
        toast.info("Solicitando geração do PDF...");

        try {
            const backendUrl = `${import.meta.env.X_RECEIPT_API_URL}/api/generate-receipt`;

            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transaction }),
            });

            if (!response.ok) {
                let errorMsg = `Erro ${response.status} ao gerar PDF.`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignora se não for JSON */ }
                throw new Error(errorMsg);
            }

            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `comprovante-${transaction.id}.pdf`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                if (filenameMatch && filenameMatch.length === 2)
                    filename = filenameMatch[1];
            }
            link.setAttribute('download', filename);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success("PDF do comprovante baixado com sucesso!");

        } catch (error) {
            console.error("Erro ao solicitar/gerar PDF:", error);
            toast.error(error instanceof Error ? error.message : "Erro desconhecido ao gerar PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const column = table.getColumn("description");
        if (column) {
            column.setFilterValue(value);
        }
    };

    const handleExportPDF = async () => {
        if (!exportData) {
            toast.error("Dados para exportação não disponíveis");
            return;
        }

        setIsExportingPdf(true);
        toast.info("Gerando PDF do extrato...");

        try {
            const pdfService = new PDFExportService();
            await pdfService.exportTransactionsToPDF(exportData);
            toast.success("PDF do extrato exportado com sucesso!");
        } catch (error) {
            console.error("Erro ao exportar PDF:", error);
            toast.error("Erro ao exportar PDF. Tente novamente.");
        } finally {
            setIsExportingPdf(false);
        }
    };

    const columns: ColumnDef<Transaction>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Selecionar tudo"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Selecionar linha"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "type",
            header: "Tipo",
            cell: ({ row }) => {
                const transaction = row.original;
                return (
                    <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type, transaction.side)}
                        <span className="capitalize">
                            {transaction.type.toLowerCase()}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="text-right font-medium"
                >
                    Valor
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"));
                const formatted = formatCurrency(amount);
                const transaction = row.original;

                return (
                    <div className={`text-right font-medium ${transaction.side === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.side === 'in' ? '' : '-'}{formatted}
                    </div>
                );
            },
        },
        {
            accessorKey: "createdTimestamp",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="font-medium"
                >
                    Data
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const timestamp: number = row.getValue("createdTimestamp");
                const formattedDate = formatTimestamp(timestamp, "dd/MM/yyyy HH:mm");
                return <div>{formattedDate}</div>;
            },
        },
        {
            id: "personName",
            header: "Nome",
            accessorFn: (row) => getPersonName(row),
            cell: ({ row }) => {
                const name = getPersonName(row.original);
                return <div className="capitalize">{name}</div>;
            },
        },
        {
            accessorKey: "description",
            header: "Descrição",
            cell: ({ row }) => {
                return (
                    <div className="lowercase first-letter:uppercase">
                        {row.getValue("description") || '-'}
                    </div>
                );
            },
            filterFn: (row, columnId, filterValue) => {
                const description = row.getValue(columnId) as string || "";
                const name = getPersonName(row.original);
                const search = String(filterValue).toLowerCase();

                return (
                    description.toLowerCase().includes(search) ||
                    name.toLowerCase().includes(search)
                );
            },
        },
        {
            accessorKey: "side",
            header: "Status",
            cell: ({ row }) => {
                const transaction = row.original;
                return (
                    <Badge
                        variant={transaction.side === 'in' ? "default" : "outline"}
                        className={transaction.side === 'in' ? "bg-green-500 hover:bg-green-600" : "text-red-500 border-red-500"}
                    >
                        {transaction.side === 'in' ? 'Entrada' : 'Saída'}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => {
                const transaction = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => {
                                    navigator.clipboard.writeText(transaction.id);
                                    toast.success("ID da transação copiado para a área de transferência");
                                }}
                            >
                                Copiar ID da transação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                setExpanded(old => {
                                    const newExpanded = { ...old };
                                    newExpanded[row.original.id] = !old[row.original.id];
                                    return newExpanded;
                                });
                            }}>
                                {expanded[row.original.id] ? 'Ocultar detalhes' : 'Ver detalhes'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShowReceipt(transaction)}>
                                Ver Comprovante HTML
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            rowSelection,
            expanded,
        },
        onExpandedChange: setExpanded,
        getRowCanExpand: () => true,
    });

    // Componente para mostrar os detalhes expandidos
    const TransactionDetails = ({ transaction }: { transaction: Transaction }) => {
        return (
            <div className="bg-muted/50 p-4 rounded-lg space-y-4 mt-1 mb-3 mx-2 border border-border">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Detalhes da Transação */}
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2 text-primary">
                            <Info className="h-4 w-4" />
                            Detalhes da Transação
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-background p-3 rounded-md shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <Calendar className="h-4 w-4" />
                                    Data e Hora
                                </div>
                                <div className="font-medium">
                                    {formatTimestamp(transaction.createdTimestamp, "dd/MM/yyyy HH:mm:ss")}
                                </div>
                            </div>
                            <div className="bg-background p-3 rounded-md shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    Valor e Taxa
                                </div>
                                <div className="font-medium">
                                    {formatCurrency(parseFloat(transaction.amount))}
                                    {parseFloat(transaction.fee) > 0 && (
                                        <span className="text-muted-foreground text-sm ml-2">
                                            (Taxa: {formatCurrency(parseFloat(transaction.fee))})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-background p-3 rounded-md shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <Hash className="h-4 w-4" />
                                    ID da Transação
                                </div>
                                <div className="font-medium flex items-center gap-2">
                                    <span className="truncate max-w-[150px]" title={transaction.id}>
                                        {transaction.id}
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => {
                                            navigator.clipboard.writeText(transaction.id);
                                            toast.success("ID da transação copiado para a área de transferência");
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy">
                                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                        </svg>
                                    </Button>
                                </div>
                            </div>
                            <div className="bg-background p-3 rounded-md shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <FileText className="h-4 w-4" />
                                    Descrição
                                </div>
                                <div className="font-medium">
                                    {transaction.description || transaction.identifier || "-"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detalhes da Origem/Destino */}
                    <div className="flex-1 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2 text-primary">
                            <User className="h-4 w-4" />
                            {transaction.side === 'in' ? 'Dados do Remetente' : 'Dados do Destinatário'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-background p-3 rounded-md shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <User className="h-4 w-4" />
                                    Nome
                                </div>
                                <div className="font-medium">
                                    {transaction.side === 'in'
                                        ? transaction.from.name || 'Não informado'
                                        : transaction.to.name || 'Não informado'}
                                </div>
                            </div>
                            <div className="bg-background p-3 rounded-md shadow-sm">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <FileText className="h-4 w-4" />
                                    Documento
                                </div>
                                <div className="font-medium">
                                    {transaction.side === 'in'
                                        ? transaction.from.userDocument || 'Não informado'
                                        : transaction.to.userDocument || 'Não informado'}
                                </div>
                            </div>
                            <div className="bg-background p-3 rounded-md shadow-sm col-span-1">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <Landmark className="h-4 w-4" />
                                    Dados Bancários
                                </div>
                                <div className="font-medium text-xs break-words">
                                    {transaction.side === 'in'
                                        ? `Banco: ${transaction.from.bankNumber || 'N/A'}`
                                        : `Banco: ${transaction.to.bankNumber || 'N/A'} | Ag: ${transaction.to.agencyNumber || 'N/A'} | Conta: ${transaction.to.accountNumber || 'N/A'}`}
                                </div>
                            </div>
                            {/* Novo Card para Operation ID */}
                            <div className="bg-background p-3 rounded-md shadow-sm col-span-1">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <Hash className="h-4 w-4" />
                                    Operation ID
                                </div>
                                <div className="font-medium flex items-center gap-1">
                                    <span className="truncate max-w-[130px] text-xs" title={transaction.operationId || 'Não informado'}>
                                        {transaction.operationId || 'Não informado'}
                                    </span>
                                    {transaction.operationId && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={() => {
                                                navigator.clipboard.writeText(transaction.operationId!);
                                                toast.success("Operation ID copiado!");
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy">
                                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                            </svg>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => handleShowReceipt(transaction)}
                    >
                        <Info className="h-4 w-4" />
                        Ver Comprovante
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between py-4">
                <Input
                    placeholder="Filtrar por descrição ou nome..."
                    value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
                    onChange={handleFilterChange}
                    className="max-w-sm bg-input"
                />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRowSelection({})}>
                        Limpar seleção
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="ml-auto flex items-center gap-2"
                        onClick={handleExportPDF}
                        disabled={isExportingPdf || !exportData}
                    >
                        <Download className="h-4 w-4" />
                        {isExportingPdf ? 'Exportando...' : 'Exportar PDF'}
                    </Button>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <Fragment key={row.original.id}>
                                    <TableRow
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {expanded[row.original.id] && (
                                        <TableRow className="bg-muted/50 hover:bg-muted/60">
                                            <TableCell colSpan={columns.length} className="p-0">
                                                <TransactionDetails transaction={row.original} />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Nenhum resultado encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} de{" "}
                    {table.getFilteredRowModel().rows.length} linha(s) selecionada(s).
                </div>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <ChevronFirst className="h-4 w-4" />
                            </Button>
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, table.getPageCount()) }).map((_, i) => {
                            const pageIndex = i;
                            const isCurrentPage = table.getState().pagination.pageIndex === pageIndex;
                            return (
                                <PaginationItem key={i}>
                                    <Button
                                        variant={isCurrentPage ? "default" : "outline"}
                                        size="icon"
                                        onClick={() => table.setPageIndex(pageIndex)}
                                    >
                                        {pageIndex + 1}
                                    </Button>
                                </PaginationItem>
                            );
                        })}
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <ChevronLast className="h-4 w-4" />
                            </Button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
            <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Visualizar Comprovante</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] p-4">
                        {receiptDataForModal && (
                            <TransactionReceipt
                                transaction={receiptDataForModal}
                                receiptRef={receiptRef}
                            />
                        )}
                    </ScrollArea>
                    <DialogFooter className="sm:justify-between">
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleRequestPdfGeneration}
                            disabled={isGeneratingPdf}
                        >
                            {isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
                        </Button>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" disabled={isGeneratingPdf}>
                                Fechar
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 