import React, { useState } from 'react';
import { checkDrugInteractions } from '../services/apiClient';

export const InteractionPage: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await checkDrugInteractions({
        drugs: [
          { brand_id: 1, raw_name: "Decolgen Forte", source: "MANUAL_INPUT" },
          { brand_id: 2, raw_name: "Amlodipine 5mg", source: "AUTOCOMPLETE" }
        ],
        patient_profile: { age: 65, gender: "MALE", condition_ids: [1], is_pregnant: false }
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="interaction-page">
      <h2>M4/F3 - Tra Cứu Tương Tác Thuốc & Cảnh Báo An Toàn</h2>
      <button onClick={handleCheck} disabled={loading}>
        {loading ? "Đang đối soát..." : "Kiểm tra tương tác thuốc ngay"}
      </button>

      {result && (
        <div className={`alert-box alert-${result.summary.overall_risk_level.toLowerCase()}`}>
          <h3>Mức độ rủi ro: {result.summary.overall_risk_level}</h3>
          <p>{result.personalized_advice.content_markdown}</p>
        </div>
      )}
    </div>
  );
};

export default InteractionPage;
