export type OrderStatus =
  | 'new'
  | 'assigned'
  | 'picking'
  | 'waiting_check'
  | 'returned'
  | 'ready_packing'
  | 'done';

export type OrderSize = 'S' | 'M' | 'L' | 'XL';

export type ErrorType =
  | 'wrong_quantity'
  | 'wrong_item'
  | 'missing_item'
  | 'bad_packing'
  | 'small_items_loose'
  | 'damaged'
  | 'other';

export interface Order {
  id: string;
  orderNumber: string;
  kav: string;
  pickerId?: string;
  checkerId?: string;
  lineCount: number;
  size: OrderSize;
  status: OrderStatus;
  createdAt: number;
  startedAt?: number;
  waitingCheckAt?: number;
  checkedAt?: number;
  finishedAt?: number;
  errorIds: string[];
  comment?: string;
}

export interface Picker {
  id: string;
  name: string;
  active: boolean;
}

export interface OrderError {
  id: string;
  orderId: string;
  type: ErrorType;
  comment?: string;
  createdAt: number;
  fixedAt?: number;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: string;
  actor: string;
  createdAt: number;
}
