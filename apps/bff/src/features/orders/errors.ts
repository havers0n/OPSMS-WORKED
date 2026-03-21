export type OrdersErrorCode = string;

export type OrdersErrorShape = {
  code: OrdersErrorCode;
  message: string;
};

// TODO(PR-02+): define typed orders domain/integration errors.
