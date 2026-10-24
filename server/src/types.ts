// Tipos de domínio padronizados (o SQLite guarda como String).
export type Role = 'ADMIN' | 'BUYER' | 'SELLER';
export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrderStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'REJECTED';
export type FulfillmentStatus =
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED';
export type PaymentResult = 'APPROVED' | 'REJECTED';
