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
  RawObservation,
  Symptom,
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
        symptoms: [],
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
      const state: State = saved ? JSON.parse(saved) : initial(email);
      state.entries.forEach((entry) => {
        entry.symptoms ??= [];
      });
      stores.set(email, state);
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
  if (!e.title?.trim() && !e.content?.trim() && !e.observations.length && !e.symptoms?.length)
    fail("Ghi chép cần tiêu đề, ghi chú, số đo hoặc triệu chứng", 409);
  if (e.observations.length > 100) fail("Tối đa 100 số đo");
  if ((e.symptoms?.length ?? 0) > 100) fail("Tối đa 100 triệu chứng");
  if (new Date(e.recorded_at).getTime() > Date.now())
    fail("Thời gian ghi chép không được ở tương lai");
}

function symptomInput(body: Record<string, unknown>, entryId: string, previous?: Symptom): Symptom {
  if (
    Object.keys(body).some(
      (key) => !["symptom_name", "severity", "duration_minutes", "notes"].includes(key),
    )
  )
    fail("Trường triệu chứng không hợp lệ");
  const next = { severity: null, duration_minutes: null, notes: null, ...previous, ...body };
  const name = typeof next.symptom_name === "string" ? next.symptom_name.trim() : "";
  const intInRange = (value: unknown, min: number, max: number) =>
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max);
  if (
    !name ||
    name.length > 255 ||
    !intInRange(next.severity, 1, 10) ||
    !intInRange(next.duration_minutes, 0, 2_147_483_647) ||
    (next.notes !== null && (typeof next.notes !== "string" || next.notes.trim().length > 5000))
  )
    fail("Tên, mức độ, thời lượng hoặc ghi chú triệu chứng không hợp lệ");
  return {
    id: previous?.id ?? crypto.randomUUID(),
    entry_id: entryId,
    created_at: previous ? previous.created_at : new Date().toISOString(),
    symptom_name: name,
    severity: next.severity as number | null,
    duration_minutes: next.duration_minutes as number | null,
    notes: typeof next.notes === "string" ? next.notes.trim() : null,
  };
}

type SymptomCommands = {
  create?: Record<string, unknown>[];
  update?: (Record<string, unknown> & { id: string })[];
  delete?: string[];
};

function applySymptoms(entry: Entry, commands: SymptomCommands = {}) {
  const current = (entry.symptoms ??= []);
  const targets = [...(commands.update || []).map((row) => row.id), ...(commands.delete || [])];
  if (targets.length !== new Set(targets).size) fail("Triệu chứng bị cập nhật nhiều lần");
  for (const target of targets)
    if (!current.some((row) => row.id === target)) fail("Không tìm thấy triệu chứng", 404);
  for (const { id, ...patch } of commands.update || []) {
    if (!Object.keys(patch).length) fail("Cần trường triệu chứng để cập nhật");
    const index = current.findIndex((row) => row.id === id);
    current[index] = symptomInput(patch, entry.id, current[index]);
  }
  entry.symptoms = current.filter((row) => !(commands.delete || []).includes(row.id));
  entry.symptoms.push(...(commands.create || []).map((s) => symptomInput(s, entry.id)));
}

function rawObservations(entries: Entry[], params: URLSearchParams): RawObservation[] {
  const keys = ["observation_type", "from", "to", "page", "page_size"];
  const metric = params.get("observation_type");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
  const start = Date.parse(from),
    end = Date.parse(to);
  const page = Number(params.get("page") ?? 1),
    size = Number(params.get("page_size") ?? 20);
  if (
    [...params.keys()].some((key) => !keys.includes(key)) ||
    !metric ||
    !["BLOOD_PRESSURE", "GLUCOSE", "WEIGHT", "HEART_RATE"].includes(metric) ||
    !timestamp.test(from) ||
    !timestamp.test(to) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    end - start > 366 * 86400000 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100
  )
    fail("Chỉ số, khoảng thời gian hoặc phân trang không hợp lệ");

  return entries
    .flatMap((entry) =>
      entry.observations.flatMap((observation) => {
        const time = Date.parse(observation.measured_at);
        if (observation.observation_type !== metric || !(start <= time && time < end)) return [];
        return [
          {
            ...observation,
            entry_id: entry.id,
            measured_at: new Date(time).toISOString(),
            source_type: "MANUAL",
            source_reference: null,
            // The offline store does not track creation timestamps; recording time is synthetic provenance.
            created_at: new Date(entry.recorded_at).toISOString(),
          },
        ];
      }),
    )
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at) || a.id.localeCompare(b.id));
}

export async function mockHealthApi<T>(url: string, method = "GET", body?: any): Promise<T> {
  const email = localStorage.getItem("vitap-user-email") || "guest";
  if (email === "guest") fail("Cần đăng nhập", 401);
  const state = structuredClone(store(email)),
    parsed = new URL(url, "http://mock.local"),
    [resource, id, operation, childId] = parsed.pathname.split("/").filter(Boolean);
  let result: any;
  const paginate = (list: any[]) => {
    const page = Number(parsed.searchParams.get("page") || 1),
      size = Number(parsed.searchParams.get("page_size") || 20);
    return {
      items: list.slice((page - 1) * size, page * size),
      pagination: { page, page_size: size, total: list.length },
    };
  };
  if (resource === "observations" && method === "GET" && !id) {
    result = paginate(rawObservations(state.entries, parsed.searchParams));
  } else if (resource === "profile") {
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
    if (operation === "symptoms" && item) {
      if (method === "POST" && !childId) {
        applySymptoms(item, { create: [body] });
        result = item.symptoms!.at(-1);
      } else if (method === "PATCH" && childId) {
        applySymptoms(item, { update: [{ ...body, id: childId }] });
        result = item.symptoms!.find((row) => row.id === childId);
      } else if (method === "DELETE" && childId) applySymptoms(item, { delete: [childId] });
      else fail("Không có preview cho thao tác này", 404);
      validateEntry(item);
    } else if (method === "GET")
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
    else if (method === "POST") {
      const entryId = crypto.randomUUID();
      const recordedAt = body.recorded_at ?? new Date().toISOString();
      const row = {
        ...body,
        id: entryId,
        mood: null,
        entry_type: "DAILY",
        recorded_at: recordedAt,
        observations: (body.observations || []).map((o: any) => reading(o, recordedAt)),
        symptoms: (body.symptoms || []).map((s: Record<string, unknown>) =>
          symptomInput(s, entryId),
        ),
      };
      if (
        !row.title?.trim() &&
        !row.content?.trim() &&
        !row.observations.length &&
        !row.symptoms.length
      )
        fail("Ghi chép cần tiêu đề, ghi chú, số đo hoặc triệu chứng");
      validateEntry(row);
      state.entries.unshift(row);
      result = row;
    } else if (method === "PATCH" && item) {
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
        applySymptoms(item, body.symptoms);
      } else Object.assign(item, body);
      validateEntry(item);
      result = item;
    } else if (method === "DELETE") state.entries = state.entries.filter((x) => x.id !== id);
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
