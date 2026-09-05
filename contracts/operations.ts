export interface OperationsStatus {
  checkedAt: string;
  services: Array<{ name: string; configured: boolean }>;
  counts: {
    assets: number;
    storageBytes: number;
    failedPayments: number;
    failedGenerations: number;
    stalledGenerations: number;
    openSupport: number;
  };
  trends: { generatedAt: string | null; lastError: string | null };
  paymentIssues: Array<{ eventId: string; type: string; createdAt: string }>;
}
