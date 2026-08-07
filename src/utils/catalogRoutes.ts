/** Map product/service category hints to dashboard catalog routes (UI only). */
export function routeForProductCategory(category?: string): string {
  const c = (category || '').toLowerCase();
  if (c.includes('pulsa') && !c.includes('international')) return '/dashboard/pulsa';
  if (c === 'data' || c.includes('paket')) return '/dashboard/paket-data';
  if (c.includes('voucher-internet')) return '/dashboard/voucher-internet';
  if (c === 'pln' || c.includes('token') || c.includes('listrik')) return '/dashboard/token-pln';
  if (c.includes('topup') || c.includes('ewallet') || c.includes('e-wallet')) {
    return '/dashboard/topup-digital';
  }
  if (c.includes('game')) return '/dashboard/game';
  if (c.includes('langganan') || c.includes('streaming')) return '/dashboard/langganan-digital';
  if (c.includes('international')) return '/dashboard/international';
  if (c.includes('voucher')) return '/dashboard/voucher-digital';
  if (c.includes('transfer')) return '/dashboard/transfer';
  if (c.includes('tagihan') || c.includes('bpjs') || c.includes('pdam')) {
    return '/dashboard/tagihan';
  }
  return '/dashboard';
}
