// How a customer pays. QR is listed so the checkout can show it, but no QR provider is
// connected yet, so no merchant can accept it.
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  QR = 'QR',
}

export const AVAILABLE_PAYMENT_METHODS: readonly PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.BANK_TRANSFER,
];
