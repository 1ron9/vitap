import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { useHealthQuery, healthMutation } from "./hooks";
import { Field, Failure, QueryState, useAction, inputClass as cls } from "./ui";
import { today } from "./time";
import type { Course, DrugOption, Page } from "./types";

export function Courses() {
  const [status, setStatus] = useState("ACTIVE"),
    [page, setPage] = useState(1),
    [adding, setAdding] = useState(false);
  const query = useHealthQuery<Page<Course>>(`/medication-courses?status=${status}&page=${page}`),
    action = useAction();
  const [ending, setEnding] = useState<Course | null>(null);
  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-semibold">Thuốc đang dùng</h2>
        <Button onClick={() => setAdding(true)}>Bắt đầu đợt dùng thuốc</Button>
      </div>
      <p className="my-2 text-sm text-ink-600">
        Chỉ hiển thị thuốc bạn đã chủ động xác nhận. Ghi nhận này không thay thế chỉ định của bác
        sĩ.
      </p>
      <Field label="Lịch sử đợt dùng">
        <select
          className={cls}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ACTIVE">Đang dùng</option>
          <option value="COMPLETED">Đã kết thúc</option>
          <option value="STOPPED">Đã dừng</option>
        </select>
      </Field>
      <QueryState query={query}>
        <ul className="divide-y">
          {query.data?.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1">
                <b>
                  {c.brand_name} {c.strength}
                </b>
                <small className="block">
                  {c.dosage || "Chưa ghi liều"} · {c.frequency || "Chưa ghi tần suất"} ·{" "}
                  {c.start_date} → {c.end_date || "Chưa có ngày kết thúc"}
                </small>
              </span>
              {c.status === "ACTIVE" && (
                <Button variant="secondary" onClick={() => setEnding(c)}>
                  Ghi nhận kết thúc / dừng
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!query.data?.items.length && (
          <p className="my-3">Chưa có đợt dùng thuốc trong nhóm này.</p>
        )}
        {(page > 1 || (query.data?.pagination.total || 0) > 20) && (
          <div className="flex gap-3">
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Trang trước
            </Button>
            <span>Trang {page}</span>
            <Button
              disabled={page * 20 >= (query.data?.pagination.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        )}
      </QueryState>
      {adding && <CourseForm onClose={() => setAdding(false)} />}
      {ending && (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void action.run(async () => {
              await healthMutation(`/medication-courses/${ending.id}`, "PATCH", {
                status: d.get("status"),
                end_date: d.get("end_date"),
              });
              setEnding(null);
            });
          }}
        >
          <p>Ghi nhận kết thúc: {ending.brand_name}</p>
          <Field label="Trạng thái kết thúc">
            <select className={cls} name="status">
              <option value="COMPLETED">Đã kết thúc</option>
              <option value="STOPPED">Đã dừng</option>
            </select>
          </Field>
          <Field label="Ngày kết thúc">
            <input
              required
              className={cls}
              name="end_date"
              type="date"
              min={ending.start_date}
              defaultValue={today()}
            />
          </Field>
          <Button type="submit" loading={action.busy}>
            Xác nhận kết thúc
          </Button>
          <Button
            type="button"
            disabled={action.busy}
            variant="secondary"
            onClick={() => setEnding(null)}
          >
            Hủy
          </Button>
        </form>
      )}
      <Failure error={action.error} />
    </Card>
  );
}
function CourseForm({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState("catalog"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selection, setSelection] = useState<DrugOption | null>(null);
  const options = useHealthQuery<Page<DrugOption>>(
      `/medication-course-options${source === "items" ? "/prescription-items" : ""}?q=${encodeURIComponent(search)}&page=${page}`,
    ),
    action = useAction();
  return (
    <form
      className="mt-5 grid gap-3 rounded-xl border border-line-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selection) return;
        const d = new FormData(e.currentTarget);
        void action.run(async () => {
          await healthMutation("/medication-courses", "POST", {
            ...(selection.prescription_item_id
              ? { prescription_item_id: selection.prescription_item_id }
              : { drug_id: selection.drug_id }),
            dosage: String(d.get("dosage") || "").trim() || null,
            frequency: String(d.get("frequency") || "").trim() || null,
            start_date: d.get("start_date"),
            end_date: d.get("end_date") || null,
          });
          onClose();
        });
      }}
    >
      <Field label="Nguồn chọn thuốc">
        <select
          className={cls}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setSelection(null);
            setPage(1);
          }}
        >
          <option value="catalog">Danh mục thuốc</option>
          <option value="items">Khoản mục đơn đã lưu</option>
        </select>
      </Field>
      <Field label="Tìm tên thuốc">
        <input
          className={cls}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setSelection(null);
          }}
        />
      </Field>
      <QueryState query={options}>
        <div className="grid max-h-60 gap-2 overflow-y-auto">
          {options.data?.items.map((o) => (
            <label key={o.prescription_item_id || o.drug_id} className="flex gap-2 p-2">
              <input
                type="radio"
                name="drug-option"
                checked={selection === o}
                onChange={() => setSelection(o)}
              />
              {o.brand_name} {o.strength}
            </label>
          ))}
        </div>
        {!options.data?.items.length && (
          <p>
            {source === "items"
              ? "Chưa có khoản mục thuộc đơn CONFIRMED và đã nhận diện. Bạn có thể chọn từ danh mục thuốc."
              : "Không có thuốc phù hợp trong danh mục backend."}
          </p>
        )}
        {(page > 1 || (options.data?.pagination.total || 0) > 20) && (
          <div className="flex gap-3">
            <Button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Trang trước
            </Button>
            <Button
              type="button"
              disabled={page * 20 >= (options.data?.pagination.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        )}
      </QueryState>
      {selection && (
        <div key={selection.prescription_item_id || selection.drug_id} className="grid gap-3">
          <p>
            Đã chọn:{" "}
            <b>
              {selection.brand_name} {selection.strength}
            </b>
          </p>
          <Field label="Liều dùng đã được chỉ định">
            <textarea
              className={cls}
              name="dosage"
              maxLength={5000}
              defaultValue={selection.dosage || ""}
            />
          </Field>
          <Field label="Tần suất đã được chỉ định">
            <input
              className={cls}
              name="frequency"
              maxLength={255}
              defaultValue={selection.frequency || ""}
            />
          </Field>
        </div>
      )}
      <Field label="Ngày bắt đầu">
        <input required className={cls} type="date" name="start_date" defaultValue={today()} />
      </Field>
      <Field label="Ngày kết thúc dự kiến (nếu có)">
        <input className={cls} type="date" name="end_date" />
      </Field>
      <label className="flex gap-2">
        <input type="checkbox" required />
        Tôi xác nhận thông tin thuốc và đợt dùng này.
      </label>
      <Failure error={action.error} />
      <Button type="submit" loading={action.busy} disabled={!selection}>
        Xác nhận đang dùng
      </Button>
      <Button type="button" variant="secondary" disabled={action.busy} onClick={onClose}>
        Hủy
      </Button>
    </form>
  );
}
