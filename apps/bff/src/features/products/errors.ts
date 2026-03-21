export type ProductsErrorCode = string;

export type ProductsErrorShape = {
  code: ProductsErrorCode;
  message: string;
};

// TODO(PR-02+): define typed products domain/integration errors.
