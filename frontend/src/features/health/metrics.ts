import type { Metric } from "./types";

export const metrics: Record<Metric, { label: string; unit: string }> = {
  BLOOD_PRESSURE: { label: "Huyết áp", unit: "mmHg" },
  GLUCOSE: { label: "Đường huyết", unit: "mmol/L" },
  WEIGHT: { label: "Cân nặng", unit: "kg" },
  HEART_RATE: { label: "Nhịp tim", unit: "bpm" },
};
