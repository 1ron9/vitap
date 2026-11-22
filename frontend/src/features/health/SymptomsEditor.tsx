import { Button } from "@/components/ui";
import { Field, inputClass } from "./ui";
import type { Symptom, SymptomInput } from "./types";

export type SymptomDraft = {
  key: string;
  original?: Symptom;
  name: string;
  severity: string;
  duration: string;
  notes: string;
};

export function symptomDraft(original?: Symptom): SymptomDraft {
  return {
    key: original?.id ?? crypto.randomUUID(),
    original,
    name: original?.symptom_name ?? "",
    severity: original?.severity?.toString() ?? "",
    duration: original?.duration_minutes?.toString() ?? "",
    notes: original?.notes ?? "",
  };
}

export function symptomPayload(draft: SymptomDraft): SymptomInput {
  return {
    symptom_name: draft.name.trim(),
    severity: draft.severity === "" ? null : Number(draft.severity),
    duration_minutes: draft.duration === "" ? null : Number(draft.duration),
    notes: draft.notes.trim() || null,
  };
}

export function symptomChanges(original: Symptom[], drafts: SymptomDraft[]) {
  const create: SymptomInput[] = [];
  const update: (Partial<SymptomInput> & { id: string })[] = [];
  const kept = new Set<string>();
  for (const draft of drafts) {
    const input = symptomPayload(draft);
    if (!draft.original) {
      create.push(input);
      continue;
    }
    const previous = symptomDraft(draft.original);
    const patch: Partial<SymptomInput> = {};
    if (draft.name !== previous.name) patch.symptom_name = input.symptom_name;
    if (draft.severity !== previous.severity) patch.severity = input.severity;
    if (draft.duration !== previous.duration) patch.duration_minutes = input.duration_minutes;
    if (draft.notes !== previous.notes) patch.notes = input.notes;
    kept.add(draft.original.id);
    if (Object.keys(patch).length) update.push({ id: draft.original.id, ...patch });
  }
  const deleted = original.filter((row) => !kept.has(row.id)).map((row) => row.id);
  return create.length || update.length || deleted.length
    ? { create, update, delete: deleted }
    : null;
}

export function SymptomsEditor({
  drafts,
  onChange,
  busy,
}: {
  drafts: SymptomDraft[];
  onChange: (drafts: SymptomDraft[]) => void;
  busy: boolean;
}) {
  function update(key: string, patch: Partial<SymptomDraft>) {
    onChange(drafts.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }
  return (
    <section className="grid gap-3" aria-label="Triệu chứng trong ghi chép">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Triệu chứng</h3>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || drafts.length >= 100}
          onClick={() => onChange([...drafts, symptomDraft()])}
        >
          Thêm triệu chứng
        </Button>
      </div>
      {drafts.map((row, i) => (
        <fieldset
          key={row.key}
          className="grid gap-3 rounded-lg border border-line-200 p-4 sm:grid-cols-2"
        >
          <legend className="px-2 font-semibold">Triệu chứng {i + 1}</legend>
          <Field label="Tên triệu chứng">
            <input
              className={inputClass}
              required
              maxLength={255}
              value={row.name}
              onChange={(e) => update(row.key, { name: e.target.value })}
            />
          </Field>
          <Field label="Mức độ tự khai (1–10)">
            <input
              className={inputClass}
              type="number"
              min="1"
              max="10"
              step="1"
              value={row.severity}
              onChange={(e) => update(row.key, { severity: e.target.value })}
            />
          </Field>
          <Field label="Thời lượng (phút)">
            <input
              className={inputClass}
              type="number"
              min="0"
              max="2147483647"
              step="1"
              value={row.duration}
              onChange={(e) => update(row.key, { duration: e.target.value })}
            />
          </Field>
          <Field label="Ghi chú triệu chứng">
            <textarea
              className={inputClass}
              maxLength={5000}
              value={row.notes}
              onChange={(e) => update(row.key, { notes: e.target.value })}
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onChange(drafts.filter((item) => item.key !== row.key))}
          >
            Bỏ triệu chứng {i + 1}
          </Button>
        </fieldset>
      ))}
    </section>
  );
}
