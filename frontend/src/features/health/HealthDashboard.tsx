import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader, Skeleton } from "@/components/ui";
import { Field, HealthGate, QueryState, inputClass } from "./ui";
import { useHealthQuery } from "./hooks";
import {
  chartPoints,
  dashboardBounds,
  loadObservationSeries,
  observationsPath,
  presetRange,
  readingText,
  type Preset,
} from "./dashboard-data";
import { metrics } from "./metrics";
import { displayTime } from "./time";
import type { Metric, RawObservation } from "./types";

const ObservationChart = lazy(() => import("./ObservationChart"));
const presets = { day: "Ngày", week: "Tuần", month: "Tháng", custom: "Tùy chọn" } as const;
const TABLE_PAGE_SIZE = 50;

function ReadingsTable({ items }: { items: RawObservation[] }) {
  const [page, setPage] = useState(1);
  const start = (page - 1) * TABLE_PAGE_SIZE;
  return (
    <div className="mt-5">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng số đo gốc">
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold">Bảng số đo gốc</caption>
          <thead>
            <tr className="border-b border-line-200">
              <th scope="col" className="p-2">
                Thời điểm đo
              </th>
              <th scope="col" className="p-2">
                Giá trị
              </th>
              <th scope="col" className="p-2">
                Ghi chép
              </th>
            </tr>
          </thead>
          <tbody>
            {items.slice(start, start + TABLE_PAGE_SIZE).map((reading) => (
              <tr key={reading.id} className="border-b border-line-200">
                <td className="p-2">
                  <time dateTime={reading.measured_at}>{displayTime(reading.measured_at)}</time>
                </td>
                <td className="p-2">{readingText(reading)}</td>
                <td className="p-2">
                  <Link
                    className="text-brand-600 underline"
                    to={`/journal?entry=${encodeURIComponent(reading.entry_id)}`}
                  >
                    Mở ghi chép
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > TABLE_PAGE_SIZE && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setPage(page - 1)} disabled={page === 1}>
            Trang trước
          </Button>
          <span role="status">
            {start + 1}–{Math.min(start + TABLE_PAGE_SIZE, items.length)} / {items.length}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage(page + 1)}
            disabled={start + TABLE_PAGE_SIZE >= items.length}
          >
            Trang sau
          </Button>
        </div>
      )}
    </div>
  );
}

function DashboardMeasurements({
  items,
  metric,
  bounds,
  singleDay,
}: {
  items: RawObservation[];
  metric: Metric;
  bounds: { from: string; to: string };
  singleDay: boolean;
}) {
  const points = useMemo(() => chartPoints(items, metric), [items, metric]);
  const { name, unit } = { name: metrics[metric].label, unit: metrics[metric].unit };
  if (!items.length)
    return (
      <Card className="p-5">
        <p>Chưa có số đo {name.toLowerCase()} trong khoảng này.</p>
        <Link className="text-brand-600 underline" to="/journal">
          Mở Sổ tay
        </Link>
      </Card>
    );
  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold">
        {name} ({unit})
      </h2>
      <p className="mb-3 text-sm text-ink-600">{items.length} lần đo</p>
      {points.primary.length > 0 && (
        <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
          <ObservationChart
            {...points}
            label={name}
            unit={unit}
            bloodPressure={metric === "BLOOD_PRESSURE"}
            timeDomain={[Date.parse(bounds.from), Date.parse(bounds.to)]}
            singleDay={singleDay}
          />
        </Suspense>
      )}
      {points.excluded > 0 && (
        <p className="mt-3 text-sm text-ink-600">
          {points.excluded} số đo không thể vẽ theo trục {unit}. Bảng bên dưới vẫn giữ các giá trị
          và đơn vị gốc.
        </p>
      )}
      <ReadingsTable items={items} />
    </Card>
  );
}

function HealthDashboardContent() {
  const [metric, setMetric] = useState<Metric>("BLOOD_PRESSURE");
  const [preset, setPreset] = useState<Preset | "custom">("week");
  const [range, setRange] = useState(() => presetRange("week"));
  const bounds = dashboardBounds(range);
  const path = bounds ? observationsPath(metric, bounds) : null;
  const query = useHealthQuery(path, loadObservationSeries);

  return (
    <>
      <PageHeader title="Tổng quan" sub="Số đo gốc từ Sổ tay theo giờ Việt Nam" />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Chỉ số">
          <select
            aria-label="Chỉ số"
            className={inputClass}
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {Object.entries(metrics).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Khoảng thời gian">
          <select
            aria-label="Khoảng thời gian"
            className={inputClass}
            value={preset}
            onChange={(e) => {
              const next = e.target.value as Preset | "custom";
              setPreset(next);
              if (next !== "custom") setRange(presetRange(next));
            }}
          >
            {Object.entries(presets).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Từ ngày">
          <input
            className={inputClass}
            type="date"
            value={range.from}
            onChange={(e) => {
              setPreset("custom");
              setRange({ ...range, from: e.target.value });
            }}
          />
        </Field>
        <Field label="Đến ngày (bao gồm)">
          <input
            className={inputClass}
            type="date"
            value={range.to}
            onChange={(e) => {
              setPreset("custom");
              setRange({ ...range, to: e.target.value });
            }}
          />
        </Field>
      </Card>
      {!bounds ? (
        <p role="alert">Chọn đủ ngày bắt đầu và kết thúc, theo thứ tự và trong tối đa 366 ngày.</p>
      ) : query.loading ? (
        <div role="status">
          <span className="sr-only">Đang tải số đo…</span>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <QueryState query={query}>
          {query.data && (
            <DashboardMeasurements
              key={path}
              items={query.data}
              metric={metric}
              bounds={bounds}
              singleDay={range.from === range.to}
            />
          )}
        </QueryState>
      )}
    </>
  );
}

export function HealthDashboard() {
  return (
    <HealthGate>
      <HealthDashboardContent />
    </HealthGate>
  );
}
