export type InventoryErrorCode = string;

export type InventoryErrorShape = {
  code: InventoryErrorCode;
  message: string;
};

// TODO(PR-02+): define typed inventory domain/integration errors.
