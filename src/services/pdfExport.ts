import jsPDF from 'jspdf';
import { Transaction } from '@/types/transaction';
import { formatCurrency, formatTimestamp } from '@/utils/date';

export interface ExportData {
  transactions: Transaction[];
  searchParams: {
    accountNumber: string;
    startDate: number;
    endDate: number;
  };
  stats: {
    balance: number;
    totalEntries: number;
    totalExits: number;
    totalFees: number;
    netFlow: number;
  };
  saldoApi?: string;
}

export class PDFExportService {
  private doc: jsPDF;
  private pageHeight: number;
  private pageWidth: number;
  private margin: number;
  private currentY: number;
  private lineHeight: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageHeight = this.doc.internal.pageSize.height;
    this.pageWidth = this.doc.internal.pageSize.width;
    this.margin = 20;
    this.currentY = this.margin;
    this.lineHeight = 7;
  }

  private addNewPageIfNeeded(requiredHeight: number = 20): void {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private addTitle(title: string): void {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 15;
  }

  private addSubtitle(subtitle: string): void {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subtitle, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 10;
  }

  private addSectionTitle(title: string): void {
    this.addNewPageIfNeeded(15);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 10;
  }

  private addLine(): void {
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 5;
  }

  private addKeyValue(key: string, value: string, fontSize: number = 10): void {
    this.addNewPageIfNeeded(this.lineHeight);
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(key + ':', this.margin, this.currentY);
    
    this.doc.setFont('helvetica', 'normal');
    const keyWidth = this.doc.getTextWidth(key + ': ');
    this.doc.text(value, this.margin + keyWidth, this.currentY);
    this.currentY += this.lineHeight;
  }

  private addStatsCard(title: string, value: string, description: string, x: number = this.margin, width: number = 85, currentY?: number): void {
    const yPosition = currentY || this.currentY;
    this.addNewPageIfNeeded(25);
    
    // Desenhar retângulo do card
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setFillColor(248, 249, 250);
    this.doc.rect(x, yPosition, width, 20, 'FD');
    
    // Título do card
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, x + 5, yPosition + 7);
    
    // Valor
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(value, x + 5, yPosition + 13);
    
    // Descrição
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(description, x + 5, yPosition + 18);
  }

  private addTransactionTable(transactions: Transaction[]): void {
    this.addNewPageIfNeeded(30);
    
    // Cabeçalho da tabela
    const headers = ['Tipo', 'Data', 'Valor', 'Status', 'Nome', 'Descrição'];
    const colWidths = [20, 35, 25, 20, 40, 50];
    const startX = this.margin;
    
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    
    // Desenhar cabeçalho
    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(startX, this.currentY, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
    
    let currentX = startX;
    headers.forEach((header, index) => {
      this.doc.text(header, currentX + 2, this.currentY + 5);
      currentX += colWidths[index];
    });
    
    this.currentY += 10;
    
    // Dados da tabela
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    
    transactions.forEach((transaction, index) => {
      this.addNewPageIfNeeded(8);
      
      // Alternar cor das linhas
      if (index % 2 === 0) {
        this.doc.setFillColor(250, 250, 250);
        this.doc.rect(startX, this.currentY, colWidths.reduce((a, b) => a + b, 0), 7, 'F');
      }
      
      currentX = startX;
      const rowData = [
        transaction.type || '-',
        formatTimestamp(transaction.createdTimestamp),
        formatCurrency(parseFloat(transaction.amount)),
        transaction.side === 'in' ? 'Entrada' : 'Saída',
        this.truncateText(this.getPersonName(transaction), 25),
        this.truncateText(transaction.description || '-', 35)
      ];
      
      rowData.forEach((data, colIndex) => {
        this.doc.text(data, currentX + 2, this.currentY + 5);
        currentX += colWidths[colIndex];
      });
      
      this.currentY += 7;
    });
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private getPersonName(transaction: Transaction): string {
    if (transaction.side === 'in') {
      return transaction.from?.name || 'Não informado';
    } else {
      return transaction.to?.name || 'Não informado';
    }
  }

  public async exportTransactionsToPDF(data: ExportData): Promise<void> {
    try {

      
      // Título do relatório
      this.addTitle('Extrato de Transações TCR');
      
      // Período do relatório
      const startDate = new Date(data.searchParams.startDate * 1000);
      const endDate = new Date(data.searchParams.endDate * 1000);
      this.addSubtitle(`Período: ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`);
      
      this.currentY += 10;
      
      // Informações da conta
      this.addSectionTitle('Informações da Conta');
      this.addKeyValue('Número da Conta', data.searchParams.accountNumber);
      this.addKeyValue('Data de Geração', new Date().toLocaleString('pt-BR'));
      this.addKeyValue('Total de Transações', data.transactions.length.toString());
      
      this.currentY += 10;
      
      // Resumo Financeiro
      this.addSectionTitle('Resumo Financeiro');
      
      // Calcular largura dos cards (4 cards em 2 linhas)
      const cardWidth = (this.pageWidth - this.margin * 2 - 10) / 2; // 2 cards por linha com espaçamento
      
      // Primeira linha de cards
      const firstLineY = this.currentY;
      this.addStatsCard('Saldo Total', data.saldoApi || 'N/A', 'Saldo atual da conta (API)', this.margin, cardWidth, firstLineY);
      this.addStatsCard('Entradas', formatCurrency(data.stats.totalEntries), 'Total de créditos no período', this.margin + cardWidth + 10, cardWidth, firstLineY);
      
      this.currentY = firstLineY + 25; // Avançar para próxima linha
      
      // Segunda linha de cards
      const secondLineY = this.currentY;
      this.addStatsCard('Saídas', formatCurrency(data.stats.totalExits), 'Total de débitos no período', this.margin, cardWidth, secondLineY);
      this.addStatsCard('Taxas', formatCurrency(data.stats.totalFees), 'Total de taxas no período', this.margin + cardWidth + 10, cardWidth, secondLineY);
      
      this.currentY = secondLineY + 30; // Espaçamento após os cards
      
      // Fluxo líquido
      this.addKeyValue('Fluxo Líquido', formatCurrency(data.stats.netFlow), 11);
      
      this.currentY += 10;
      this.addLine();
      
      // Tabela de transações
      if (data.transactions.length > 0) {
        this.addSectionTitle('Detalhamento das Transações');
        this.addTransactionTable(data.transactions);
      }
      
      // Rodapé
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'italic');
      this.doc.text(
        'Documento gerado automaticamente pelo sistema TCR',
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
      
      // Salvar o PDF com nome dinâmico baseado no período filtrado
      const startDateForFile = new Date(data.searchParams.startDate * 1000);
      const endDateForFile = new Date(data.searchParams.endDate * 1000);
      
      const formatDateForFileName = (date: Date): string => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      };
      
      const startDateStr = formatDateForFileName(startDateForFile);
      const endDateStr = formatDateForFileName(endDateForFile);
      
      // Se for o mesmo dia, usar apenas uma data
      const dateRange = startDateStr === endDateStr ? startDateStr : `${startDateStr}_a_${endDateStr}`;
      
      const fileName = `extrato-tcr-${data.searchParams.accountNumber}-${dateRange}.pdf`;
      this.doc.save(fileName);
      
      console.log('✅ PDF exportado com sucesso:', fileName);
      
    } catch (error) {
      console.error('❌ Erro ao exportar PDF:', error);
      throw error;
    }
  }
}

export const pdfExportService = new PDFExportService(); 