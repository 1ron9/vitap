export type Page<T> = {
  items: T[];
  pagination: { page: number; page_size: number; total: number };
};
export type Profile = {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  phone: string | null;
  height_cm: number | null;
};
export type Condition = {
  id: string;
  condition_name: string;
  status: string;
  diagnosed_at: string | null;
  icd10_code: string | null;
  description: string | null;
  verified: boolean;
};
export type Allergy = {
  id: string;
  allergen_name: string;
  allergen_type: string | null;
  reaction: string | null;
  severity: string | null;
  ingredient_id: string | null;
  verified: boolean;
};
export type Preferences = {
  allow_ai_health_context: boolean;
  enable_allergy_alerts: boolean;
  ai_context_available: boolean;
};
export type Declaration = {
  state: "UNKNOWN" | "HAS_ALLERGIES" | "NO_KNOWN_ALLERGIES";
  confirmed_at: string | null;
};
export type Metric = "BLOOD_PRESSURE" | "GLUCOSE" | "WEIGHT" | "HEART_RATE";
export type Observation = {
  id: string;
  observation_type: string;
  value: number;
  secondary_value: number | null;
  unit: string;
  measured_at: string;
  entered_value: number | null;
  entered_unit: string | null;
};
export type RawObservation = Observation & {
  entry_id: string;
  source_type: string | null;
  source_reference: string | null;
  created_at: string;
};
export type SymptomInput = {
  symptom_name: string;
  severity: number | null;
  duration_minutes: number | null;
  notes: string | null;
};
export type Symptom = SymptomInput & { id: string; entry_id: string; created_at: string | null };
export type Entry = {
  id: string;
  title: string | null;
  content: string | null;
  mood: string | null;
  entry_type: string;
  recorded_at: string;
  observations: Observation[];
  symptoms?: Symptom[];
};
export type DrugOption = {
  drug_id: string;
  brand_name: string;
  strength: string | null;
  prescription_item_id: string | null;
  dosage: string | null;
  frequency: string | null;
};
export type Course = DrugOption & {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "STOPPED";
  start_date: string;
  end_date: string | null;
};
