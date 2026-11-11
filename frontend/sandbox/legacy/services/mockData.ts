/**
 * Frontend Mock Sandbox Data
 * Phụ trách: VT3 - Dương Phan Minh Trí (Frontend Lead)
 * Cho phép Frontend phát triển giao diện độc lập mà không cần chờ Backend API thật.
 */

export const MOCK_INTERACTION_RED_RESULT = {
  summary: {
    overall_risk_level: "RED",
    total_drugs_analyzed: 2,
    total_ingredients_resolved: 4,
    out_of_scope_drugs: []
  },
  ddi_alerts: [
    {
      severity: "RED",
      drug_a: "Decolgen Forte (chứa Phenylephrine)",
      drug_b: "Amlodipine 5mg",
      mechanism: "Phenylephrine kích thích alpha-1 adrenergic gây co mạch ngoại vi, làm giảm hoặc vô hiệu hóa tác dụng hạ huyết áp của Amlodipine.",
      clinical_management: "Không phối hợp. Khuyên bệnh nhân dùng thuốc cảm đơn chất chỉ chứa Paracetamol."
    }
  ],
  personalized_advice: {
    source_engine: "MOCK_SANDBOX",
    content_markdown: "Bác tuyệt đối không uống chung Decolgen Forte với thuốc huyết áp Amlodipine vì có thể làm huyết áp tăng vọt nguy hiểm.",
    disclaimer: "Thông tin chỉ mang tính tham khảo trong môi trường kiểm thử."
  }
};
