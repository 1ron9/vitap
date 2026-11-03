/**
 * API Client hỗ trợ Sandbox Mode
 * Khi bật cờ VITE_USE_MOCK=true, client tự động trả dữ liệu mock tức thì (0ms).
 */

import { MOCK_INTERACTION_RED_RESULT } from "./mockData";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export async function checkDrugInteractions(payload: any) {
  if (USE_MOCK) {
    console.info("⚡ [SANDBOX MODE] Trả về dữ liệu mock tương tác thuốc");
    return MOCK_INTERACTION_RED_RESULT;
  }

  const response = await fetch(`${BASE_URL}/ddi/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
