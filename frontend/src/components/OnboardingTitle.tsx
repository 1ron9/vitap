import { memo, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const HERO_LINES = [
  ["Chào mừng", "đến với VitaP"],
  ["Quét đơn thuốc,", "kiểm tra tương tác"],
  ["Sổ tay", "và trợ lý AI"],
] as const;

const SECTION_LINES: Record<string, readonly [string, string]> = {
  "Giúp mỗi người hiểu rõ thuốc mình đang dùng": ["Giúp mỗi người hiểu rõ", "thuốc mình đang dùng"],
  "Dữ liệu đến từ đâu, hệ thống hoạt động thế nào": [
    "Dữ liệu đến từ đâu,",
    "hệ thống hoạt động thế nào",
  ],
  "Những người đứng sau VitaP": ["Những người", "đứng sau VitaP"],
  "Bắt đầu hiểu đơn thuốc của bạn": ["Bắt đầu hiểu", "đơn thuốc của bạn"],
  "Dùng thử quét đơn thuốc": ["Dùng thử", "quét đơn thuốc"],
};

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+<>/=?@";
const HOLD_MS = 240; // every character cycles at least this long
const STAGGER_MS = 16; // then they lock in left to right
const HOT_MS = 120; // freshly locked characters glow briefly

const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

/**
 * Cycle each character through random glyphs at frame rate, then lock it in.
 * Writes data attributes directly on the DOM so React never re-renders mid-animation;
 * the real characters stay in place (only their fill is hidden), so layout never shifts.
 */
function scramble(root: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-c]"));
  for (const c of cells) c.dataset.g = glyph();
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = now - start;
    let pending = false;
    cells.forEach((c, i) => {
      const end = HOLD_MS + i * STAGGER_MS;
      if (t < end) {
        pending = true;
        c.dataset.g = glyph();
      } else if (t < end + HOT_MS) {
        pending = true;
        delete c.dataset.g;
        c.dataset.hot = "";
      } else {
        delete c.dataset.g;
        delete c.dataset.hot;
      }
    });
    if (pending) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    for (const c of cells) {
      delete c.dataset.g;
      delete c.dataset.hot;
    }
  };
}

export const OnboardingTitle = memo(function OnboardingTitle({
  slide,
  text,
  active = true,
  tone,
  className,
}: {
  slide?: number;
  text?: string;
  /** Replays the scramble each time this turns true (e.g. the page comes into view). */
  active?: boolean;
  /** "inverse" for titles on a solid brand background. */
  tone?: "inverse";
  className?: string;
}) {
  const lines: readonly string[] =
    slide !== undefined ? HERO_LINES[slide] : (SECTION_LINES[text!] ?? [text ?? ""]);
  const key = lines.join("|");
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    return scramble(ref.current);
  }, [key, active]);

  return (
    <span className={cn("onboarding-title", className)} data-tone={tone}>
      <span className="sr-only">{lines.join(" ")}</span>
      <span ref={ref} aria-hidden>
        {lines.map((line, i) => (
          <span key={`${key}-${i}`} className="onboarding-title-line">
            {Array.from(line.normalize("NFC")).map((ch, j) =>
              ch === " " ? (
                " "
              ) : (
                <span key={j} data-c>
                  {ch}
                </span>
              ),
            )}
          </span>
        ))}
      </span>
    </span>
  );
});
