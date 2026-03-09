export function currency(value: number | string) {
  const amount = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2
  }).format(Number.isNaN(amount) ? 0 : amount);
}

export function safeDate(value: string | Date | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
