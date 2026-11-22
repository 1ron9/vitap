import { useState, type FormEvent } from "react";
import { Card, Button, PageHeader } from "@/components/ui";
import { useHealthQuery, healthMutation } from "./hooks";
import { Field, Failure, QueryState, useAction, inputClass as cls, HealthGate } from "./ui";
import type { Profile, Condition, Allergy, Preferences, Declaration, Page } from "./types";
import { today } from "./time";
import { Courses } from "./courses";
import { authApi } from "@/api/client";
import { useApp } from "@/app/state";

function dataOf(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
}
const nullable = (x: string) => x.trim() || null;
const sexLabels: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
  UNKNOWN: "Không rõ",
};

function PersonalProfile() {
  const query = useHealthQuery<Profile>("/profile"),
    action = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
      <QueryState query={query}>
        {query.data &&
          (editing ? (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                const d = dataOf(event);
                void action.run(async () => {
                  await healthMutation("/profile", "PATCH", {
                    full_name: nullable(d.full_name),
                    date_of_birth: nullable(d.date_of_birth),
                    biological_sex: nullable(d.biological_sex),
                    phone: nullable(d.phone),
                    height_cm: d.height_cm ? Number(d.height_cm) : null,
                  });
                  setEditing(false);
                });
              }}
            >
              <Field label="Họ tên">
                <input
                  className={cls}
                  name="full_name"
                  maxLength={255}
                  defaultValue={query.data.full_name || ""}
                />
              </Field>
              <Field label="Ngày sinh">
                <input
                  className={cls}
                  name="date_of_birth"
                  type="date"
                  max={today()}
                  defaultValue={query.data.date_of_birth || ""}
                />
              </Field>
              <Field label="Giới tính">
                <select
                  className={cls}
                  name="biological_sex"
                  defaultValue={query.data.biological_sex || ""}
                >
                  <option value="">Chưa khai báo</option>
                  {["MALE", "FEMALE", "OTHER", "UNKNOWN"].map((x, i) => (
                    <option key={x} value={x}>
                      {["Nam", "Nữ", "Khác", "Không rõ"][i]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Số điện thoại">
                <input
                  className={cls}
                  name="phone"
                  maxLength={30}
                  defaultValue={query.data.phone || ""}
                />
              </Field>
              <Field label="Chiều cao (cm)">
                <input
                  className={cls}
                  name="height_cm"
                  type="number"
                  min="0.01"
                  max="999.99"
                  step="0.01"
                  defaultValue={query.data.height_cm ?? ""}
                />
              </Field>
              <Failure error={action.error} />
              <div className="flex gap-2">
                <Button type="submit" loading={action.busy}>
                  Lưu thông tin
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={action.busy}
                  onClick={() => setEditing(false)}
                >
                  Hủy
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-3 space-y-2">
              <p>{query.data.full_name || "Chưa cập nhật họ tên"}</p>
              <p>
                Ngày sinh: {query.data.date_of_birth || "—"} · Giới tính:{" "}
                {sexLabels[query.data.biological_sex || ""] || "—"}
              </p>
              <p>
                Số điện thoại: {query.data.phone || "—"} · Chiều cao: {query.data.height_cm ?? "—"}{" "}
                cm
              </p>
              <Button onClick={() => setEditing(true)}>Chỉnh sửa thông tin cá nhân</Button>
            </div>
          ))}
      </QueryState>
    </Card>
  );
}

function Conditions() {
  const [page, setPage] = useState(1),
    query = useHealthQuery<Page<Condition>>(`/conditions?page=${page}`),
    action = useAction();
  const [edit, setEdit] = useState<Condition | "new" | null>(null),
    [deleting, setDeleting] = useState<string | null>(null);
  const item = edit && edit !== "new" ? edit : null;
  return (
    <Card className="p-5">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Bệnh nền</h2>
        <Button onClick={() => setEdit("new")}>Thêm bệnh nền</Button>
      </div>
      <QueryState query={query}>
        <ul className="divide-y">
          {query.data?.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1">
                <b>{c.condition_name}</b> · {c.status}
                <small className="block">
                  {c.description} ·{" "}
                  {c.verified ? "Có cờ xác minh từ nguồn lưu trữ" : "Tự khai báo · chưa xác minh"}
                </small>
              </span>
              <Button variant="secondary" onClick={() => setEdit(c)}>
                Sửa
              </Button>
              <Button variant="secondary" onClick={() => setDeleting(c.id)}>
                Xóa
              </Button>
            </li>
          ))}
        </ul>
        {query.data?.items.length === 0 && <p className="py-3">Chưa khai báo bệnh nền.</p>}
        <Pager page={page} total={query.data?.pagination.total || 0} setPage={setPage} />
      </QueryState>
      {edit && (
        <form
          key={item?.id || "new"}
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            const d = dataOf(e);
            void action.run(async () => {
              await healthMutation(
                `/conditions${item ? `/${item.id}` : ""}`,
                item ? "PATCH" : "POST",
                {
                  condition_name: d.condition_name,
                  status: d.status,
                  diagnosed_at: nullable(d.diagnosed_at),
                  icd10_code: nullable(d.icd10_code),
                  description: nullable(d.description),
                },
              );
              setEdit(null);
            });
          }}
        >
          <Field label="Tên bệnh nền">
            <input
              autoFocus
              className={cls}
              name="condition_name"
              required
              maxLength={255}
              defaultValue={item?.condition_name}
            />
          </Field>
          <Field label="Trạng thái bệnh nền">
            <select className={cls} name="status" defaultValue={item?.status || "ACTIVE"}>
              {["ACTIVE", "RESOLVED", "CHRONIC"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Ngày chẩn đoán">
            <input
              className={cls}
              type="date"
              max={today()}
              name="diagnosed_at"
              defaultValue={item?.diagnosed_at || ""}
            />
          </Field>
          <Field label="Mã ICD-10 (nếu có)">
            <input
              className={cls}
              name="icd10_code"
              maxLength={20}
              defaultValue={item?.icd10_code || ""}
            />
          </Field>
          <Field label="Ghi chú bệnh nền">
            <textarea
              className={cls}
              name="description"
              maxLength={5000}
              defaultValue={item?.description || ""}
            />
          </Field>
          <Button type="submit" loading={action.busy}>
            Lưu bệnh nền
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy}
            onClick={() => setEdit(null)}
          >
            Hủy
          </Button>
        </form>
      )}
      {deleting && (
        <div role="alertdialog" aria-label="Xác nhận xóa bệnh nền" className="mt-3 space-x-2">
          <p>Xóa bệnh nền này?</p>
          <Button
            loading={action.busy}
            onClick={() =>
              void action.run(async () => {
                await healthMutation(`/conditions/${deleting}`, "DELETE");
                setDeleting(null);
              })
            }
          >
            Xác nhận xóa
          </Button>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Hủy
          </Button>
        </div>
      )}
      <Failure error={action.error} />
    </Card>
  );
}

