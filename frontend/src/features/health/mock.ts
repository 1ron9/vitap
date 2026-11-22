/** Explicit offline preview, using the same resource shape as M1 HTTP. Never used in real mode. */
import fixtures from "@/data/seed_fixtures.json";
import { ApiError } from "@/shared/api";
import type {
  Entry,
  Observation,
  Profile,
  Condition,
  Allergy,
  Course,
  Preferences,
  DrugOption,
} from "./types";

type State = {
  profile: Profile;
  conditions: Condition[];
  allergies: Allergy[];
  entries: Entry[];
  courses: Course[];
  preferences: Preferences;
  confirmed_at: string | null;
  options: DrugOption[];
};
function stableId(text: string) {
  let hash = 0;
  for (const c of text) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, "0")}`;
}
const stores = new Map<string, State>();
const fail = (message: string, status = 422): never => {
  throw new ApiError(message, status, status === 404 ? "RESOURCE_NOT_FOUND" : "VALIDATION_ERROR");
};
function initial(email: string): State {
  const fixture = (fixtures as Record<string, any>)[email];
  const p = fixture?.profile || {};
  return {
    profile: {
      id: stableId(email),
      full_name: p.fullName || null,
      date_of_birth: p.dob || null,
      biological_sex: p.gender === "Nam" ? "MALE" : p.gender === "Nữ" ? "FEMALE" : null,
      phone: p.phone || null,
      height_cm: null,
    },
    conditions: (p.conditions || []).map((name: string) => ({
      id: stableId(email + name),
      condition_name: name,
      status: "ACTIVE",
      diagnosed_at: null,
      icd10_code: null,
      description: null,
      verified: false,
    })),
    allergies: (p.allergies || []).map((name: string) => ({
      id: stableId(email + name),
      allergen_name: name,
      allergen_type: null,
      reaction: null,
      severity: null,
      ingredient_id: null,
      verified: false,
    })),
    entries: (fixture?.entries || []).map((e: any, index: number) => {
      const at = new Date(e.at + "+07:00").toISOString(),
        observations: Observation[] = [];
      const add = (
        type: string,
        value: number,
        unit: string,
        secondary: number | null = null,
        raw: number | null = null,
        rawUnit: string | null = null,
      ) =>
        observations.push({
          id: stableId(`${email}:${index}:${type}`),
          observation_type: type,
          value,
          unit,
          secondary_value: secondary,
          measured_at: at,
          entered_value: raw,
          entered_unit: rawUnit,
        });
      if (e.bp) add("BLOOD_PRESSURE", e.bp[0], "mmHg", e.bp[1]);
      if (e.hr) add("HEART_RATE", e.hr, "bpm");
      if (e.wt) add("WEIGHT", e.wt, "kg");
      if (e.glu) add("GLUCOSE", e.glu.mmol, "mmol/L", null, e.glu.entered.v, e.glu.entered.unit);
      return {
        id: stableId(`${email}:entry:${index}`),
        title: null,
        content: e.note || null,
        mood: null,
        entry_type: "DAILY",
        recorded_at: at,
        observations,
      };
    }),
    courses: [],
    preferences: {
      allow_ai_health_context: true,
      enable_allergy_alerts: true,
      ai_context_available: true,
    },
    confirmed_at: null,
    options: (fixture?.prescriptions || []).flatMap((rx: any) =>
      rx.drugs.map((d: any) => ({
        drug_id: stableId(d.name),
        brand_name: d.name,
        strength: d.strength || null,
        prescription_item_id: null,
        dosage: null,
        frequency: d.freq || null,
      })),
    ),
  };
}
function store(email: string) {
  if (!stores.has(email)) {
    const saved = localStorage.getItem(`vitap-m1-mock-v1-${email}`);
    try {
      stores.set(email, saved ? JSON.parse(saved) : initial(email));
    } catch {
      stores.set(email, initial(email));
    }
  }
  return stores.get(email)!;
}
function reading(input: any, recorded: string, old?: Observation): Observation {
  const result = {
    ...(old || {
      id: crypto.randomUUID(),
      secondary_value: null,
      entered_value: null,
      entered_unit: null,
    }),
    ...input,
    measured_at: input.measured_at || old?.measured_at || recorded,
  };
  if (!Number.isFinite(result.value) || result.value <= 0) fail("Giá trị phải là số lớn hơn 0");
  if (new Date(result.measured_at).getTime() > Date.now())
    fail("Thời gian đo không được ở tương lai");
  if (result.observation_type === "BLOOD_PRESSURE" && !(result.secondary_value > 0))
    fail("Nhập đủ tâm thu và tâm trương");
  if (result.observation_type === "GLUCOSE" && (!old || input.value !== undefined)) {
    result.entered_value = result.value;
    result.entered_unit = input.unit || "mmol/L";
    result.unit = "mmol/L";
    result.value = Number(
      (result.entered_unit === "mg/dL" ? result.value / 18 : result.value).toFixed(4),
    );
  }
  return result;
}
function validateEntry(e: Entry) {
  if (!e.title?.trim() && !e.content?.trim() && !e.observations.length)
    fail("Ghi chép cần nội dung hoặc số đo", 409);
  if (e.observations.length > 100) fail("Tối đa 100 số đo");
  if (new Date(e.recorded_at).getTime() > Date.now())
    fail("Thời gian ghi chép không được ở tương lai");
}
export async function mockHealthApi<T>(url: string, method = "GET", body?: any): Promise<T> {
  const email = localStorage.getItem("vitap-user-email") || "guest";
  if (email === "guest") fail("Cần đăng nhập", 401);
  const state = structuredClone(store(email)),
    parsed = new URL(url, "http://mock.local"),
    [resource, id, operation] = parsed.pathname.split("/").filter(Boolean);
  let result: any;
  const paginate = (list: any[]) => {
    const page = Number(parsed.searchParams.get("page") || 1),
      size = Number(parsed.searchParams.get("page_size") || 20);
    return {
      items: list.slice((page - 1) * size, page * size),
      pagination: { page, page_size: size, total: list.length },
    };
  };
  if (resource === "profile") {
    if (method === "PATCH") Object.assign(state.profile, body);
    result = state.profile;
  } else if (resource === "preferences") {
    if (method === "PATCH")
      Object.assign(state.preferences, body, {
        ai_context_available:
          body.allow_ai_health_context ?? state.preferences.allow_ai_health_context,
      });
    result = state.preferences;
  } else if (resource === "allergy-declaration") {
    if (method === "PUT") {
      if (state.allergies.length) fail("Danh sách dị ứng chưa rỗng", 409);
      state.confirmed_at =
        body.state === "NO_KNOWN_ALLERGIES" ? state.confirmed_at || new Date().toISOString() : null;
    }
    result = {
      state: state.allergies.length
        ? "HAS_ALLERGIES"
        : state.confirmed_at
          ? "NO_KNOWN_ALLERGIES"
          : "UNKNOWN",
      confirmed_at: state.confirmed_at,
    };
  } else if (resource === "medication-course-options")
    result = paginate(
      id === "prescription-items"
        ? []
        : state.options.filter((x) =>
            x.brand_name.toLowerCase().includes((parsed.searchParams.get("q") || "").toLowerCase()),
          ),
    );
  else if (resource === "entries") {
    const item = id ? state.entries.find((x) => x.id === id) : undefined;
    if (id && !item) fail("Không tìm thấy ghi chép", 404);
    if (method === "GET")
      result = id
        ? item
        : paginate(
            state.entries
              .filter(
                (e) =>
                  (!parsed.searchParams.get("from") ||
                    e.recorded_at >= parsed.searchParams.get("from")!) &&
                  (!parsed.searchParams.get("to") ||
                    e.recorded_at < parsed.searchParams.get("to")!) &&
                  (!parsed.searchParams.get("observation_type") ||
                    e.observations.some(
                      (o) => o.observation_type === parsed.searchParams.get("observation_type"),
                    )),
              )
              .sort(
                (a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id),
              ),
          );
    if (method === "POST") {
      const row = {
        ...body,
        id: crypto.randomUUID(),
        mood: null,
        entry_type: "DAILY",
        observations: body.observations.map((o: any) => reading(o, body.recorded_at)),
      };
      validateEntry(row);
      state.entries.unshift(row);
      result = row;
    }
    if (method === "PATCH" && item) {
      if (operation === "aggregate") {
        Object.assign(item, body.entry || {});
        const c = body.observations || {};
        for (const u of c.update || []) {
          const index = item.observations.findIndex((o) => o.id === u.id);
          if (index < 0) fail("Không tìm thấy số đo", 404);
          item.observations[index] = reading(u, item.recorded_at, item.observations[index]);
        }
        item.observations = item.observations.filter((o) => !(c.delete || []).includes(o.id));
        item.observations.push(...(c.create || []).map((o: any) => reading(o, item.recorded_at)));
      } else Object.assign(item, body);
      validateEntry(item);
      result = item;
    }
    if (method === "DELETE") state.entries = state.entries.filter((x) => x.id !== id);
  } else if (
    resource === "conditions" ||
    resource === "allergies" ||
    resource === "medication-courses"
  ) {
    const key = resource === "medication-courses" ? "courses" : resource,
      list = state[key] as any[],
      item = id ? list.find((x) => x.id === id) : undefined;
    if (id && !item) fail("Không tìm thấy tài nguyên", 404);
    if (method === "GET")
      result = id
        ? item
        : paginate(
            list.filter(
              (x) =>
                !parsed.searchParams.get("status") ||
                x.status === parsed.searchParams.get("status"),
            ),
          );
    if (method === "POST") {
      const option =
        key === "courses" ? state.options.find((x) => x.drug_id === body.drug_id) : null;
      if (key === "courses" && !option) fail("Không tìm thấy thuốc", 404);
      result = {
        ...(option || {}),
        ...body,
        id: crypto.randomUUID(),
        verified: false,
        status: body.status || "ACTIVE",
      };
      list.unshift(result);
      if (key === "allergies") state.confirmed_at = null;
    }
    if (method === "PATCH") {
      Object.assign(item, body);
      result = item;
    }
    if (method === "DELETE") (state[key] as any[]) = list.filter((x) => x.id !== id);
  } else fail("Không có preview cho resource này", 404);
  if (method !== "GET") {
    stores.set(email, state);
    localStorage.setItem(`vitap-m1-mock-v1-${email}`, JSON.stringify(state));
  }
  return structuredClone(result) as T;
}
