export type WavesErrorCode = string;

export type WavesErrorShape = {
  code: WavesErrorCode;
  message: string;
};

// TODO(PR-02+): define typed waves domain/integration errors.
