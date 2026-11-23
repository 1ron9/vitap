import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsBucket } from "./types";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });

export default function AnalyticsChart({
  buckets,
  label,
  unit,
  bloodPressure,
}: {
  buckets: AnalyticsBucket[];
  label: string;
  unit: string;
  bloodPressure: boolean;
}) {
  return (
    <figure aria-label={`Biểu đồ trung bình ${label} (${unit})`} className="min-w-0">
      <ResponsiveContainer width="100%" height={280} minWidth={0}>
        <LineChart data={buckets} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line-200)" />
          <XAxis
            dataKey="period_start"
            tick={{ fill: "var(--color-ink-600)", fontSize: 11 }}
            minTickGap={20}
          />
          <YAxis
            width={55}
            tick={{ fill: "var(--color-ink-600)", fontSize: 11 }}
            tickFormatter={(x: number) => number.format(x)}
          />
          <Legend />
          <Tooltip
            content={({ active, payload }) => {
              const bucket = payload?.[0]?.payload as AnalyticsBucket | undefined;
              if (!active || !bucket) return null;
              return (
                <div className="rounded-lg border border-line-200 bg-surface p-3 text-sm shadow-sm">
                  <p>
                    {bucket.period_start} đến {bucket.period_end} (không gồm ngày cuối)
                  </p>
                  <p>{bucket.count} lần đo</p>
                  <p>
                    Trung bình:{" "}
                    {bucket.average === null ? "—" : `${number.format(bucket.average)} ${unit}`}
                  </p>
                  {bloodPressure && (
                    <p>
                      Tâm trương:{" "}
                      {bucket.secondary_average === null
                        ? "—"
                        : `${number.format(bucket.secondary_average)} ${unit}`}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Line
            name={bloodPressure ? "Tâm thu trung bình" : `${label} trung bình`}
            type="linear"
            dataKey="average"
            connectNulls={false}
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          {bloodPressure && (
            <Line
              name="Tâm trương trung bình"
              type="linear"
              dataKey="secondary_average"
              connectNulls={false}
              stroke="var(--color-chart-3)"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="text-xs text-ink-600">
        Mỗi điểm là trung bình của các lần đo trong một khoảng lịch. Khoảng không có dữ liệu không
        được nối thành số đo.
      </figcaption>
    </figure>
  );
}
