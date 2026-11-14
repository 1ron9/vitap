import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, ScanLine, Search } from "lucide-react";
import { useApp } from "@/app/state";
import type { Route } from "@/app/variants";
import { SCREEN_LABEL } from "@/app/variants";
import { BackButton, Button, Modal, PageHeader } from "@/components/ui";
import { OCR_ROWS, PRESCRIPTIONS, RESULT_SCENARIOS, type ResultDrug, rxByScenario, useDataSafe } from "@/data/db";
import type { DrugRow } from "@/data/drugs";
import { cn } from "@/lib/cn";
import { Confirm } from "./Confirm";
import { Lookup, LOOKUP_PRESETS } from "./Lookup";
import { emptyRow, ocrResult } from "./model";
import type { PaperLine } from "./Prescription";
import { Result } from "./Result";
import { Processing, Upload } from "./Upload";

type Step3 = {
  step: 3;
  rows: DrugRow[];
  lines: PaperLine[];
  manual: boolean;
  saveFailed?: boolean;
};
export type ScanState =
  | { step: 1; error?: "invalid" | "expired" }
  | { step: 2; phase: "running" | "slow" | "failed"; image?: string }
  | Step3
  | { step: 4; drugs: ResultDrug[]; prev?: Step3; rxId?: string };

/** Rebuild editable rows from a saved result so "Quay lại chỉnh sửa" works for history items too. */
function rowsFromDrugs(drugs: ResultDrug[]): Step3 {
  const rows = drugs.map((d) => {
    const ocr = Object.values(OCR_ROWS).find((r) => r.name === d.name);
    return {
      ...(ocr ?? emptyRow()),
      ...(ocr ? {} : { name: d.name, strength: d.strength }),
      id: `r-${d.name}`,
      line: -1,
      unresolved: d.unresolved,
      verified: true,
      confirmed: [],
      conf: {},
    };
  });
  return { step: 3, rows, lines: [], manual: true };
}

function resolveTargetPrescription(
  target: string | undefined,
  prescriptions: Array<{ id: string; scenario?: string; drugs: ResultDrug[] }>,
): { drugs: ResultDrug[]; rxId?: string } | null {
  if (!target) return null;
  const rx =
    prescriptions.find((p) => p.id === target || p.scenario === target) ??
    PRESCRIPTIONS.find((p) => p.id === target || p.scenario === target);
  if (rx) {
    return { drugs: rx.drugs, rxId: rx.id };
  }
  if (RESULT_SCENARIOS[target]) {
    return { drugs: RESULT_SCENARIOS[target], rxId: rxByScenario(target)?.id };
  }
  return null;
}

const STEPS = ["Tải ảnh", "Đọc đơn", "Xác nhận", "Kết quả"];
type Mode = "scan" | "lookup";

export function Scan() {
  return <ScanInner />;
}

/** The scan flow for embedding in the public Onboarding page. Allows switching to lookup when allowLookup is true. */
export function ScanFlow({ allowLookup = true }: { allowLookup?: boolean } = {}) {
  return <ScanInner embedded allowLookup={allowLookup} />;
}

