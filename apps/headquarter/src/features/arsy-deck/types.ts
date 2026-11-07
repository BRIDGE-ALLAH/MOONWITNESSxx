export interface ArsyDeckMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
}

export interface ArsyDeckSnapshot {
  readonly source: "demo";
  readonly capturedAt: string;
  readonly metrics: readonly ArsyDeckMetric[];
  readonly notice: string;
}
