export const routes = {
  login: '/login',
  warehouse: '/warehouse',
  warehouseView: '/warehouse/view',
  products: '/products',
  operations: '/operations',
  waveDetail: '/operations/waves/:id',
  orders: '/orders',
  waves: '/waves'
} as const;

export function waveDetailPath(id: string) {
  return `/operations/waves/${id}`;
}
