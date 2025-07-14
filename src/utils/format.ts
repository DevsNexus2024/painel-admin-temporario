
export const formatCurrency = (value: number, currency: string): string => {
  if (currency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  } else if (currency === 'USDT') {
    return `$ ${value.toFixed(2)}`;
  } else {
    return `${value.toFixed(2)} ${currency}`;
  }
};