function ScanInner({
  embedded = false,
  allowLookup = false,
}: {
  embedded?: boolean;
  allowLookup?: boolean;
}) {
  const { origin, go, variant } = useApp();
  const location = useLocation();
  const locState = (location.state as { from?: Route; target?: string; rxId?: string; scenario?: string } | null) ?? null;
  const data = useDataSafe();
  const prescriptions = data?.prescriptions ?? [];

  const [mode, setMode] = useState<Mode>("scan");
  const targetId = locState?.target || locState?.rxId || locState?.scenario || (!embedded ? variant("scan") : undefined);
  const initialResolved = resolveTargetPrescription(targetId, prescriptions);
  const [s, setS] = useState<ScanState>(
    initialResolved ? { step: 4, drugs: initialResolved.drugs, rxId: initialResolved.rxId } : { step: 1 }
  );

  useEffect(() => {
    const currentTarget = locState?.target || locState?.rxId || locState?.scenario;
    if (currentTarget) {
      const resolved = resolveTargetPrescription(currentTarget, prescriptions);
      if (resolved) {
        setS({ step: 4, drugs: resolved.drugs, rxId: resolved.rxId });
      }
    }
  }, [locState?.target, locState?.rxId, locState?.scenario, prescriptions]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveId = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const top = useRef<HTMLDivElement>(null);

  const set = (n: ScanState) => {
    setS(n);
    // Embedded in Onboarding, the page scrolls inside its own container rather than the window.
    const scroller = embedded ? top.current?.closest<HTMLElement>("[data-scroll]") : null;
    if (scroller) scroller.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  };

  // Leaving step 3 discards edits, so ask first when there is something to lose.
  const backFromConfirm = () => {
    if (s.step !== 3) return;
    const touched =
      s.rows.some((r) => r.name || r.strength) &&
      (s.manual ? true : s.rows.some((r) => r.verified || r.confirmed.length > 0 || r.marked));
    if (touched) setConfirmLeave(true);
    else set({ step: 1 });
  };

  const fromHistory = !embedded && s.step === 4 && !s.prev && origin && origin !== "scan";

  const modes: { id: Mode; label: string; icon: typeof ScanLine }[] = [
    { id: "scan", label: "Quét đơn", icon: ScanLine },
    { id: "lookup", label: "Tra cứu tương tác", icon: Search },
  ];

  // From step 2 on, the intro is collapsed so the flow itself gets the space.
  const compact = mode === "scan" && s.step > 1;

  return (
    <div ref={top}>
      {!embedded && (
        compact ? (
          <h1 className="mb-4 text-base font-semibold text-ink-900">
            Quét đơn · Bước <span className="font-mono">{s.step}/4</span>
          </h1>
        ) : (
          <PageHeader
            title="Kiểm tra thuốc"
            sub={
              mode === "scan"
                ? "Đọc đơn thuốc từ ảnh và kiểm tra tương tác giữa các thuốc"
                : "Nhập tên thuốc và hàm lượng để kiểm tra tương tác, không cần ảnh đơn"
            }
          />
        )
      )}

      {(!embedded || allowLookup) && (
        <div
          role="tablist"
          aria-label="Chế độ"
          className="mb-6 inline-flex max-w-full gap-1 rounded-xl border border-line-200 bg-line-100 p-1"
        >
          {modes.map((m, i) => {
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                id={`tab-${m.id}`}
                aria-selected={selected}
                aria-controls={`panel-${m.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setMode(m.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    const n = (i + 1) % 2;
                    setMode(modes[n].id);
                    tabs.current[n]?.focus();
                  }
                }}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap transition-colors duration-150 sm:px-4",
                  selected
                    ? "bg-brand-600 text-white shadow-e1"
                    : "text-ink-600 hover:bg-surface hover:text-ink-900",
                )}
              >
                <m.icon size={18} aria-hidden />
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {(!embedded || allowLookup) && (
        <div
          id="panel-lookup"
          role="tabpanel"
          aria-labelledby="tab-lookup"
          hidden={mode !== "lookup"}
        >
          <Lookup preset={LOOKUP_PRESETS.lookup} />
        </div>
      )}

      <div
        id="panel-scan"
        role={embedded && !allowLookup ? undefined : "tabpanel"}
        aria-labelledby={embedded && !allowLookup ? undefined : "tab-scan"}
        hidden={mode !== "scan"}
      >
        <Stepper current={s.step} />
        <div className="mt-6">
          {s.step === 1 && (
            <Upload
              error={s.error}
              onImage={(image) => set({ step: 2, phase: "running", image })}
              onManual={() => set({ step: 3, rows: [emptyRow()], lines: [], manual: true })}
              onError={(error) => set({ step: 1, error })}
              onSelectRx={(rx) => set({ step: 4, drugs: rx.drugs, rxId: rx.id })}
            />
          )}
          {s.step === 2 && (
            <>
              <BackButton onClick={() => set({ step: 1 })} className="mb-3">
                Hủy và chọn ảnh khác
              </BackButton>
              <Processing
                key={s.phase}
                phase={s.phase}
                image={s.image}
                onDone={() => set({ step: 3, ...ocrResult("mixed"), manual: false })}
                onSlow={() => setS({ ...s, phase: "slow" })}
                onRetake={() => set({ step: 1 })}
                onManual={() => set({ step: 3, rows: [emptyRow()], lines: [], manual: true })}
              />
            </>
          )}
          {s.step === 3 && (
            <>
              <BackButton onClick={backFromConfirm} className="mb-3">
                {s.manual ? "Quay lại tải ảnh" : "Quay lại, chụp ảnh khác"}
              </BackButton>
              <Confirm
                state={s}
                onChange={(rows) => setS({ ...s, rows })}
                onSaveFailed={(saveFailed) => setS({ ...s, saveFailed })}
                onDone={(drugs) => set({ step: 4, drugs, prev: { ...s, saveFailed: false } })}
                embedded={embedded}
              />
            </>
          )}
          {s.step === 4 && (
            <Result
              drugs={s.drugs}
              rxId={s.rxId}
              backLabel={
                fromHistory
                  ? `Quay lại ${SCREEN_LABEL[origin!]}`
                  : "Quay lại chỉnh sửa danh sách thuốc"
              }
              onBack={() => (fromHistory ? go(origin!) : set(s.prev ?? rowsFromDrugs(s.drugs)))}
              onFix={() => set(s.prev ?? { step: 3, ...ocrResult("unresolved"), manual: false })}
              onRestart={() => set({ step: 1 })}
            />
          )}
        </div>
      </div>

      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        labelledBy={leaveId}
        width={400}
        role="alertdialog"
      >
        <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
          <h2 id={leaveId} className="text-lg font-semibold text-ink-900">
            Bỏ danh sách thuốc đang sửa?
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Những chỉnh sửa và mục đã đối chiếu sẽ không được giữ lại.
          </p>
          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmLeave(false)}
              data-autofocus
            >
              Ở lại
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setConfirmLeave(false);
                set({ step: 1 });
              }}
            >
              Bỏ và quay lại
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <>
      <p className="mb-2 text-sm sm:hidden" aria-hidden>
        <span className="font-mono text-ink-600">Bước {current}/4</span> ·{" "}
        <span className="font-semibold text-ink-900">{STEPS[current - 1]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-2" aria-label="Các bước quét đơn">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="min-w-0">
              <div
                className={cn("h-1 rounded-full", done || active ? "bg-brand-600" : "bg-line-200")}
                aria-hidden
              />
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-semibold",
                    active
                      ? "bg-brand-600 text-white"
                      : done
                        ? "bg-brand-50 text-brand-ink"
                        : "bg-line-100 text-ink-600",
                  )}
                >
                  {done ? <Check size={14} strokeWidth={2.5} aria-hidden /> : n}
                </span>
                <span
                  className={cn(
                    "truncate text-sm max-sm:sr-only",
                    active ? "font-semibold text-ink-900" : done ? "text-ink-900" : "text-ink-600",
                  )}
                >
                  {label}
                </span>
                <span className="sr-only">
                  {done ? "(đã xong)" : active ? "(đang thực hiện)" : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
