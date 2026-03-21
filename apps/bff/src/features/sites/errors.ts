export type SitesErrorCode = string;

export type SitesErrorShape = {
  code: SitesErrorCode;
  message: string;
};

// TODO(PR-02+): define typed sites domain/integration errors.
