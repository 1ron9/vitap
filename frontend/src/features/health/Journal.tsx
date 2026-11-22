import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card, PageHeader } from "@/components/ui";
import { useHealthQuery, healthMutation } from "./hooks";
import { Field, Failure, QueryState, useAction, inputClass as cls, HealthGate } from "./ui";
import type { Entry, Observation, Page, Metric } from "./types";
import { localDateTime, toUtc, today, dayBounds, displayTime } from "./time";
import { metrics } from "./metrics";
import {
  SymptomsEditor,
  symptomChanges,
  symptomDraft,
  symptomPayload,
  type SymptomDraft,
} from "./SymptomsEditor";

type DraftReading = {
  key: string;
  id?: string;
  type: string;
  value: string;
  secondary: string;
  unit: string;
  time: string;
  original?: Observation;
};
function draft(o: Observation): DraftReading {
  return {
    key: o.id,
    id: o.id,
    type: o.observation_type,
    value: String(o.entered_value ?? o.value),
    secondary: o.secondary_value === null ? "" : String(o.secondary_value),
    unit: o.entered_unit || o.unit,
    time: localDateTime(o.measured_at),
    original: o,
  };
}
function readingInput(row: DraftReading) {
  return {
    observation_type: row.type,
    value: Number(row.value),
    secondary_value: row.type === "BLOOD_PRESSURE" ? Number(row.secondary) : null,
    unit: row.unit,
    ...(row.time ? { measured_at: toUtc(row.time) } : {}),
  };
}
export function aggregateCommand(
  initial: Entry,
  header: { title: string | null; content: string | null; recorded_at: string },
  rows: DraftReading[],
) {
  const create = rows.filter((r) => !r.id).map(readingInput);
  const update = rows
    .filter((r) => r.id && r.original)
    .flatMap((r) => {
      const o = r.original!,
        body: Record<string, unknown> = { id: r.id };
      if (
        Number(r.value) !== (o.entered_value ?? o.value) ||
        r.unit !== (o.entered_unit || o.unit) ||
        r.secondary !== (o.secondary_value === null ? "" : String(o.secondary_value))
      ) {
        body.value = Number(r.value);
        body.unit = r.unit;
        body.secondary_value = r.type === "BLOOD_PRESSURE" ? Number(r.secondary) : null;
      }
      if (r.time !== localDateTime(o.measured_at)) body.measured_at = toUtc(r.time);
      return Object.keys(body).length > 1 ? [body] : [];
    });
  const deleted = initial.observations
    .filter((o) => !rows.some((r) => r.id === o.id))
    .map((o) => o.id);
  const entry: Record<string, unknown> = {};
  for (const key of ["title", "content", "recorded_at"] as const)
    if (header[key] !== initial[key]) entry[key] = header[key];
  if (!Object.keys(entry).length && !create.length && !update.length && !deleted.length)
    return null;
  return {
    ...(Object.keys(entry).length ? { entry } : {}),
    observations: { create, update, delete: deleted },
  };
}
function JournalContent() {
  const [search, setSearch] = useSearchParams();
  const entryId = search.get("entry");
  const [page, setPage] = useState(1),
    [metric, setMetric] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const params = new URLSearchParams({
    page: String(page),
    ...dayBounds(from, to),
    ...(metric ? { observation_type: metric } : {}),
  });
  const list = useHealthQuery<Page<Entry>>(entryId ? null : `/entries?${params}`);
  const detail = useHealthQuery<Entry>(entryId ? `/entries/${encodeURIComponent(entryId)}` : null);
  const query = entryId ? detail : list;
  const entries = entryId ? (detail.data ? [detail.data] : []) : list.data?.items;
  const total = list.data?.pagination.total ?? 0;
  const action = useAction();
  const [edit, setEdit] = useState<Entry | "new" | null>(null),
    [deleting, setDeleting] = useState<Entry | null>(null);
  return (
    <>
      <PageHeader
        title="Sổ tay"
        sub="Ghi chép chỉ số sức khỏe theo thời gian"
        right={
          entryId ? (
            <Link className="text-brand-600 underline" to="/journal">
              Xem tất cả ghi chép
            </Link>
          ) : (
            <Button onClick={() => setEdit("new")}>Thêm ghi chép</Button>
          )
        }
      />
      {!entryId && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Field label="Từ ngày">
            <input
              className={cls}
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Đến ngày (bao gồm)">
            <input
              className={cls}
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Lọc theo chỉ số">
            <select
              className={cls}
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {Object.entries(metrics).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <QueryState query={query}>
        <div className="grid gap-4">
          {entries?.map((e) => (
            <Card key={e.id} className="p-5">
              <h2 className="font-semibold">{e.title || "Ghi chép sức khỏe"}</h2>
              <p className="text-sm text-ink-600">{displayTime(e.recorded_at)}</p>
              {e.content && <p className="my-3 whitespace-pre-wrap">{e.content}</p>}
              <ul className="my-3 space-y-1">
                {e.observations.map((o) => (
                  <li key={o.id}>
                    {metrics[o.observation_type as Metric]?.label ||
                      `${o.observation_type} (dữ liệu cũ)`}
                    : {o.entered_value ?? o.value}
                    {o.secondary_value !== null ? `/${o.secondary_value}` : ""}{" "}
                    {o.entered_unit || o.unit} · {displayTime(o.measured_at)}
                  </li>
                ))}
              </ul>
              {(e.symptoms?.length ?? 0) > 0 && (
                <div className="my-3">
                  <h3 className="font-semibold">Triệu chứng</h3>
                  <ul className="list-inside list-disc space-y-1">
                    {e.symptoms?.map((symptom) => (
                      <li key={symptom.id} className="whitespace-pre-wrap">
                        {symptom.symptom_name}
                        {symptom.severity !== null
                          ? ` · mức độ tự khai ${symptom.severity}/10`
                          : ""}
                        {symptom.duration_minutes !== null
                          ? ` · ${symptom.duration_minutes} phút`
                          : ""}
                        {symptom.notes ? ` · ${symptom.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEdit(e)}>
                  Sửa ghi chép
                </Button>
                <Button variant="secondary" onClick={() => setDeleting(e)}>
                  Xóa ghi chép
                </Button>
              </div>
            </Card>
          ))}
        </div>
        {!entryId && entries?.length === 0 && (
          <Card className="p-6">
            Không có ghi chép trong khoảng này. Bạn có thể thêm ghi chép hoặc đổi bộ lọc.
          </Card>
        )}
        {!entryId && (page > 1 || total > 20) && (
          <div className="my-4 flex gap-3">
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Trang trước
            </Button>
            <span>
              Trang {page} · {total} bản ghi
            </span>
            <Button disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
              Trang sau
            </Button>
          </div>
        )}
      </QueryState>
      {edit && (
        <EntryForm
          key={edit === "new" ? "new" : edit.id}
          initial={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
      {deleting && (
        <Card className="my-4 p-5">
          <div role="alertdialog" aria-label="Xác nhận xóa ghi chép">
            <p>Xóa ghi chép, toàn bộ số đo và triệu chứng trong ghi chép này?</p>
            <Button
              loading={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await healthMutation(`/entries/${deleting.id}`, "DELETE");
                  setDeleting(null);
                  if (entryId) setSearch({}, { replace: true });
                })
              }
            >
              Xác nhận xóa
            </Button>
            <Button variant="secondary" disabled={action.busy} onClick={() => setDeleting(null)}>
              Hủy
            </Button>
          </div>
        </Card>
      )}
      <Failure error={action.error} />
    </>
  );
}
function EntryForm({ initial, onClose }: { initial?: Entry; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title || ""),
    [content, setContent] = useState(initial?.content || ""),
    [time, setTime] = useState(localDateTime(initial?.recorded_at || new Date()));
  const [rows, setRows] = useState<DraftReading[]>(() => initial?.observations.map(draft) || []),
    [symptoms, setSymptoms] = useState<SymptomDraft[]>(
      () => initial?.symptoms?.map(symptomDraft) || [],
    ),
    [newType, setNewType] = useState<Metric>("BLOOD_PRESSURE"),
    action = useAction();
  const update = (key: string, patch: Partial<DraftReading>) =>
    setRows((old) => old.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <Card className="my-5 p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const recorded_at =
              initial && time === localDateTime(initial.recorded_at)
                ? initial.recorded_at
                : toUtc(time);
            const header = {
              title: title.trim() || null,
              content: content.trim() || null,
              recorded_at,
            };
            if (initial) {
              const command = aggregateCommand(initial, header, rows);
              const symptomCommand = symptomChanges(initial.symptoms || [], symptoms);
              if (command || symptomCommand)
                await healthMutation(`/entries/${initial.id}/aggregate`, "PATCH", {
                  ...command,
                  ...(symptomCommand ? { symptoms: symptomCommand } : {}),
                });
            } else
              await healthMutation("/entries", "POST", {
                ...header,
                observations: rows.map(readingInput),
                symptoms: symptoms.map(symptomPayload),
              });
            onClose();
          });
        }}
      >
        <h2 className="text-lg font-semibold">{initial ? "Sửa ghi chép" : "Thêm ghi chép"}</h2>
        <Field label="Tiêu đề">
          <input
            autoFocus
            className={cls}
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Thời gian ghi chép (giờ Việt Nam)">
          <input
            className={cls}
            type="datetime-local"
            required
            step="1"
            max={localDateTime(new Date())}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <Field label="Ghi chú">
          <textarea
            className={cls}
            maxLength={10000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Loại số đo mới">
            <select
              className={cls}
              value={newType}
              onChange={(e) => setNewType(e.target.value as Metric)}
            >
              {Object.entries(metrics).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Button
            type="button"
            disabled={rows.length >= 100 || action.busy}
            onClick={() =>
              setRows((old) => [
                ...old,
                {
                  key: crypto.randomUUID(),
                  type: newType,
                  value: "",
                  secondary: "",
                  unit: metrics[newType].unit,
                  time: "",
                },
              ])
            }
          >
            Thêm số đo
          </Button>
        </div>
        {rows.map((r, i) => (
          <fieldset
            key={r.key}
            className="grid gap-3 rounded-lg border border-line-200 p-4 sm:grid-cols-2"
          >
            <legend className="px-2 font-semibold">
              {i + 1}. {metrics[r.type as Metric]?.label || `${r.type} (dữ liệu cũ, chỉ đọc)`}
            </legend>
            <Field
              label={
                r.type === "BLOOD_PRESSURE"
                  ? "Tâm thu"
                  : `Giá trị ${metrics[r.type as Metric]?.label || r.type}`
              }
            >
              <input
                className={cls}
                type="number"
                min="0.0001"
                step="0.0001"
                required
                disabled={!(r.type in metrics)}
                value={r.value}
                onChange={(e) => update(r.key, { value: e.target.value })}
              />
            </Field>
            {r.type === "BLOOD_PRESSURE" && (
              <Field label="Tâm trương">
                <input
                  className={cls}
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  required
                  value={r.secondary}
                  onChange={(e) => update(r.key, { secondary: e.target.value })}
                />
              </Field>
            )}
            <Field label="Đơn vị số đo">
              {r.type === "GLUCOSE" ? (
                <select
                  className={cls}
                  value={r.unit}
                  onChange={(e) => update(r.key, { unit: e.target.value })}
                >
                  <option>mmol/L</option>
                  <option>mg/dL</option>
                </select>
              ) : (
                <input className={cls} readOnly value={r.unit} />
              )}
            </Field>
            <Field label="Thời gian đo (để trống dùng thời gian ghi chép)">
              <input
                className={cls}
                type="datetime-local"
                step="1"
                max={localDateTime(new Date())}
                disabled={!(r.type in metrics)}
                value={r.time}
                onChange={(e) => update(r.key, { time: e.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={action.busy}
              onClick={() => setRows((old) => old.filter((x) => x.key !== r.key))}
            >
              Bỏ số đo {i + 1}
            </Button>
          </fieldset>
        ))}
        <SymptomsEditor drafts={symptoms} onChange={setSymptoms} busy={action.busy} />
        <p className="text-sm text-ink-600">
          Ghi chép có thể chỉ có triệu chứng, tiêu đề, ghi chú hoặc số đo. Một lần Lưu sẽ áp dụng
          toàn bộ thay đổi; nếu xóa nội dung cuối cùng, hãy xóa cả ghi chép.
        </p>
        <Failure error={action.error} />
        <div className="flex gap-3">
          <Button
            type="submit"
            loading={action.busy}
            disabled={!title.trim() && !content.trim() && !rows.length && !symptoms.length}
          >
            Lưu ghi chép
          </Button>
          <Button type="button" variant="secondary" disabled={action.busy} onClick={onClose}>
            Hủy
          </Button>
        </div>
      </form>
    </Card>
  );
}
export function RealJournal() {
  return (
    <HealthGate>
      <JournalContent />
    </HealthGate>
  );
}
