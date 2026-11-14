import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useId,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Database,
  Eye,
  FileCheck2,
  HeartHandshake,
  House,
  Languages,
  Lock,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Quote,
  ScanLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useApp } from "@/app/state";
import { Mark, SocialIcon, Wordmark } from "@/components/brand";
import { LowConfTag, STATUS_NOTE, StatusPill } from "@/components/status";
import { fmtDayMonth, JOURNAL_SEED, latestWith, SAMPLE_RX } from "@/data/db";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingTitle } from "@/components/OnboardingTitle";
import { Button, Mono } from "@/components/ui";
import { ScanFlow } from "@/screens/scan/Scan";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const SLIDES = [
  {
    title: "Chào mừng đến với VitaP",
    sub: "Hiểu đơn thuốc của bạn rõ hơn, theo dõi sức khỏe mỗi ngày.",
    points: [
      {
        icon: ScanLine,
        t: "Đọc đơn thuốc từ ảnh chụp",
        d: "Chụp đơn giấy, VitaP tách tên thuốc, hàm lượng và liều dùng.",
      },
      {
        icon: FileCheck2,
        t: "Kiểm tra tương tác giữa các thuốc",
        d: "Đối chiếu từng cặp thuốc với cơ sở dữ liệu có nguồn dẫn.",
      },
      {
        icon: MessageSquareText,
        t: "Sổ tay sức khỏe và trợ lý AI",
        d: "Ghi lại chỉ số, xem xu hướng, hỏi đáp kèm trích dẫn.",
      },
    ],
  },
  {
    title: "Quét đơn thuốc, kiểm tra tương tác",
    sub: "VitaP đọc đơn từ ảnh và đối chiếu với cơ sở dữ liệu thuốc có nguồn dẫn.",
    points: [
      {
        icon: Eye,
        t: "Chỗ nào chưa chắc, bạn sẽ thấy ngay",
        d: "Ô có độ tin cậy dưới 80% được tô cam để bạn so với ảnh gốc.",
      },
      {
        icon: ShieldCheck,
        t: "Không bao giờ nói “an toàn”",
        d: "Không thấy tương tác thì chỉ ghi “chưa ghi nhận trong cơ sở dữ liệu”.",
      },
      {
        icon: BookOpen,
        t: "Mỗi kết quả đều có nguồn",
        d: "Tên nguồn và phiên bản dữ liệu luôn hiện cạnh kết quả.",
      },
    ],
  },
  {
    title: "Sổ tay và trợ lý AI",
    sub: "Ghi lại chỉ số sức khỏe và hỏi đáp có dẫn nguồn.",
    points: [
      {
        icon: Sparkles,
        t: "Biểu đồ theo ngày, tuần, tháng",
        d: "Huyết áp, đường huyết, cân nặng, nhịp tim — có cả dạng bảng.",
      },
      {
        icon: MessageSquareText,
        t: "Trả lời dựa trên đơn của bạn",
        d: "Trợ lý dùng đơn đã lưu và dị ứng đã khai báo, kèm trích dẫn.",
      },
      {
        icon: HeartHandshake,
        t: "Không chẩn đoán, không đổi liều",
        d: "Câu hỏi vượt phạm vi luôn được hướng về bác sĩ hoặc dược sĩ.",
      },
    ],
  },
];

const DATA_SOURCES = [
  {
    name: "Dược thư Quốc gia Việt Nam",
    by: "Bộ Y tế",
    version: "3.0",
    scope: "Chỉ định, liều dùng, tương tác của thuốc lưu hành tại Việt Nam",
  },
  {
    name: "Stockley's Drug Interactions",
    by: "Pharmaceutical Press",
    version: "13.0",
    scope: "Cơ chế và mức độ của tương tác thuốc – thuốc",
  },
  {
    name: "DrugBank Online",
    by: "OMx Personal Health Analytics",
    version: "5.1",
    scope: "Hoạt chất, đích tác dụng, enzyme chuyển hóa",
  },
  {
    name: "British National Formulary",
    by: "BMJ & RPS",
    version: "86.0",
    scope: "Đối chiếu chéo khi các nguồn khác chưa đủ dữ liệu",
  },
];

const PIPELINE = [
  {
    icon: ScanSearch,
    t: "Đọc ảnh",
    d: "Mô hình OCR tách từng dòng thuốc và gắn độ tin cậy cho từng ô.",
  },
  {
    icon: UserCheck,
    t: "Bạn xác nhận",
    d: "Bạn đối chiếu tên và hàm lượng với ảnh gốc trước khi tiếp tục.",
  },
  {
    icon: Database,
    t: "Đối chiếu dữ liệu",
    d: "Từng cặp thuốc được tra trong cơ sở dữ liệu đã được dược sĩ rà soát.",
  },
  {
    icon: BookOpen,
    t: "Kết quả có nguồn",
    d: "Mỗi kết luận kèm trích dẫn, tên nguồn và phiên bản dữ liệu.",
  },
];

const TEAM = [
  {
    initials: "TH",
    name: "ThS. DS. Lê Thu Hà",
    role: "Dược sĩ lâm sàng",
    note: "Rà soát dữ liệu tương tác và nội dung thuốc",
  },
  {
    initials: "QB",
    name: "BS. Phạm Quốc Bảo",
    role: "Bác sĩ nội khoa",
    note: "Cố vấn chuyên môn, duyệt kịch bản khẩn cấp",
  },
  {
    initials: "HL",
    name: "Nguyễn Hoàng Long",
    role: "Kỹ sư AI",
    note: "Mô hình đọc đơn và trợ lý có dẫn nguồn",
  },
  {
    initials: "MK",
    name: "Đỗ Minh Khoa",
    role: "Kỹ sư dữ liệu",
    note: "Đồng bộ và quản lý phiên bản nguồn dữ liệu",
  },
  {
    initials: "MA",
    name: "Trần Mai Anh",
    role: "Thiết kế sản phẩm",
    note: "Trải nghiệm dễ đọc cho người lớn tuổi",
  },
  {
    initials: "TT",
    name: "Vũ Thanh Tâm",
    role: "Bảo mật & quyền riêng tư",
    note: "Mã hóa và quy trình xử lý dữ liệu sức khỏe",
  },
];