function Allergies() {
  const [page, setPage] = useState(1),
    query = useHealthQuery<Page<Allergy>>(`/allergies?page=${page}`),
    declaration = useHealthQuery<Declaration>("/allergy-declaration"),
    action = useAction();
  const [edit, setEdit] = useState<Allergy | "new" | null>(null),
    [deleting, setDeleting] = useState<string | null>(null);
  const item = edit && edit !== "new" ? edit : null;
  return (
    <Card className="p-5">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Dị ứng</h2>
        <Button onClick={() => setEdit("new")}>Thêm dị ứng</Button>
      </div>
      <QueryState query={declaration}>
        <p className="my-3">
          {declaration.data?.state === "NO_KNOWN_ALLERGIES"
            ? "Bạn đã xác nhận không có dị ứng nào đã biết."
            : declaration.data?.state === "HAS_ALLERGIES"
              ? "Có dị ứng đã khai báo."
              : "Chưa khai báo tình trạng dị ứng."}
        </p>
        {declaration.data && declaration.data.state !== "HAS_ALLERGIES" && (
          <Button
            disabled={action.busy}
            variant="secondary"
            onClick={() =>
              void action.run(async () => {
                await healthMutation("/allergy-declaration", "PUT", {
                  state: declaration.data?.state === "UNKNOWN" ? "NO_KNOWN_ALLERGIES" : "UNKNOWN",
                });
              })
            }
          >
            {declaration.data.state === "UNKNOWN"
              ? "Xác nhận không có dị ứng đã biết"
              : "Bỏ xác nhận"}
          </Button>
        )}
      </QueryState>
      <QueryState query={query}>
        <ul className="divide-y">
          {query.data?.items.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-3 py-3">
              <span className="flex-1">
                <b>{a.allergen_name}</b> · {a.allergen_type || "Chưa phân loại"}
                <small className="block">
                  Phản ứng: {a.reaction || "Không rõ"} · {a.severity || "Chưa rõ mức độ"} ·{" "}
                  {a.verified ? "Có cờ xác minh từ nguồn lưu trữ" : "Tự khai báo · chưa xác minh"}
                </small>
              </span>
              <Button variant="secondary" onClick={() => setEdit(a)}>
                Sửa
              </Button>
              <Button variant="secondary" onClick={() => setDeleting(a.id)}>
                Xóa
              </Button>
            </li>
          ))}
        </ul>
        <Pager page={page} total={query.data?.pagination.total || 0} setPage={setPage} />
      </QueryState>
      {edit && (
        <form
          key={item?.id || "new"}
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            const d = dataOf(e);
            void action.run(async () => {
              await healthMutation(
                `/allergies${item ? `/${item.id}` : ""}`,
                item ? "PATCH" : "POST",
                {
                  allergen_name: d.allergen_name,
                  allergen_type: d.allergen_type,
                  reaction: nullable(d.reaction),
                  severity: nullable(d.severity),
                  ingredient_id:
                    item?.ingredient_id && d.allergen_name === item.allergen_name
                      ? item.ingredient_id
                      : null,
                },
              );
              setEdit(null);
            });
          }}
        >
          <Field label="Tên chất gây dị ứng">
            <input
              autoFocus
              className={cls}
              name="allergen_name"
              required
              maxLength={255}
              defaultValue={item?.allergen_name}
            />
          </Field>
          <Field label="Loại dị ứng">
            <select
              className={cls}
              name="allergen_type"
              required
              defaultValue={item ? item.allergen_type || "" : "DRUG"}
            >
              <option value="" disabled>
                Chọn loại dị ứng
              </option>
              {["DRUG", "FOOD", "OTHER"].map((x, i) => (
                <option key={x} value={x}>
                  {["Thuốc", "Thực phẩm", "Khác"][i]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phản ứng đã gặp">
            <textarea
              className={cls}
              name="reaction"
              maxLength={5000}
              defaultValue={item?.reaction || ""}
            />
          </Field>
          <Field label="Mức độ dị ứng">
            <select className={cls} name="severity" defaultValue={item?.severity || ""}>
              <option value="">Không rõ</option>
              {["MILD", "MODERATE", "SEVERE"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" loading={action.busy}>
            Lưu dị ứng
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy}
            onClick={() => setEdit(null)}
          >
            Hủy
          </Button>
        </form>
      )}
      {deleting && (
        <div role="alertdialog" aria-label="Xác nhận xóa dị ứng">
          <p>Xóa dị ứng này?</p>
          <Button
            loading={action.busy}
            onClick={() =>
              void action.run(async () => {
                await healthMutation(`/allergies/${deleting}`, "DELETE");
                setDeleting(null);
              })
            }
          >
            Xác nhận xóa
          </Button>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Hủy
          </Button>
        </div>
      )}
      <Failure error={action.error} />
    </Card>
  );
}

function HealthPreferences() {
  const query = useHealthQuery<Preferences>("/preferences"),
    action = useAction();
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Quyền sử dụng hồ sơ</h2>
      <QueryState query={query}>
        {query.data &&
          (["allow_ai_health_context", "enable_allergy_alerts"] as const).map((key, i) => (
            <label key={key} className="my-4 flex items-center justify-between gap-4">
              {["Cho Trợ lý AI dùng hồ sơ này", "Cảnh báo xung đột dị ứng"][i]}
              <input
                type="checkbox"
                role="switch"
                checked={query.data![key]}
                disabled={action.busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void action.run(async () => {
                    await healthMutation("/preferences", "PATCH", { [key]: checked });
                  });
                }}
              />
            </label>
          ))}
      </QueryState>
      <p className="text-sm text-ink-600">
        Bạn có thể thay đổi quyền sử dụng hồ sơ và cảnh báo dị ứng bất cứ lúc nào.
      </p>
      <Failure error={action.error} />
    </Card>
  );
}
export function Pager({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (x: number) => void;
}) {
  return total > 20 || page > 1 ? (
    <div className="my-3 flex items-center gap-3">
      <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
        Trang trước
      </Button>
      <span>
        Trang {page} · {total} bản ghi
      </span>
      <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
        Trang sau
      </Button>
    </div>
  ) : null;
}
export function RealProfile() {
  const { go, setGuest } = useApp(),
    action = useAction();
  return (
    <HealthGate>
      <PageHeader title="Hồ sơ sức khỏe" sub="Dữ liệu được lưu trong tài khoản của bạn" />
      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalProfile />
        <HealthPreferences />
        <Conditions />
        <Allergies />
        <Courses />
      </div>
      <div className="my-5">
        <Button
          variant="secondary"
          loading={action.busy}
          onClick={() =>
            void action.run(async () => {
              await authApi.logout();
              setGuest(true);
              go("onboarding");
            })
          }
        >
          Đăng xuất
        </Button>
        <Failure error={action.error} />
      </div>
    </HealthGate>
  );
}
