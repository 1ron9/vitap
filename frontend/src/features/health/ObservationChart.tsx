import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { displayTime } from "./time";
import { readingText, type ChartPoint } from "./dashboard-data";

const chartDay = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
});
const chartHour = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
});
const chartValue = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });

export default function ObservationChart({
  primary,
  secondary,
  domain,
  timeDomain,
  unit,
  label,
  bloodPressure,
  singleDay,
}: {
  primary: ChartPoint[];
  secondary: ChartPoint[];
  domain: [number, number];
  timeDomain: [number, number];
  unit: string;
  label: string;
  bloodPressure: boolean;
  singleDay: boolean;
}) {
  return (
    <figure aria-label={`Biểu đồ ${label} (${unit})`} className="min-w-0">
      <ResponsiveContainer width="100%" height={280} minWidth={0}>
        <ScatterChart margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line-200)" />
          <XAxis
            type="number"
            dataKey="time"
            name="Thời điểm đo"
            domain={timeDomain}
            allowDataOverflow
            tickFormatter={(time: number) => (singleDay ? chartHour : chartDay).format(time)}
            tick={{ fill: "var(--color-ink-600)", fontSize: 11 }}
            minTickGap={20}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={domain}
            width={55}
            tick={{ fill: "var(--color-ink-600)", fontSize: 11 }}
            tickFormatter={(value: number) => chartValue.format(value)}
          />
          {bloodPressure && <Legend />}
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ChartPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-lg border border-line-200 bg-surface p-3 text-sm shadow-sm">
                  <p>{displayTime(point.reading.measured_at)}</p>
                  <p className="font-semibold">{readingText(point.reading)}</p>
                </div>
              );
            }}
          />
          <Scatter
            name={bloodPressure ? "Tâm thu" : label}
            data={primary}
            fill="var(--color-chart-1)"
            isAnimationActive={false}
          />
          {bloodPressure && (
            <Scatter
              name="Tâm trương"
              data={secondary}
              shape="diamond"
              fill="var(--color-chart-3)"
              isAnimationActive={false}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      <figcaption className="text-xs text-ink-600">
        Mỗi điểm là một lần đo tại giờ Việt Nam. Các lần đo trùng giờ có thể chồng lên nhau, xem
        từng lần trong bảng bên dưới.
      </figcaption>
    </figure>
  );
}
