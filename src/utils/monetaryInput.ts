/**
 * 🪙 Utilitários para Input Monetário Brasileiro
 * Formatação monetária que preenche da direita para esquerda
 */

/**
 * Converte formato brasileiro para formato americano
 * Ex: "1.000,50" -> "1000.50"
 */
export const convertBrazilianToUS = (value: string): string => {
  return value
    .replace(/\./g, '')      // Remove pontos (separadores de milhar)
    .replace(',', '.');      // Substitui vírgula por ponto
};

/**
 * Formata número monetário preenchendo da direita para esquerda
 * Mantém sempre 2 casas decimais
 * Ex: digita "1" → "0,01", digita "1000" → "10,00"
 */
export const formatMonetaryInput = (value: string): string => {
  // Remove tudo que não é número
  const numbersOnly = value.replace(/\D/g, '');
  
  // Se vazio, retorna formato inicial
  if (!numbersOnly) return '0,00';
  
  // Converte para número e divide por 100 para ter decimais
  const numValue = parseInt(numbersOnly, 10) / 100;
  
  // Formata com 2 casas decimais sempre
  const formatted = numValue.toFixed(2);
  
  // Separa parte inteira e decimal
  const [integerPart, decimalPart] = formatted.split('.');
  
  // Adiciona separador de milhar na parte inteira
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Retorna no formato brasileiro
  return `${formattedInteger},${decimalPart}`;
};

/**
 * Formata número monetário para USDT (4 casas decimais)
 * Preenche da direita para esquerda
 * Ex: digita "1" → "0,0001", digita "10000" → "1,0000"
 */
export const formatUSDTInput = (value: string): string => {
  // Remove tudo que não é número
  const numbersOnly = value.replace(/\D/g, '');
  
  // Se vazio, retorna formato inicial
  if (!numbersOnly) return '0,0000';
  
  // Converte para número e divide por 10000 para ter 4 decimais
  const numValue = parseInt(numbersOnly, 10) / 10000;
  
  // Formata com 4 casas decimais sempre
  const formatted = numValue.toFixed(4);
  
  // Separa parte inteira e decimal
  const [integerPart, decimalPart] = formatted.split('.');
  
  // Adiciona separador de milhar na parte inteira
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Retorna no formato brasileiro
  return `${formattedInteger},${decimalPart}`;
};

/**
 * Converte formato brasileiro para formato americano para USDT
 * Ex: "1.000,5000" -> "1000.5000"
 */
export const convertBrazilianUSDTToUS = (value: string): string => {
  return value
    .replace(/\./g, '')      // Remove pontos (separadores de milhar)
    .replace(',', '.');      // Substitui vírgula por ponto
};

/**
 * Extrai valor numérico do formato brasileiro
 */
export const getNumericValue = (value: string): number => {
  if (!value) return 0;
  const converted = convertBrazilianToUS(value);
  return parseFloat(converted) || 0;
};

/**
 * Extrai valor numérico do formato brasileiro USDT
 */
export const getNumericUSDTValue = (value: string): number => {
  if (!value) return 0;
  const converted = convertBrazilianUSDTToUS(value);
  return parseFloat(converted) || 0;
};