const PAGES = ["intro", "mission", "trust", "team", "contact"] as const;
const NAV = [
  { page: 0, label: "Giới thiệu" },
  { page: 1, label: "Sứ mệnh" },
  { page: 2, label: "Độ tin cậy" },
  { page: 3, label: "Đội ngũ" },
  { page: 4, label: "Liên hệ" },
];
const PAGE_OF_VARIANT: Record<string, number> = {
  s1: 0,
  s2: 0,
  s3: 0,
  mission: 1,
  trust: 2,
  team: 3,
  contact: 4,
};
const SLIDE_INDEX: Record<string, number> = { s1: 0, s2: 1, s3: 2 };

/** Pages already revealed in this browser session. Cleared only by a reload. */
const SEEN = new Set<number>();

/* ------------------------------------------------------------------ */

function useReducedMotion() {
  const [r, setR] = useState(() => (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) || false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

/** Reveal the original text without replacing glyphs or scheduling per-frame renders. */
function Scramble({
  text,
  play,
  instant,
  delay = 0,
  duration = 900,
  className,
}: {
  text: string;
  play: boolean;
  instant: boolean;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("onboarding-text-reveal", className)}
      data-play={play && !instant}
      style={{ animationDelay: `${delay}ms`, animationDuration: `${duration}ms` }}
    >
      {text}
    </span>
  );
}

const d = (ms: number) => ({ className: "reveal", style: { "--d": `${ms}ms` } as CSSProperties });

/* ------------------------------------------------------------------ */

export function Onboarding() {
  const { go, setGuest, openAuth, origin, isGuest } = useApp();
  const reduced = useReducedMotion();
  const startPage = 0;
  const [page, setPage] = useState(startPage);
  const [view, setView] = useState<"home" | "scan">("home");
  const [scanOpened, setScanOpened] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const scanRoot = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const initialSeen = useRef(new Set(SEEN)).current;
  const [seen, setSeen] = useState<Set<number>>(() => new Set([...SEEN, startPage]));
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );
  const root = useRef<HTMLDivElement>(null);
  const sections = useRef<Array<HTMLElement | null>>([]);
  const lockUntil = useRef(0);
  const lastWheel = useRef(0);
  const justPaged = useRef(false);
  const touch = useRef<{ y: number; x: number; top: boolean; bottom: boolean } | null>(null);
  const slideTouch = useRef<number | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    SEEN.add(page);
    setSeen((s) => (s.has(page) ? s : new Set(s).add(page)));
  }, [page]);

  // On mobile/native scroll: dynamically reveal sections as they scroll into view
  useEffect(() => {
    if (isDesktop || view !== "home") return;

    const handleScroll = () => {
      const scrollMiddle = window.scrollY + window.innerHeight * 0.45;
      for (let i = 0; i < sections.current.length; i++) {
        const el = sections.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const bottom = top + rect.height;
        if (scrollMiddle >= top && scrollMiddle <= bottom) {
          SEEN.add(i);
          setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
          setPage(i);
          break;
        }
      }
      // If reached near bottom, ensure section 4 (Contact / Footer) is always revealed
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120) {
        SEEN.add(4);
        setSeen((s) => (s.has(4) ? s : new Set(s).add(4)));
        setPage(4);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isDesktop, view]);

  const goTo = useCallback(
    (n: number, focus = false) => {
      const next = Math.max(0, Math.min(PAGES.length - 1, n));
      setPage(next);
      SEEN.add(next);
      setSeen((s) => (s.has(next) ? s : new Set(s).add(next)));
      if (!isDesktop) {
        sections.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        lockUntil.current = Date.now() + (reduced ? 150 : 850);
        justPaged.current = true;
        if (focus)
          setTimeout(
            () => sections.current[next]?.focus({ preventScroll: true }),
            reduced ? 0 : 400,
          );
      }
    },
    [isDesktop, reduced],
  );

  const modalOpen = () => !!document.querySelector('[aria-modal="true"]');
  const scrollerOf = (k: number) =>
    sections.current[k]?.querySelector<HTMLElement>("[data-scroll]") ?? null;
  const edges = (el: HTMLElement | null) => ({
    top: !el || el.scrollTop <= 2,
    bottom: !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
  });

  // One wheel gesture = one page on desktop. On mobile, native scrolling is preserved.
  useEffect(() => {
    const el = root.current;
    if (!el || !isDesktop) return;
    const onWheel = (e: WheelEvent) => {
      if (view === "scan" || modalOpen() || Math.abs(e.deltaY) < 4) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const { top, bottom } = edges(scrollerOf(page));
      if ((dir > 0 && !bottom) || (dir < 0 && !top)) return; // let a tall page scroll internally first
      e.preventDefault();
      const now = Date.now();
      const gap = now - lastWheel.current;
      lastWheel.current = now;
      if (now < lockUntil.current) return;
      if (justPaged.current && gap < 140) return;
      justPaged.current = false;
      goTo(page + dir);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [page, goTo, isDesktop, view]);

  useEffect(() => {
    if (!isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        view === "scan" ||
        modalOpen() ||
        /INPUT|TEXTAREA|SELECT/.test(t.tagName) ||
        t.isContentEditable
      )
        return;
      const map: Record<string, number> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
      if (e.key === " " && t.tagName !== "BUTTON" && t.tagName !== "A")
        map[" "] = e.shiftKey ? -1 : 1;
      if (e.key === "Home") return (e.preventDefault(), goTo(0, true));
      if (e.key === "End") return (e.preventDefault(), goTo(PAGES.length - 1, true));
      const dir = map[e.key];
      if (!dir) return;
      const { top, bottom } = edges(scrollerOf(page));
      if ((dir > 0 && !bottom) || (dir < 0 && !top)) return;
      e.preventDefault();
      if (Date.now() >= lockUntil.current) goTo(page + dir, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goTo, isDesktop, view]);

  const toScan = () => {
    if (!origin) setGuest(true);
    setView("scan");
    setScanOpened(true);
    setScanKey((k) => k + 1);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      const scroller = scanRoot.current?.querySelector<HTMLElement>("[data-scroll]");
      if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: "instant" });
      scanRoot.current?.focus({ preventScroll: true });
    });
  };

  const toHome = (toTop = false) => {
    setView("home");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (toTop) {
      goTo(0, true);
    } else {
      requestAnimationFrame(() => {
        sections.current[page]?.focus({ preventScroll: true });
      });
    }
  };

  const auth = () => openAuth({ variant: "register" });
  const state = (k: number) => (seen.has(k) ? (initialSeen.has(k) ? "static" : "anim") : undefined);
  const play = (k: number) => state(k) === "anim";
  const instant = (k: number) => state(k) === "static";
  const isOn = (k: number) => view === "home" && page === k;

  const pages: ReactNode[] = [
    <IntroPage
      key="intro"
      slide={slide}
      setSlide={setSlide}
      play={play(0)}
      instant={instant(0)}
      active={page === 0}
      reduced={reduced}
      onAuth={auth}
      onScan={toScan}
      onNext={() => goTo(1)}
      slideTouch={slideTouch}
    />,
    <MissionPage key="mission" play={play(1)} instant={instant(1)} active={isOn(1)} />,
    <TrustPage key="trust" play={play(2)} instant={instant(2)} active={isOn(2)} />,
    <TeamPage key="team" play={play(3)} instant={instant(3)} active={isOn(3)} />,
    <ContactPage
      key="contact"
      onAuth={auth}
      onScan={toScan}
      goTo={goTo}
      play={play(4)}
      instant={instant(4)}
      active={isOn(4)}
    />,
  ];

  return (
    <div
      ref={root}
      className={cn(
        "text-ink-900",
        isDesktop || view === "scan" ? "fixed inset-0 overflow-hidden" : "relative min-h-dvh w-full",
      )}
      onTouchStart={(e) => {
        if (!isDesktop) return;
        const { top, bottom } = edges(scrollerOf(page));
        touch.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, top, bottom };
      }}
      onTouchEnd={(e) => {
        if (!isDesktop) return;
        const t = touch.current;
        touch.current = null;
        if (!t || modalOpen()) return;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(e.changedTouches[0].clientX - t.x) > Math.abs(dy)) return;
        if (dy < -60 && t.bottom) goTo(page + 1);
        if (dy > 60 && t.top) goTo(page - 1);
      }}
    >
      {/* Top bar */}
      <header
        className={cn(
          "z-40 border-b border-white/20 bg-surface/80 backdrop-blur-md dark:border-white/5",
          isDesktop ? "absolute inset-x-0 top-0" : "sticky top-0",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
          <button
            onClick={() => toHome(true)}
            className="shrink-0 rounded-lg"
            aria-label="VitaP — về đầu trang"
          >
            <Wordmark
              size="lg"
              className="max-sm:[&>span:last-child]:text-lg max-sm:[&>svg]:h-8 max-sm:[&>svg]:w-8"
            />
          </button>
          <nav aria-label="Điều hướng chính" className="ml-1 flex items-center gap-1 sm:ml-4">
            <button
              aria-current={view === "home" ? "page" : undefined}
              onClick={() => toHome(view === "home")}
              className={cn(
                "flex h-10 items-center gap-2 rounded-lg px-2.5 text-[15px] font-medium transition-colors sm:px-3.5",
                view === "home"
                  ? "bg-brand-50 text-brand-ink"
                  : "text-ink-600 hover:bg-line-100 hover:text-ink-900",
              )}
            >
              <House size={18} aria-hidden />
              <span className="max-sm:sr-only">Trang chủ</span>
            </button>
            <button
              aria-current={view === "scan" ? "page" : undefined}
              onClick={toScan}
              className={cn(
                "flex h-10 items-center gap-2 rounded-lg px-2.5 text-[15px] font-medium transition-colors sm:px-3.5",
                view === "scan"
                  ? "bg-brand-50 text-brand-ink"
                  : "text-ink-600 hover:bg-line-100 hover:text-ink-900",
              )}
            >
              <ScanLine size={18} aria-hidden />
              <span className="max-sm:sr-only">Kiểm tra thuốc</span>
            </button>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Desktop relies on the in-page buttons; mobile keeps a shortcut */}
            {isGuest ? (
              <span className="lg:hidden">
                <Button size="sm" onClick={auth}>
                  Đăng nhập
                </Button>
              </span>
            ) : (
              <span>
                <Button size="sm" variant="secondary" onClick={() => go('dashboard')}>
                  Vào ứng dụng
                </Button>
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {view === "home" && <Rail page={page} onGo={(n) => goTo(n, true)} />}

      <div
        inert={view !== "home"}
        aria-hidden={view !== "home" || undefined}
        className={cn(
          "onb-track will-change-transform",
          isDesktop
            ? cn("absolute inset-x-0 top-0", !reduced && "transition-transform duration-[850ms] ease-[cubic-bezier(0.65,0,0.35,1)]")
            : "relative h-auto w-full",
          view !== "home" && "hidden",
        )}
        style={isDesktop ? { height: `${PAGES.length * 100}dvh`, transform: `translateY(-${page * 100}dvh)` } : undefined}
      >
        {pages.map((node, k) => (
          <section
            key={PAGES[k]}
            id={PAGES[k]}
            ref={(el) => {
              sections.current[k] = el;
            }}
            tabIndex={-1}
            aria-label={k === 4 ? "Liên hệ" : NAV[k].label}
            inert={isDesktop && (view !== "home" || k !== page)}
            data-revealed={state(k)}
            className={cn("relative outline-none", isDesktop ? "h-dvh" : "min-h-dvh h-auto py-8 sm:py-12")}
          >
            <div data-scroll className={cn("no-scrollbar h-full overscroll-contain", isDesktop && "overflow-y-auto")}>
              {node}
            </div>
          </section>
        ))}
      </div>

      {scanOpened && (
        <div
          ref={scanRoot}
          tabIndex={-1}
          hidden={view !== "scan"}
          aria-label="Kiểm tra thuốc"
          role="region"
          className={cn("absolute inset-0 outline-none", view !== "scan" && "hidden")}
        >
          <div data-scroll className="no-scrollbar h-full overflow-y-auto overscroll-contain">
            <ScanPage key={scanKey} active={view === "scan"} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-full max-w-[1240px] flex-col justify-center px-4 pt-20 pb-16 sm:px-8 lg:pr-12 lg:pb-10 lg:pl-32",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Heading({
  eyebrow,
  title,
  play,
  instant,
  active,
  sub,
}: {
  eyebrow: string;
  title: string;
  play: boolean;
  instant: boolean;
  active: boolean;
  sub?: string;
}) {
  return (
    <div className="mb-6 lg:mb-8">
      <p {...d(0)}>
        <Scramble
          text={eyebrow}
          play={play}
          instant={instant}
          duration={500}
          className="font-mono text-[13px] font-semibold tracking-[0.16em] text-brand-ink uppercase dark:text-[#9fd8ff]"
        />
      </p>
      <h2
        {...d(80)}
        className={cn(
          d(80).className,
          "mt-2 max-w-3xl text-[28px] leading-[1.12] font-bold tracking-[-0.02em] text-balance sm:text-[36px] lg:text-[40px]",
        )}
      >
        <OnboardingTitle text={title} active={active} />
      </h2>
      {sub && (
        <p
          {...d(200)}
          className={cn(
            d(200).className,
            "mt-3 max-w-2xl text-[15px] text-ink-900/75 sm:text-base",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

const card =
  "rounded-3xl border border-white/60 bg-surface/90 glow dark:border-white/10 dark:bg-surface/80";

function IntroPage({
  slide,
  setSlide,
  play,
  instant,
  active,
  reduced,
  onAuth,
  onScan,
  onNext,
  slideTouch,
}: {
  slide: number;
  setSlide: (n: number) => void;
  play: boolean;
  instant: boolean;
  active: boolean;
  reduced: boolean;
  onAuth: () => void;
  onScan: () => void;
  onNext: () => void;
  slideTouch: React.MutableRefObject<number | null>;
}) {
  const { isGuest, go } = useApp();
  const last = slide === SLIDES.length - 1;
  return (
    <Frame>
      <div
        {...d(0)}
        className={cn(d(0).className, card, "overflow-hidden")}
        onTouchStart={(e) => {
          slideTouch.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (slideTouch.current === null) return;
          const dx = e.changedTouches[0].clientX - slideTouch.current;
          slideTouch.current = null;
          if (Math.abs(dx) > 50) {
            e.stopPropagation();
            setSlide(Math.max(0, Math.min(SLIDES.length - 1, slide + (dx < 0 ? 1 : -1))));
          }
        }}
      >
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:p-8">
          <div className="min-w-0" aria-live="polite">
            <p {...d(120)}>
              <Mono className="text-[13px] font-medium tracking-wide text-brand-fg">
                0{slide + 1} / 03
              </Mono>
            </p>
            <h1
              {...d(180)}
              className={cn(
                d(180).className,
                "mt-2 text-[30px] leading-[1.12] font-bold tracking-[-0.02em] sm:text-[38px] lg:text-[40px]",
              )}
            >
              <OnboardingTitle slide={slide} active={active} />
            </h1>
            <div className="relative grid">
              {SLIDES.map((s, k) => (
                <div
                  key={k}
                  aria-hidden={k !== slide}
                  className={cn(
                    "col-start-1 row-start-1 transition-[transform,opacity] duration-300 ease-out will-change-[transform,opacity]",
                    k === slide
                      ? "translate-x-0 opacity-100"
                      : cn(
                          "pointer-events-none opacity-0",
                          !reduced && (k < slide ? "-translate-x-4" : "translate-x-4"),
                        ),
                  )}
                >
                  <p
                    {...d(280)}
                    className={cn(d(280).className, "mt-3 text-base text-ink-600 lg:text-[17px]")}
                  >
                    {s.sub}
                  </p>
                  <ul className="mt-5 space-y-3">
                    {s.points.map((p, j) => (
                      <li
                        key={p.t}
                        {...d(380 + j * 90)}
                        className={cn(d(380 + j * 90).className, "flex gap-3.5")}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-fg"
                          aria-hidden
                        >
                          <p.icon size={20} />
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold">{p.t}</span>
                          <span className="block text-sm text-ink-600">{p.d}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div {...d(260)} className={cn(d(260).className, "lg:h-full")}>
            <Carousel index={slide} reduced={reduced} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-200 px-4 py-2 sm:px-7 lg:px-8">
          <Button
            variant="ghost"
            icon={<ArrowLeft size={18} aria-hidden />}
            onClick={() => setSlide(slide - 1)}
            disabled={slide === 0}
            className="text-ink-600 disabled:opacity-40"
          >
            <span className="max-sm:sr-only">Quay lại</span>
          </Button>
          <div className="flex items-center" role="group" aria-label="Chọn trang giới thiệu">
            {SLIDES.map((_, k) => (
              <button
                key={k}
                onClick={() => setSlide(k)}
                aria-label={`Trang ${k + 1} trên ${SLIDES.length}`}
                aria-current={k === slide ? "step" : undefined}
                className="flex h-11 w-7 items-center justify-center"
              >
                <span
                  className={cn(
                    "h-2 rounded-full transition-all duration-200",
                    k === slide ? "w-7 bg-brand-600" : "w-2 bg-ink-400/50",
                  )}
                />
              </button>
            ))}
          </div>
          {last ? (
            <Button
              variant="secondary"
              iconRight={<ChevronDown size={18} aria-hidden />}
              onClick={onNext}
            >
              Tìm hiểu thêm
            </Button>
          ) : (
            <Button
              variant="secondary"
              iconRight={<ArrowRight size={18} aria-hidden />}
              onClick={() => setSlide(slide + 1)}
            >
              Tiếp tục
            </Button>
          )}
        </div>
      </div>

      <div
        {...d(650)}
        className={cn(
          d(650).className,
          "mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center",
        )}
      >
        <Button onClick={isGuest ? onAuth : () => go('dashboard')} className="h-12 w-full px-7 text-base sm:w-auto">
          {isGuest ? 'Đăng ký / Đăng nhập' : 'Vào ứng dụng (Tổng quan)'}
        </Button>
        <Button
          variant="secondary"
          icon={<ScanLine size={18} aria-hidden />}
          onClick={onScan}
          className="h-12 w-full px-7 text-base sm:w-auto"
        >
          Kiểm tra thuốc (Quét đơn & Tra cứu)
        </Button>
      </div>
      <p
        {...d(720)}
        className={cn(d(720).className, "mt-3 text-center text-[12px] text-ink-900/70")}
      >
        VitaP cung cấp thông tin tham khảo, không thay thế bác sĩ hoặc dược sĩ.
      </p>
      <button
        {...d(800)}
        onClick={onNext}
        className={cn(
          d(800).className,
          "mx-auto mt-3 flex flex-col items-center gap-0.5 rounded-lg text-[12px] text-ink-900/70 hover:text-ink-900 [@media(max-height:820px)]:hidden",
        )}
      >
        Lăn chuột để sang mục tiếp theo
        <ChevronDown size={18} className={cn(!reduced && "animate-bounce")} aria-hidden />
      </button>
    </Frame>
  );
}

function MissionPage({
  play,
  instant,
  active,
}: {
  play: boolean;
  instant: boolean;
  active: boolean;
}) {
  const { isGuest, go } = useApp();
  return (
    <Frame>
      <Heading
        eyebrow="Sứ mệnh"
        title="Giúp mỗi người hiểu rõ thuốc mình đang dùng"
        play={play}
        instant={instant}
        active={active}
      />
      <blockquote {...d(260)} className={cn(d(260).className, card, "p-5 sm:p-7")}>
        <Quote size={22} className="text-brand-fg" aria-hidden />
        <p className="mt-2 text-[17px] leading-relaxed font-medium text-balance sm:text-lg">
          Đơn thuốc thường viết tay, nhiều thuốc, ít lời giải thích. VitaP muốn mỗi người — đặc biệt
          là người lớn tuổi và người chăm sóc — đọc được đơn của mình, biết thuốc dùng để làm gì và
          những gì cần hỏi lại bác sĩ.
        </p>
        <p className="mt-3 text-sm text-ink-600">
          Chúng tôi không thay thế bác sĩ hay dược sĩ. Chúng tôi giúp bạn có câu hỏi đúng khi gặp
          họ.
        </p>
      </blockquote>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: BookOpen,
            t: "Minh bạch",
            d: "Mọi kết quả đều có nguồn dẫn và phiên bản dữ liệu để bạn hoặc dược sĩ kiểm chứng.",
          },
          {
            icon: ShieldCheck,
            t: "Thận trọng",
            d: "Không chẩn đoán, không đổi liều, không gắn nhãn “an toàn”. Còn thuốc chưa rõ thì chưa kết luận.",
          },
          {
            icon: Languages,
            t: "Dễ hiểu",
            d: "Tiếng Việt rõ dấu, chữ lớn, hàm lượng bằng font số để phân biệt 5 mg với 50 mg.",
          },
        ].map((x, k) => (
          <div
            key={x.t}
            {...d(380 + k * 110)}
            className={cn(d(380 + k * 110).className, card, "p-5")}
          >
            <p className="flex items-center gap-3 text-lg font-semibold">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-fg"
                aria-hidden
              >
                <x.icon size={20} />
              </span>
              {x.t}
            </p>
            <p className="mt-1 text-sm text-ink-600">{x.d}</p>
          </div>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["4", "nguồn dữ liệu được đối chiếu"],
          ["4", "trạng thái kết quả, luôn kèm biểu tượng và chữ"],
          ["80%", "ngưỡng độ tin cậy để yêu cầu bạn đối chiếu"],
          ["0", "chẩn đoán hay khuyến nghị đổi thuốc"],
        ].map(([n, l], k) => (
          <div
            key={l}
            {...d(700 + k * 90)}
            className={cn(
              d(700 + k * 90).className,
              card,
              "flex items-center gap-4 rounded-2xl px-4 py-3",
            )}
          >
            <dt className="sr-only">{l}</dt>
            <dd className="flex items-center gap-3">
              <Scramble
                text={n}
                play={play}
                instant={instant}
                delay={800 + k * 90}
                duration={700}
                className="min-w-[3ch] font-mono text-3xl font-semibold text-brand-fg"
              />
              <span className="text-[13px] leading-snug text-ink-600">{l}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Frame>
  );
}

function TrustPage({
  play,
  instant,
  active,
}: {
  play: boolean;
  instant: boolean;
  active: boolean;
}) {
  const { isGuest, go } = useApp();
  return (
    <Frame>
      <Heading
        eyebrow="Độ tin cậy"
        title="Dữ liệu đến từ đâu, hệ thống hoạt động thế nào"
        play={play}
        instant={instant}
        active={active}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div {...d(260)} className={cn(d(260).className, card, "p-6")}>
          <p className="flex items-center gap-2 font-semibold">
            <Database size={18} className="text-brand-fg" aria-hidden /> Nguồn dữ liệu
          </p>
          <p className="mt-1 text-[13px] text-ink-600">
            Đồng bộ theo quý; phiên bản luôn hiện cạnh kết quả.
          </p>
          <ul className="mt-4 divide-y divide-line-200">
            {DATA_SOURCES.map((s) => (
              <li key={s.name} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[15px] font-semibold">{s.name}</p>
                <p className="text-[12px] text-ink-600">
                  {s.by} · phiên bản <Mono>{s.version}</Mono>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div {...d(380)} className={cn(d(380).className, card, "p-6")}>
          <p className="flex items-center gap-2 font-semibold">
            <ScanSearch size={18} className="text-brand-fg" aria-hidden /> Cách hệ thống được xây
            dựng
          </p>
          <p className="mt-1 text-[13px] text-ink-600">
            Máy đọc, bạn xác nhận, dữ liệu đã rà soát trả lời.
          </p>
          <ol className="relative mt-4 space-y-4">
            <span className="absolute top-4 bottom-4 left-[17px] w-px bg-line-200" aria-hidden />
            {PIPELINE.map((p, k) => (
              <li key={p.t} className="relative flex gap-3.5">
                <span
                  className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"
                  aria-hidden
                >
                  <p.icon size={18} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">
                    <Mono className="mr-1.5 text-[12px] text-ink-400">0{k + 1}</Mono>
                    {p.t}
                  </span>
                  <span className="block text-[13px] text-ink-600">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div {...d(500)} className={cn(d(500).className, card, "p-6")}>
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} className="text-brand-fg" aria-hidden /> Nguyên tắc kết quả
          </p>
          <p className="mt-1 text-[13px] text-ink-600">Luôn có màu, biểu tượng và chữ.</p>
          <ul className="mt-4 flex flex-col items-start gap-2">
            <li>
              <StatusPill status="INTERACTION_FOUND" severity="moderate" size="sm" />
            </li>
            <li>
              <StatusPill status="NO_KNOWN_INTERACTION" size="sm" />
            </li>
            <li>
              <StatusPill status="INSUFFICIENT_DATA" size="sm" />
            </li>
            <li>
              <StatusPill status="UNRESOLVED_DRUG" size="sm" />
            </li>
          </ul>
          <div className="mt-5 border-t border-line-200 pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lock size={15} className="text-brand-fg" aria-hidden /> Quyền riêng tư
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-600">
              <li>Chỉ xử lý dữ liệu sức khỏe khi bạn đồng ý.</li>
              <li>Mã hóa khi lưu trữ và khi truyền đi.</li>
              <li>Dùng thử: ảnh và kết quả không được lưu.</li>
            </ul>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function ScanPage({ active }: { active: boolean }) {
  return (
    <div data-revealed="anim" className="mx-auto max-w-[1160px] px-6 pt-24 pb-16 lg:pt-28">
      <Heading
        eyebrow="Kiểm tra thuốc"
        title="Dùng thử kiểm tra thuốc"
        play={active}
        instant={false}
        active={active}
        sub="Đọc đơn thuốc từ ảnh để kiểm tra tương tác, hoặc tra cứu trực tiếp theo tên thuốc kèm nguồn dẫn có căn cứ y khoa."
      />
      <div
        {...d(300)}
        className={cn(
          d(300).className,
          "rounded-xl border border-line-200 bg-surface p-4 sm:p-6 lg:p-8",
        )}
      >
        <ScanFlow allowLookup={true} />
      </div>
      <p
        {...d(400)}
        className={cn(d(400).className, "mt-4 text-center text-[12px] text-ink-900/70")}
      >
        VitaP cung cấp thông tin tham khảo, không thay thế bác sĩ hoặc dược sĩ.
      </p>
    </div>
  );
}

function TeamPage({ play, instant, active }: { play: boolean; instant: boolean; active: boolean }) {
  return (
    <Frame>
      <Heading
        eyebrow="Đội ngũ"
        title="Những người đứng sau VitaP"
        play={play}
        instant={instant}
        active={active}
        sub="Dược sĩ, bác sĩ, kỹ sư và nhà thiết kế. Mọi nội dung chuyên môn đều được dược sĩ và bác sĩ trong nhóm duyệt trước khi phát hành."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM.map((m, k) => (
          <li
            key={m.name}
            {...d(300 + k * 90)}
            className={cn(d(300 + k * 90).className, card, "rounded-2xl p-5")}
          >
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-mono text-lg font-semibold text-white"
                style={{ background: `var(--color-chart-${(k % 4) + 1})` }}
                aria-hidden
              >
                <Scramble
                  text={m.initials}
                  play={play}
                  instant={instant}
                  delay={400 + k * 90}
                  duration={500}
                />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-brand-fg">{m.role}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-600">{m.note}</p>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function ContactPage({
  onAuth,
  onScan,
  goTo,
  play,
  instant,
  active,
}: {
  onAuth: () => void;
  onScan: () => void;
  goTo: (n: number, f?: boolean) => void;
  play: boolean;
  instant: boolean;
  active: boolean;
}) {
  const { isGuest, go } = useApp();
  return (
    <div className="flex min-h-full flex-col pt-16">
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 items-center px-4 py-10 sm:px-8 lg:pr-12 lg:pl-32">
        <div
          {...d(0)}
          className={cn(
            d(0).className,
            "glow flex w-full flex-col items-start gap-6 rounded-3xl bg-brand-600 p-7 text-white sm:p-12 md:flex-row md:items-center",
          )}
        >
          <Mark size={64} className="shrink-0 rounded-[16px] ring-1 ring-white/30" />
          <div className="flex-1">
            <p className="text-[28px] leading-tight font-bold tracking-[-0.01em] sm:text-[34px]">
              <OnboardingTitle
                text="Bắt đầu hiểu đơn thuốc của bạn"
                active={active}
                tone="inverse"
              />
            </p>
            <p className="mt-2 text-white/80">
              Tạo tài khoản để lưu đơn, ghi chép sức khỏe và trò chuyện với trợ lý — hoặc thử quét
              đơn ngay.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <button
              onClick={isGuest ? onAuth : () => go('dashboard')}
              className="h-12 rounded-lg bg-white px-6 font-medium text-[#1C46A0] transition-colors hover:bg-[#EAF0FC]"
            >
              {isGuest ? 'Đăng ký / Đăng nhập' : 'Vào ứng dụng (Tổng quan)'}
            </button>
            <button
              onClick={onScan}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/40 px-6 font-medium text-white transition-colors hover:bg-white/10"
            >
              <ScanLine size={18} aria-hidden />
              Kiểm tra thuốc (Quét đơn & Tra cứu)
            </button>
          </div>
        </div>
      </div>

      <footer
        {...d(250)}
        className={cn(
          d(250).className,
          "border-t border-line-200 bg-surface/85 dark:bg-surface/60",
        )}
      >
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr] lg:pr-12 lg:pl-32">
          <div>
            <Wordmark size="lg" />
            <p className="mt-4 max-w-xs text-sm text-ink-600">
              Ứng dụng giúp bạn đọc đơn thuốc, kiểm tra tương tác và theo dõi sức khỏe — với thông
              tin có nguồn dẫn, không thay thế bác sĩ.
            </p>
          </div>
          <nav aria-label="Liên kết nhanh">
            <p className="text-sm font-semibold">Liên kết nhanh</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {(
                [
                  ["Sứ mệnh", () => goTo(1, true)],
                  ["Độ tin cậy", () => goTo(2, true)],
                  ["Đội ngũ", () => goTo(3, true)],
                  ["Kiểm tra thuốc", onScan],
                  ["Điều khoản sử dụng", () => {}],
                  ["Chính sách quyền riêng tư", () => {}],
                ] as [string, () => void][]
              ).map(([l, f]) => (
                <li key={l}>
                  <button onClick={f} className="rounded text-ink-600 hover:text-brand-fg">
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-sm font-semibold">Liên hệ</p>
            <ul className="mt-4 space-y-3 text-sm text-ink-600">
              <li className="flex gap-2.5">
                <Mail size={18} className="mt-0.5 shrink-0" aria-hidden />
                <a href="mailto:hotro@vitap.vn" className="hover:text-brand-fg">
                  hotro@vitap.vn
                </a>
              </li>
              <li className="flex gap-2.5">
                <Phone size={18} className="mt-0.5 shrink-0" aria-hidden />
                <a href="tel:02838123456" className="font-mono hover:text-brand-fg">
                  (028) 3812 3456
                </a>
              </li>
              <li className="flex gap-2.5">
                <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden />
                <span>Tầng 5, 123 Lý Thường Kiệt, Quận 10, TP. Hồ Chí Minh</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Theo dõi VitaP</p>
            <ul className="mt-4 flex gap-2">
              {(
                [
                  ["facebook", "Facebook"],
                  ["youtube", "YouTube"],
                  ["linkedin", "LinkedIn"],
                  ["zalo", "Zalo"],
                ] as const
              ).map(([k, l]) => (
                <li key={k}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    aria-label={`VitaP trên ${l}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-200 bg-surface text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-fg"
                  >
                    <SocialIcon name={k} size={20} />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-ink-600">
              Mẹo dùng thuốc đúng cách và cập nhật tính năng mỗi tuần.
            </p>
          </div>
        </div>
        <div className="border-t border-line-200">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-4 py-4 text-[12px] text-ink-600 sm:flex-row sm:justify-between sm:px-8 lg:pr-12 lg:pl-32">
            <p>© 2025 VitaP. Bảo lưu mọi quyền.</p>
            <p>Thông tin tham khảo, không thay thế tư vấn y khoa.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Table of contents: a line with dots. Labels appear only on hover/focus. Active dot glows aqua. */
function Rail({ page, onGo }: { page: number; onGo: (n: number) => void }) {
  const active = Math.min(page, NAV.length - 1);
  const STEP = 44;
  return (
    <>
      {/* Mobile: no hover, so a compact page indicator instead of the rail */}
      <nav
        aria-label="Mục lục"
        className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line-200 bg-surface/85 px-2 shadow-e2 backdrop-blur lg:hidden"
      >
        {NAV.map((n, k) => (
          <button
            key={n.page}
            onClick={() => onGo(n.page)}
            aria-label={n.label}
            aria-current={k === active ? "location" : undefined}
            className="flex h-9 w-7 items-center justify-center"
          >
            <span
              className={cn(
                "block rounded-full transition-all duration-300",
                k === active ? "h-2.5 w-5 bg-aqua" : "h-2 w-2 bg-ink-400/60",
              )}
              style={k === active ? { boxShadow: "0 0 10px var(--color-aqua)" } : undefined}
            />
          </button>
        ))}
      </nav>
      <nav
        aria-label="Mục lục"
        className="group fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 lg:block"
      >
        <div className="relative rounded-2xl border border-transparent p-2 transition-all duration-200 lg:group-focus-within:border-line-200 lg:group-focus-within:bg-surface/90 lg:group-focus-within:shadow-e2 lg:group-hover:border-line-200 lg:group-hover:bg-surface/90 lg:group-hover:shadow-e2">
          <span
            className="absolute left-[21px] w-px rounded bg-ink-900/20"
            style={{ top: 30, height: STEP * (NAV.length - 1) }}
            aria-hidden
          />
          <span
            className="absolute left-[21px] w-px rounded bg-aqua transition-all duration-500 ease-out"
            style={{ top: 30, height: STEP * active, boxShadow: "0 0 8px var(--color-aqua)" }}
            aria-hidden
          />
          <ol className="relative">
            {NAV.map((n, k) => {
              const on = k === active;
              const passed = k < active;
              return (
                <li key={n.page}>
                  <button
                    onClick={() => onGo(n.page)}
                    aria-label={n.label}
                    aria-current={on ? "location" : undefined}
                    className="flex items-center rounded-lg pr-1 text-left"
                    style={{ height: STEP }}
                  >
                    <span className="flex h-11 w-7 items-center justify-center">
                      <span
                        className={cn(
                          "block rounded-full transition-all duration-300",
                          on
                            ? "h-3 w-3 bg-aqua"
                            : passed
                              ? "h-2 w-2 bg-aqua/70"
                              : "h-2 w-2 border border-ink-900/40 bg-surface",
                        )}
                        style={
                          on
                            ? {
                                boxShadow:
                                  "0 0 0 4px color-mix(in srgb, var(--color-aqua) 25%, transparent), 0 0 14px var(--color-aqua)",
                              }
                            : undefined
                        }
                      />
                    </span>
                    <span
                      className={cn(
                        "max-w-0 overflow-hidden text-sm whitespace-nowrap opacity-0 transition-all duration-200 lg:group-focus-within:max-w-[140px] lg:group-focus-within:pl-2 lg:group-focus-within:opacity-100 lg:group-hover:max-w-[140px] lg:group-hover:pl-2 lg:group-hover:opacity-100",
                        on ? "font-semibold text-ink-900" : "text-ink-600",
                      )}
                    >
                      <Mono className="mr-2 text-xs text-ink-400">0{k + 1}</Mono>
                      {n.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hero visuals: real component fragments                              */
/* ------------------------------------------------------------------ */

function Carousel({ index, reduced }: { index: number; reduced: boolean }) {
  const visuals = [<VisualWelcome key={0} />, <VisualScan key={1} />, <VisualJournal key={2} />];
  return (
    <div
      className="relative h-[340px] overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 sm:h-[400px] lg:h-full lg:min-h-[380px]"
      aria-hidden
    >
      {reduced ? (
        visuals.map((v, k) => (
          <div
            key={k}
            className={cn(
              "absolute inset-0 transition-opacity duration-200",
              k === index ? "opacity-100" : "opacity-0",
            )}
          >
            {v}
          </div>
        ))
      ) : (
        <div
          className="absolute inset-0 flex transition-transform duration-200 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {visuals.map((v, k) => (
            <div key={k} className="relative h-full w-full shrink-0">
              {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Floating({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute rounded-xl border border-line-200 bg-surface p-3 shadow-e2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Short pill in the hero, with the full note in a hover/focus tooltip (Esc dismisses). */
function HeroStatusTip() {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span className="group relative inline-flex" onMouseLeave={() => setDismissed(false)}>
      <button
        type="button"
        aria-describedby={id}
        onBlur={() => setDismissed(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDismissed(true);
        }}
        className="-my-2 inline-flex rounded-full py-2"
      >
        <StatusPill status="INSUFFICIENT_DATA" size="sm" showSubline={false} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "invisible absolute bottom-full left-0 z-10 mb-2 w-max max-w-[260px] rounded-md bg-night px-3 py-2 text-[12px] leading-snug text-white opacity-0 shadow-e2 transition-opacity duration-150",
          !dismissed && "group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100",
        )}
      >
        {STATUS_NOTE.INSUFFICIENT_DATA}
      </span>
    </span>
  );
}

function VisualWelcome() {
  const bp = latestWith(JOURNAL_SEED, "bp")?.bp;
  return (
    <div className="grid-soft relative flex h-full items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,var(--color-brand-50)_72%)]" />
      <div className="relative flex flex-col items-center">
        <Wordmark size="xl" />
        <p className="mt-3 text-sm text-ink-600">Đơn thuốc · Sổ tay · Trợ lý</p>
      </div>
      <Floating className="top-[9%] left-[6%] hidden sm:block">
        <p className="text-xs text-ink-600">Đơn ngày {fmtDayMonth(SAMPLE_RX.date)}</p>
        <p className="text-sm font-semibold">
          <Mono>{SAMPLE_RX.drugs.length}</Mono> thuốc đã đọc
        </p>
      </Floating>
      <Floating className="top-[12%] right-[6%]">
        <p className="text-xs text-ink-600">Huyết áp</p>
        <p className="text-sm font-semibold">
          <Mono>{bp ? `${bp[0]}/${bp[1]}` : "—"}</Mono> <Mono className="font-normal text-ink-600">mmHg</Mono>
        </p>
      </Floating>
      <Floating className="bottom-[10%] left-[8%]">
        <HeroStatusTip />
      </Floating>
      <Floating className="right-[7%] bottom-[14%] hidden sm:block">
        <p className="flex items-center gap-1.5 text-[12px] text-ink-600">
          <BookOpen size={13} aria-hidden /> Dược thư Quốc gia · <Mono>3.0</Mono>
        </p>
      </Floating>
    </div>
  );
}

function VisualScan() {
  return (
    <div className="flex h-full items-center justify-center p-3 sm:p-8">
      <div className="w-full max-w-[520px]">
        <div className="paper relative rotate-[-1.2deg] overflow-hidden rounded-xl border border-line-200 px-5 pt-4 pb-5 text-[#23324d] shadow-e2 sm:px-7">
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-[#5B6673] uppercase">
            Đơn thuốc · Phòng khám An Bình
          </p>
          <div className="hand mt-2 text-[17px] leading-10 sm:text-[20px]">
            <p className="opacity-60">1) Amlodipin 5mg — Sáng 1 viên</p>
            <p>
              2){" "}
              <span className="rounded bg-[#2457C5]/10 px-1 outline-2 outline-offset-1 outline-[#2457C5]">
                Simvastatin 20mg
              </span>
            </p>
            <p className="pl-6 text-[14px] text-[#3c4a62] sm:text-[16px]">SL 30 v — Tối 1 viên</p>
            <p className="opacity-60">3) Clarithromycin 500mg — 2 lần/ngày</p>
          </div>
        </div>
        <div className="relative z-10 -mt-6 ml-auto flex w-[92%] flex-col gap-3 rounded-xl border border-line-200 bg-surface p-4 shadow-e2 sm:w-[86%]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">
              Hàm lượng: <Mono>20 mg</Mono>
            </p>
            <LowConfTag pct={62} />
          </div>
          <div className="h-px bg-line-200" />
          <p className="text-[13px] font-semibold">
            Simvastatin <Mono className="font-medium">20 mg</Mono> + Clarithromycin{" "}
            <Mono className="font-medium">500 mg</Mono>
          </p>
          <StatusPill status="INTERACTION_FOUND" severity="major" size="sm" />
          <p className="text-[12px] text-ink-600">
            <Mono className="text-brand-fg">[1]</Mono> Dược thư Quốc gia · <Mono>3.0</Mono>{" "}
            <Mono className="ml-1 text-brand-fg">[2]</Mono> Stockley's · <Mono>13.0</Mono>
          </p>
        </div>
      </div>
    </div>
  );
}

function VisualJournal() {
  const pts = [126, 121, 124, 119, 123, 125, 122];
  const dia = [82, 79, 80, 77, 79, 80, 78];
  const xs = (k: number) => 20 + k * 46;
  const ys = (v: number) => 110 - (v - 70) * 1.5;
  return (
    <div className="flex h-full items-center justify-center p-3 sm:p-8">
      <div className="relative w-full max-w-[520px]">
        <div className="rounded-xl border border-line-200 bg-surface p-4 shadow-e2">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold">Huyết áp · Tuần này</p>
            <p className="text-[13px] text-ink-600">
              <Mono>122/78</Mono> mmHg
            </p>
          </div>
          <div className="mt-1.5 flex gap-4 text-xs text-ink-600">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: "var(--color-chart-1)" }} />{" "}
              Tâm thu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: "var(--color-chart-2)" }} />{" "}
              Tâm trương
            </span>
          </div>
          <svg viewBox="0 0 320 120" className="mt-2 w-full">
            {[20, 50, 80, 110].map((g) => (
              <line key={g} x1={0} x2={320} y1={g} y2={g} stroke="var(--color-line-200)" />
            ))}
            {[
              { d: pts, c: "var(--color-chart-1)" },
              { d: dia, c: "var(--color-chart-2)" },
            ].map((s) => (
              <g key={s.c}>
                <polyline
                  fill="none"
                  stroke={s.c}
                  strokeWidth={2}
                  points={s.d.map((v, k) => `${xs(k)},${ys(v)}`).join(" ")}
                />
                {s.d.map((v, k) => (
                  <circle
                    key={k}
                    cx={xs(k)}
                    cy={ys(v)}
                    r={3.5}
                    fill="var(--color-surface)"
                    stroke={s.c}
                    strokeWidth={2}
                  />
                ))}
              </g>
            ))}
          </svg>
        </div>
        <div className="relative z-10 -mt-5 mr-2 ml-8 rounded-xl border border-line-200 bg-surface p-4 shadow-e2 sm:ml-16">
          <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink-600">
            <Mark size={18} /> Trợ lý AI
          </p>
          <p className="text-[13px] leading-5">
            Simvastatin thường được dùng buổi tối vì cơ thể tổng hợp cholesterol nhiều hơn vào ban
            đêm
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 align-[1px] font-mono text-xs font-medium text-brand-ink">
              1
            </span>
          </p>
          <p className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-full border border-line-200 px-2.5 text-xs text-ink-600">
            <Mono className="font-semibold text-brand-ink">[1]</Mono> Dược thư Quốc gia Việt Nam
          </p>
        </div>
      </div>
    </div>
  );
}
