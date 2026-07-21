"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_INTERVALS, toDateInputValue } from "@/lib/revisionScheduler";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import OnboardingModal from "./OnboardingModal";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Difficulty = "Easy" | "Medium" | "Hard";

type RevisionStage = { stage: number; dueOn: string; status: string };

type SolveEntry = {
  id: string; title: string; sourceUrl: string;
  difficulty: Difficulty; tags: string[]; solvedOn: string;
  lastSolvedAt: string | null; code: string; language: string;
  revisionStages: RevisionStage[];
};

type RevisionEntry = {
  id: string; solveId: string; title: string; stage: number; label: string;
  dueOn: string; status: string; completedAt?: string | null;
  sourceUrl?: string; difficulty?: Difficulty; tags?: string[];
};

type HistoryEntry = {
  id: string; title: string; stage: number; dueOn: string;
  status: string; completedAt: string | null;
  sourceUrl?: string; difficulty?: Difficulty; tags?: string[];
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function toDateStr(d: Date) { return toDateInputValue(d); }

function relDate(dueOn: string): string {
  const today = toDateStr(new Date());
  if (dueOn === today) return "Today";
  const diff = Math.round((new Date(dueOn + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff <= 7) return `In ${diff} days`;
  return dueOn; // Show actual date if far in future
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function diffColor(d?: Difficulty) {
  if (d === "Hard") return { dot: "bg-red-500", text: "text-red-400", badge: "bg-red-500/10 text-red-400 border-red-500/20" };
  if (d === "Medium") return { dot: "bg-yellow-500", text: "text-yellow-400", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
  return { dot: "bg-green-500", text: "text-green-400", badge: "bg-green-500/10 text-green-400 border-green-500/20" };
}

function stageStyle(status: string) {
  if (status === "done") return "bg-green-500 text-white ring-green-500/30";
  if (status === "failed") return "bg-red-500 text-white ring-red-500/30";
  if (status === "overdue") return "bg-yellow-500 text-black ring-yellow-500/30";
  return "bg-white/10 text-white/40 ring-white/5";
}

function stageIcon(status: string) {
  if (status === "done") return "✓";
  if (status === "failed") return "✗";
  if (status === "overdue") return "!";
  return String.fromCharCode(183);
}

function exportCSV(solves: SolveEntry[]) {
  const header = ["#", "Title", "Difficulty", "Tags", "Solved On", "Last Solved", "Language", "Code", "S1 (Day 3)", "S2 (Day 7)", "S3 (Day 21)", "URL"];
  const rows = solves.map((s, i) => {
    const stages = [1,2,3].map(n => {
      const st = s.revisionStages.find(r => r.stage === n);
      return st ? `${st.dueOn} [${st.status}]` : "-";
    });
    const codeEscaped = s.code ? `"${s.code.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '""';
    return [
      `${i+1}`, 
      `"${s.title.replace(/"/g,'""')}"`, 
      s.difficulty, 
      `"${s.tags.join(", ")}"`, 
      s.solvedOn,
      s.lastSolvedAt ?? "-",
      s.language,
      codeEscaped,
      ...stages, 
      s.sourceUrl
    ].join(",");
  });
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `dsa-tracker-${toDateStr(new Date())}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ─── Syntax highlight helper (reusable for flash cards) ────
   Uses marker tokens (◊N◊) that are replaced with real HTML at the
   very end — so intermediate regex passes never corrupt inserted markup. */
function highlightCodeHtml(code: string, language: string): string {
  if (!code) return "";
  let c = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Vibrant code theme — inspired by One Dark Pro / Dracula
  const COLORS = {
    comment: "#6272a4", string: "#f1fa8c", preproc: "#ff79c6",
    type: "#8be9fd", control: "#ff79c6", keyword: "#bd93f9",
    stl: "#50fa7b", number: "#ffb86c",
  };
  // token key -> color
  const tokenColors: Record<string, string> = {
    C: COLORS.comment, S: COLORS.string, P: COLORS.preproc,
    T: COLORS.type, F: COLORS.control, K: COLORS.keyword,
    L: COLORS.stl, N: COLORS.number,
  };
  const wrap = (key: string, italic = false) => (_m: string, g1: string) =>
    `◊${key}${italic ? "i" : ""}◊${g1}◊/◊`;

  if (language === "cpp" || language === "c") {
    c = c.replace(/(\/\/[^\n]*)/g, wrap("C", true));
    c = c.replace(/(\/\*[\s\S]*?\*\/)/g, wrap("C", true));
    c = c.replace(/("(?:[^"\\]|\\.)*")/g, wrap("S"));
    c = c.replace(/(#\s*(?:include|define|ifndef|ifdef|endif|pragma))/g, wrap("P"));
    c = c.replace(/\b(int|long|short|char|float|double|bool|void|auto|unsigned|signed|const|static|inline|virtual|size_t)\b/g, wrap("T"));
    c = c.replace(/\b(if|else|for|while|do|switch|case|default|break|continue|return|goto|throw|try|catch)\b/g, wrap("F"));
    c = c.replace(/\b(class|struct|union|enum|namespace|template|typename|public|private|protected|new|delete|this|nullptr|true|false|sizeof|typedef|using)\b/g, wrap("K"));
    c = c.replace(/\b(vector|map|set|unordered_map|unordered_set|pair|string|queue|stack|priority_queue|list|deque|array|cout|cin|endl|std|sort|min|max|push_back|size|begin|end)\b/g, wrap("L"));
    c = c.replace(/\b(\d+\.?\d*[fFlLuU]*)\b/g, wrap("N"));
  } else if (language === "python") {
    c = c.replace(/(#[^\n]*)/g, wrap("C", true));
    c = c.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, wrap("S"));
    c = c.replace(/\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|raise|break|continue|pass|lambda|and|or|not|in|is|async|await)\b/g, wrap("F"));
    c = c.replace(/\b(None|True|False)\b/g, wrap("K"));
    c = c.replace(/\b(int|float|str|list|dict|set|tuple|bool|range|len|print|input|open|super|self|enumerate|zip|map|filter|sorted)\b/g, wrap("L"));
    c = c.replace(/\b(\d+\.?\d*)\b/g, wrap("N"));
  } else if (language === "java") {
    c = c.replace(/(\/\/[^\n]*)/g, wrap("C", true));
    c = c.replace(/(\/\*[\s\S]*?\*\/)/g, wrap("C", true));
    c = c.replace(/("(?:[^"\\]|\\.)*")/g, wrap("S"));
    c = c.replace(/\b(int|long|short|byte|char|float|double|boolean|void|class|interface|extends|implements|abstract|final|static|public|private|protected|new|this|super|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|import|package)\b/g, wrap("K"));
    c = c.replace(/\b(null|true|false)\b/g, wrap("K"));
    c = c.replace(/\b(String|Integer|Long|Double|Float|Boolean|Object|System|Scanner|ArrayList|HashMap|HashSet|LinkedList|Arrays|Collections|Math|StringBuilder)\b/g, wrap("L"));
    c = c.replace(/\b(\d+\.?\d*[fFdDlL]?)\b/g, wrap("N"));
  } else {
    c = c.replace(/(\/\/[^\n]*)/g, wrap("C", true));
    c = c.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, wrap("S"));
    c = c.replace(/\b(const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|try|catch|throw|new|this|import|export|from|async|await|typeof)\b/g, wrap("K"));
    c = c.replace(/\b(null|undefined|true|false)\b/g, wrap("K"));
    c = c.replace(/\b(Array|Object|String|Number|Boolean|Function|Promise|Map|Set|JSON|Math|console)\b/g, wrap("L"));
    c = c.replace(/\b(\d+\.?\d*)\b/g, wrap("N"));
  }

  // Replace markers with real HTML at the very end
  c = c.replace(/◊([CSPTFKLN])(i?)◊/g, (_m, key, italic) => 
    `<span style="color:${tokenColors[key]}${italic ? ";font-style:italic" : ""}">`
  );
  c = c.replace(/◊\/◊/g, "</span>");
  return c;
}

/* ─── Theme ──────────────────────────────────────────────────────────────── */
// Clean, professional theme — high contrast, readable
function getTheme(light: boolean) {
  return {
    // Page
    pageBg:      light ? "bg-[#f7f7f8]" : "bg-[#09090b]",
    // Navbar
    navBg:       light ? "bg-white border-gray-200 shadow-sm" : "bg-[#09090b] border-[#27272a]",
    navText:     light ? "text-gray-900"          : "text-[#fafafa]",
    navMuted:    light ? "text-gray-500"          : "text-[#a1a1aa]",
    navBtn:      light ? "border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900" : "border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#18181b]",
    tabActive:   light ? "bg-gray-900 text-white" : "bg-[#fafafa] text-[#09090b]",
    tabInactive: light ? "text-gray-500 hover:text-gray-900" : "text-[#71717a] hover:text-[#fafafa]",
    tabWrap:     light ? "bg-gray-100"            : "bg-[#18181b]",
    // Cards
    card:        light ? "bg-white border-gray-200" : "bg-[#18181b] border-[#27272a]",
    cardDark:    light ? "bg-gray-900 text-white" : "bg-[#09090b] text-[#fafafa] border-[#27272a]",
    // Text — high contrast
    textPrimary: light ? "text-gray-900"          : "text-[#fafafa]",
    textMuted:   light ? "text-gray-600"          : "text-[#d4d4d8]",
    textFaint:   light ? "text-gray-400"          : "text-[#a1a1aa]",
    textVfaint:  light ? "text-gray-300"          : "text-[#71717a]",
    // Inputs
    input:       light ? "border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-200" : "border-[#27272a] bg-[#18181b] text-[#fafafa] placeholder-[#71717a] focus:border-[#3f3f46] focus:ring-1 focus:ring-[#27272a]",
    select:      light ? "border-gray-200 bg-white text-gray-900 focus:border-gray-400" : "border-[#27272a] bg-[#18181b] text-[#fafafa] focus:border-[#3f3f46]",
    // Rows
    row:         light ? "border-gray-100 hover:bg-gray-50" : "border-[#27272a] hover:bg-[#18181b]",
    rowBg:       light ? "bg-gray-50 border-gray-100"       : "bg-[#18181b] border-[#27272a]",
    // Tags
    tag:         light ? "bg-gray-100 text-gray-700"        : "bg-[#27272a] text-[#d4d4d8]",
    // Divider
    divider:     light ? "bg-gray-200"            : "bg-[#27272a]",
    // Table
    tableHead:   light ? "bg-gray-50 border-gray-200 text-gray-700" : "bg-[#18181b] border-[#27272a] text-[#d4d4d8]",
    tableRow:    light ? "border-gray-100 hover:bg-gray-50" : "border-[#27272a] hover:bg-[#18181b]",
    // Dashed empty state
    dashed:      light ? "border-gray-200 text-gray-500"    : "border-[#27272a] text-[#71717a]",
    // Revision card
    revisionCard: light ? "border-gray-200 bg-white hover:bg-gray-50" : "border-[#27272a] bg-[#18181b] hover:bg-[#1f1f23]",
  };
}
function AISummaryModal({
  title, content, onClose
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  const sections = useMemo(() => {
    const sectionNames = ["CONCEPT", "INTUITION", "KEY TRICK", "APPROACH", "CODE", "COMPLEXITY", "COMMON MISTAKES", "REMEMBER"];
    const result: Array<{ label: string; icon: string; color: string; text: string; isCode: boolean }> = [];
    const icons: Record<string, string> = {
      "CONCEPT": "🧠", "INTUITION": "💡", "KEY TRICK": "🔑",
      "APPROACH": "📋", "CODE": "💻", "COMPLEXITY": "⏱️",
      "COMMON MISTAKES": "⚠️", "REMEMBER": "🎯"
    };
    const colors: Record<string, string> = {
      "CONCEPT": "border-indigo-500/30 bg-indigo-500/5",
      "INTUITION": "border-yellow-500/30 bg-yellow-500/5",
      "KEY TRICK": "border-purple-500/30 bg-purple-500/5",
      "APPROACH": "border-blue-500/30 bg-blue-500/5",
      "CODE": "border-zinc-500/30 bg-zinc-900/50",
      "COMPLEXITY": "border-green-500/30 bg-green-500/5",
      "COMMON MISTAKES": "border-red-500/30 bg-red-500/5",
      "REMEMBER": "border-orange-500/30 bg-orange-500/5",
    };

    for (let i = 0; i < sectionNames.length; i++) {
      const name = sectionNames[i];
      const next = sectionNames[i + 1];
      const startIdx = content.indexOf(name + ":");
      if (startIdx === -1) continue;
      const afterColon = content.slice(startIdx + name.length + 1);
      const endIdx = next ? afterColon.indexOf(next + ":") : afterColon.length;
      const text = (endIdx === -1 ? afterColon : afterColon.slice(0, endIdx)).trim();
      if (text) {
        result.push({
          label: name,
          icon: icons[name] ?? "•",
          color: colors[name] ?? "border-white/10 bg-white/5",
          text,
          isCode: name === "CODE"
        });
      }
    }
    if (result.length === 0) {
      return [{ label: "Summary", icon: "📖", color: "border-white/10 bg-white/5", text: content, isCode: false }];
    }
    return result;
  }, [content]);

  // Extract just the code block text for PDF
  const codeSection = sections.find(s => s.isCode);
  const codeText = codeSection?.text
    .replace(/```cpp\n?/g, "")
    .replace(/```\n?/g, "")
    .trim() ?? "";

  const handlePDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — DSA Revision Sheet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #6b7280; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
    .section { margin-bottom: 18px; break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
    .section-body { font-size: 13px; line-height: 1.65; color: #374151; padding: 10px 14px; border-radius: 8px; border-left: 3px solid #e5e7eb; background: #f9fafb; }
    .section-body.concept { border-left-color: #6366f1; background: #eef2ff; }
    .section-body.intuition { border-left-color: #f59e0b; background: #fffbeb; }
    .section-body.trick { border-left-color: #8b5cf6; background: #f5f3ff; }
    .section-body.approach { border-left-color: #3b82f6; background: #eff6ff; }
    .section-body.complexity { border-left-color: #10b981; background: #ecfdf5; }
    .section-body.mistakes { border-left-color: #ef4444; background: #fef2f2; }
    .section-body.remember { border-left-color: #f97316; background: #fff7ed; font-weight: 600; font-size: 14px; text-align: center; padding: 14px; }
    .code-block { background: #0f1117; color: #e2e8f0; font-family: 'Consolas', 'Courier New', monospace; font-size: 11.5px; line-height: 1.6; padding: 16px 18px; border-radius: 8px; white-space: pre; overflow-x: auto; border: 1px solid #2d3748; }
    .code-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 20px; }
      .code-block { font-size: 10.5px; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">DSA Revision Sheet · Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>

  ${sections.filter(s => !s.isCode).map(s => `
  <div class="section">
    <div class="section-header">${s.icon} ${s.label}</div>
    <div class="section-body ${s.label === "CONCEPT" ? "concept" : s.label === "INTUITION" ? "intuition" : s.label === "KEY TRICK" ? "trick" : s.label === "APPROACH" ? "approach" : s.label === "COMPLEXITY" ? "complexity" : s.label === "COMMON MISTAKES" ? "mistakes" : s.label === "REMEMBER" ? "remember" : ""}">
      ${s.text.replace(/\n/g, "<br>")}
    </div>
  </div>`).join("")}

  ${codeText ? `
  <div class="section">
    <div class="code-header">💻 C++ Solution</div>
    <div class="code-block">${codeText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>` : ""}

  <div class="footer">DSA Tracker · Spaced Repetition Revision Sheet</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-8"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#13151f] shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">AI Revision Sheet</p>
            <h2 className="text-base font-bold text-white leading-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button onClick={handlePDF}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 transition">
              ↓ PDF
            </button>
            <button onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 transition">
              ✕
            </button>
          </div>
        </div>
        {/* Sections */}
        <div className="flex flex-col gap-3 p-5">
          {sections.map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">
                {s.icon} {s.label}
              </p>
              {s.isCode ? (
                <pre className="text-xs text-green-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {s.text.replace(/```cpp\n?/g, "").replace(/```\n?/g, "").trim()}
                </pre>
              ) : (
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{s.text}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Tab = "dashboard" | "questions" | "analysis" | "learn";

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function DashboardClient() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [solves, setSolves] = useState<SolveEntry[]>([]);
  const [todayRevisions, setTodayRevisions] = useState<RevisionEntry[]>([]);
  const [upcomingRevisions, setUpcomingRevisions] = useState<RevisionEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<{ totalSolved: number; easySolved: number; mediumSolved: number; hardSolved: number } | null>(null);

  // ── AI + Streak state ──────────────────────────────────────────────────
  const [streak, setStreak] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  // Daily problem from LeetCode
  const [dailyProblem, setDailyProblem] = useState<{ title: string; difficulty: string; link: string; topics: string[]; description: string; date: string } | null>(null);
  // Per-card AI state: key = revisionId, value = { summary?, hint?, loading }
  const [cardAI, setCardAI] = useState<Record<string, { summary?: string; hint?: string; loading?: boolean }>>({});
  // Modal: show full AI summary in overlay
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  // Light/dark mode
  const [lightMode, setLightMode] = useState(false);
  // Editable tags: key = solveId, value = current tag string being edited
  const [editingTags, setEditingTags] = useState<Record<string, string | null>>({});
  const [savingTags, setSavingTags] = useState<Record<string, boolean>>({});

  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [authStatus, setAuthStatus] = useState<"loading" | "in" | "out">("loading");
  const [authError, setAuthError] = useState<string | null>(null);

  const [lcUsername, setLcUsername] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [calConnected, setCalConnected] = useState(false);
  const [calMsg, setCalMsg] = useState<string | null>(null);
  const [calSyncing, setCalSyncing] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [hasLcSession, setHasLcSession] = useState(false);
  const [lcSessionInput, setLcSessionInput] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  
  // Daily target state
  const [dailyTarget, setDailyTarget] = useState(5);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Database usage state
  const [dbUsage, setDbUsage] = useState<{
    counts: { questions: number; solves: number; revisions: number };
    storage: { usedMB: number; totalMB: number; remainingMB: number; usedPercentage: number };
    capacity: { currentProblems: number; maxProblems: number; remainingProblems: number };
  } | null>(null);

  const [form, setForm] = useState({ title: "", url: "", diff: "Easy" as Difficulty, tags: "", code: "", language: "cpp" });
  const [formErr, setFormErr] = useState<string | null>(null);

  const [fDiff, setFDiff] = useState<"All" | Difficulty>("All");
  const [fTag, setFTag] = useState("");
  const [fStatus, setFStatus] = useState<"All" | "complete" | "in-progress">("All");
  const [fSearch, setFSearch] = useState("");
  
  // Pattern Browser state (for topic-wise revision access)
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [patternView, setPatternView] = useState<"grid" | "list">("grid");

  // Learn tab state
  type ContentEntry = {
    id: string;
    topic: string;
    sub_topic: string | null;
    title: string;
    question_text: string | null;
    difficulty: string | null;
    code_solution: string;
    language: string;
    explanation: string | null;
    intuition: string | null;
    time_complexity: string | null;
    space_complexity: string | null;
    tags: string[];
    source_url: string | null;
    is_favorite: boolean;
    created_at: string;
  };
  const [learnEntries, setLearnEntries] = useState<ContentEntry[]>([]);
  const [learnTopics, setLearnTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("All");
  const [selectedEntry, setSelectedEntry] = useState<ContentEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [learnSearch, setLearnSearch] = useState("");
  const [learnDifficulty, setLearnDifficulty] = useState<string>("All");
  const [learnLoading, setLearnLoading] = useState(false);
  const [editEntry, setEditEntry] = useState<ContentEntry | null>(null);
  const [learnForm, setLearnForm] = useState({
    topic: "", subTopic: "", title: "", questionText: "", difficulty: "Medium",
    codeSolution: "", language: "cpp", explanation: "", intuition: "",
    timeComplexity: "", spaceComplexity: "", tags: "", sourceUrl: ""
  });
  const [lcImportInput, setLcImportInput] = useState("");
  const [lcImporting, setLcImporting] = useState(false);
  const [lcImportMsg, setLcImportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Compiler state
  const [compilerCode, setCompilerCode] = useState("");
  const [compilerInput, setCompilerInput] = useState("");
  const [compilerOutput, setCompilerOutput] = useState("");
  const [compilerError, setCompilerError] = useState("");
  const [compilerRunning, setCompilerRunning] = useState(false);
  const [compilerLanguage, setCompilerLanguage] = useState("cpp");
  const [showCompiler, setShowCompiler] = useState(false);
  
  // Question fields for compiler (like LeetCode)
  const [compilerQuestion, setCompilerQuestion] = useState("");
  const [compilerTopic, setCompilerTopic] = useState("");
  const [compilerSubTopic, setCompilerSubTopic] = useState("");
  const [compilerTitle, setCompilerTitle] = useState("");
  const [compilerDifficulty, setCompilerDifficulty] = useState("Medium");
  
  // Compiler navigation state - for browsing saved questions
  const [compilerSelectedEntry, setCompilerSelectedEntry] = useState<ContentEntry | null>(null);
  const [compilerExpandedTopics, setCompilerExpandedTopics] = useState<Set<string>>(new Set());
  const [compilerNavSearch, setCompilerNavSearch] = useState("");
  const [compilerEditingId, setCompilerEditingId] = useState<string | null>(null); // track if editing existing entry
  const [compilerLightMode, setCompilerLightMode] = useState(false); // Light/dark mode for compiler
  
  // Resizable panels state (like LeetCode)
  const [compilerLeftWidth, setCompilerLeftWidth] = useState(240); // Left sidebar width in px
  const [compilerRightWidth, setCompilerRightWidth] = useState(340); // Right panel width in px
  const [compilerFontSize, setCompilerFontSize] = useState(13); // Font size in px
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  
  // Input/Output split within right panel
  const [compilerIOSplit, setCompilerIOSplit] = useState(50); // Percentage for input section
  const [isDraggingIO, setIsDraggingIO] = useState(false);
  
  // Layout & Theme
  const [compilerLayout, setCompilerLayout] = useState<"default" | "reversed" | "vertical" | "focus">("default");
  const [compilerTheme, setCompilerTheme] = useState<"dark" | "light" | "dracula" | "monokai" | "nord" | "githubDark">("dark");
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  // Panel collapse state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [problemInfoCollapsed, setProblemInfoCollapsed] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"testcase" | "result">("testcase");
  
  // Problem Info height (percentage of right panel when expanded)
  const [problemInfoHeight, setProblemInfoHeight] = useState(35);
  const [isDraggingProblemInfo, setIsDraggingProblemInfo] = useState(false);
  
  // Notes editor state - uses ref for uncontrolled contentEditable (prevents cursor jump bugs)
  const [compilerNotes, setCompilerNotes] = useState("");
  const [rightPanelView, setRightPanelView] = useState<"io" | "notes">("io");
  const notesEditorRef = useRef<HTMLDivElement>(null);
  const notesLoadedIdRef = useRef<string | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Multi-revision flashcard panel
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [revisionCards, setRevisionCards] = useState<string[]>([]); // entry IDs
  const [revisionLayout, setRevisionLayout] = useState<2 | 3 | 4 | 6>(3); // grid columns
  const [revisionCardHeight, setRevisionCardHeight] = useState(340); // card height in px
  const [zoomedCardId, setZoomedCardId] = useState<string | null>(null); // currently zoomed card
  const [zoomSize, setZoomSize] = useState({ w: 900, h: 600 }); // zoom modal size
  const [isDraggingZoom, setIsDraggingZoom] = useState<"right" | "bottom" | "corner" | null>(null);
  const [zoomFontSize, setZoomFontSize] = useState(15); // font size in fullscreen viewer
  const [hoverPreviewId, setHoverPreviewId] = useState<string | null>(null); // card hovered for center preview
  const [showPatternSheet, setShowPatternSheet] = useState(false); // pattern sheet export panel
  const [revisionCodePreview, setRevisionCodePreview] = useState<string | null>(null); // revision card code popup
  const [showRevisionMode, setShowRevisionMode] = useState(false); // full revision mode panel
  const [addCodeForRevision, setAddCodeForRevision] = useState<string | null>(null); // which revision is in "add code" mode
  const [addCodeText, setAddCodeText] = useState(""); // code being typed
  const [addCodeLang, setAddCodeLang] = useState("cpp"); // language for the new code
  
  // Vertical layout height (percentage of code editor)
  const [verticalSplit, setVerticalSplit] = useState(60);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);

  /* ── Auth ── */
  useEffect(() => {
    try {
      const sb = getSupabaseBrowser();
      sb.auth.getSession().then(({ data }) => {
        setToken(data.session?.access_token ?? null);
        setUserEmail(data.session?.user?.email ?? null);
        setUserName(data.session?.user?.user_metadata?.full_name ?? data.session?.user?.user_metadata?.name ?? null);
        setUserAvatar(data.session?.user?.user_metadata?.avatar_url ?? data.session?.user?.user_metadata?.picture ?? null);
        setAuthStatus(data.session ? "in" : "out");
      });
      const { data: l } = sb.auth.onAuthStateChange((_e, s) => {
        setToken(s?.access_token ?? null);
        setUserEmail(s?.user?.email ?? null);
        setUserName(s?.user?.user_metadata?.full_name ?? s?.user?.user_metadata?.name ?? null);
        setUserAvatar(s?.user?.user_metadata?.avatar_url ?? s?.user?.user_metadata?.picture ?? null);
        setAuthStatus(s ? "in" : "out");
      });
      return () => l.subscription.unsubscribe();
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Auth error"); setAuthStatus("out"); }
  }, []);

  // Apply light mode class to <html>
  useEffect(() => {
    if (lightMode) {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [lightMode]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync notes editor DOM content only when switching to a different entry
  // (never on every keystroke — that's what caused the reversed-text cursor bug)
  useEffect(() => {
    if (rightPanelView !== "notes") return;
    const entryKey = compilerEditingId ?? "new";
    if (notesLoadedIdRef.current === entryKey) return; // already loaded for this entry
    notesLoadedIdRef.current = entryKey;
    
    const el = notesEditorRef.current;
    if (!el) return;
    
    if (compilerNotes.trim()) {
      el.innerHTML = compilerNotes;
    } else {
      el.innerHTML = '<div style="opacity: 0.4;">Write your notes, tricks, and approach here...<br/><br/>• Paste images directly (Ctrl+V)<br/>• Bold: Ctrl+B | Italic: Ctrl+I<br/>• Paste formatted text from ChatGPT</div>';
    }
  }, [rightPanelView, compilerEditingId, compilerNotes]);

  // Resizable panels drag handlers - SMOOTH with requestAnimationFrame
  useEffect(() => {
    if (!isDraggingLeft && !isDraggingRight && !isDraggingIO && !isDraggingVertical && !isDraggingProblemInfo && !isDraggingZoom) return;
    
    const isVerticalDrag = isDraggingIO || isDraggingVertical || isDraggingProblemInfo || isDraggingZoom === "bottom";
    document.body.classList.add(isVerticalDrag ? "dragging-vertical" : isDraggingZoom === "corner" ? "dragging" : "dragging");
    
    let rafId: number | null = null;
    let latestMouseEvent: MouseEvent | null = null;
    
    const processMove = () => {
      if (!latestMouseEvent) { rafId = null; return; }
      const e = latestMouseEvent;
      
      if (isDraggingLeft) {
        const newWidth = Math.min(Math.max(e.clientX, 180), 500);
        setCompilerLeftWidth(newWidth);
      } else if (isDraggingRight) {
        const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 240), 600);
        setCompilerRightWidth(newWidth);
      } else if (isDraggingIO) {
        const ioContainer = document.getElementById("compiler-io-container");
        if (ioContainer) {
          const rect = ioContainer.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const percentage = (relativeY / rect.height) * 100;
          setCompilerIOSplit(Math.min(Math.max(percentage, 15), 85));
        }
      } else if (isDraggingProblemInfo) {
        const rightPanel = document.getElementById("compiler-right-panel");
        if (rightPanel) {
          const rect = rightPanel.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const percentage = (relativeY / rect.height) * 100;
          setProblemInfoHeight(Math.min(Math.max(percentage, 15), 70));
        }
      } else if (isDraggingVertical) {
        const container = document.getElementById("compiler-main-content");
        if (container) {
          const rect = container.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const percentage = (relativeY / rect.height) * 100;
          setVerticalSplit(Math.min(Math.max(percentage, 20), 85));
        }
      } else if (isDraggingZoom) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        if (isDraggingZoom === "right" || isDraggingZoom === "corner") {
          const newW = Math.min(Math.max((e.clientX - centerX) * 2 + 40, 500), window.innerWidth - 40);
          setZoomSize(prev => ({ ...prev, w: newW }));
        }
        if (isDraggingZoom === "bottom" || isDraggingZoom === "corner") {
          const newH = Math.min(Math.max((e.clientY - centerY) * 2 + 40, 300), window.innerHeight - 60);
          setZoomSize(prev => ({ ...prev, h: newH }));
        }
      }
      rafId = null;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      latestMouseEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(processMove);
      }
    };
    
    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
      setIsDraggingIO(false);
      setIsDraggingVertical(false);
      setIsDraggingProblemInfo(false);
      setIsDraggingZoom(null);
    };
    
    const handleSelectStart = (e: Event) => e.preventDefault();
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectstart", handleSelectStart);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectstart", handleSelectStart);
      document.body.classList.remove("dragging", "dragging-vertical");
    };
  }, [isDraggingLeft, isDraggingRight, isDraggingIO, isDraggingVertical, isDraggingProblemInfo, isDraggingZoom]);

  // Save tags handler
  const handleSaveTags = (solveId: string, tagsStr: string) => {
    if (!token) return;
    setSavingTags(prev => ({ ...prev, [solveId]: true }));
    const tags = tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    fetch("/api/solves/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ solveId, tags }),
    }).then(async r => {
      if (!r.ok) throw new Error("Failed");
      setSolves(prev => prev.map(s => s.id === solveId ? { ...s, tags } : s));
      setEditingTags(prev => ({ ...prev, [solveId]: null }));
    }).catch(() => undefined)
      .finally(() => setSavingTags(prev => ({ ...prev, [solveId]: false })));
  };

  const loadRevisions = useCallback((t: string) => {
    fetch("/api/revisions/today", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => {
        if (Array.isArray(d.today)) setTodayRevisions(d.today);
        if (Array.isArray(d.upcoming)) setUpcomingRevisions(d.upcoming);
      }).catch(() => undefined);
  }, []);

  const loadHistory = useCallback((t: string) => {
    fetch("/api/revisions/history?days=20", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d.revisions)) setHistory(d.revisions); })
      .catch(() => undefined);
  }, []);

  const loadSolves = useCallback((t: string) => {
    fetch("/api/solves", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d.solves)) setSolves(d.solves); })
      .catch(() => undefined);
  }, []);

  // ── Load AI analysis + streak ──────────────────────────────────────────
  const loadAnalysis = useCallback((t: string) => {
    setAnalysisLoading(true);
    fetch("/api/ai/analysis", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (d.streak !== undefined) setStreak(d.streak);
        if (d.weakAreas) setAiAnalysis(d.weakAreas);
        if (d.dailyPlan) setAiPlan(d.dailyPlan);
      })
      .catch(() => undefined)
      .finally(() => setAnalysisLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    loadRevisions(token); loadHistory(token); loadSolves(token);
    loadAnalysis(token); // loads streak + AI analysis
    fetch("/api/google/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setCalConnected(Boolean(d.connected))).catch(() => undefined);
    fetch("/api/settings/leetcode", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const u = d.leetcodeUsername ?? "";
        setLcUsername(u);
        setHasLcSession(Boolean(d.hasSession));

        // Check if first login (no username saved)
        if (!u) {
          setIsFirstLogin(true);
          setShowOnboarding(true);
        } else {
          // Auto-sync if username exists (silent)
          runSync(u, token, true);
        }
      }).catch(() => undefined);
    
    // Load database usage
    fetch("/api/database/usage", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setDbUsage(d)).catch(() => undefined);
    
    // Load today's daily problem
    fetch("/api/daily-problem")
      .then(r => r.json()).then(d => { if (d.title) setDailyProblem(d); }).catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Auto-send WhatsApp on page load (if enabled) ──
  useEffect(() => {
    if (!token || todayRevisions.length === 0) return;
    const autoSend = localStorage.getItem("wa_autosend") === "true";
    const phone = localStorage.getItem("wa_phone");
    const apiKey = localStorage.getItem("wa_apikey");
    const lastSentDate = localStorage.getItem("wa_last_sent");
    const today = new Date().toISOString().slice(0, 10);
    
    // Only auto-send once per day
    if (!autoSend || !phone || !apiKey || lastSentDate === today) return;
    
    const pendingItems = todayRevisions.filter(r => r.status === "scheduled" || r.status === "overdue");
    if (pendingItems.length === 0) return;

    // Send automatically
    const messages = pendingItems.slice(0, 7).map((item, i) => {
      const solve = solves.find(s => s.id === item.solveId);
      const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
      const snippet = code ? code.split("\n").slice(0, 20).join("\n") : "(no code saved)";
      return `📖 *${i + 1}. ${item.title}*\n${item.difficulty || ""} | Stage ${item.stage}\n\n\`\`\`\n${snippet}\n\`\`\``;
    });
    messages.unshift(`⚔️ *Auto Revision Alert*\n\n${pendingItems.length} questions due today!\n\n_Complete all for +${pendingItems.length * 15} XP 🔥_`);

    localStorage.setItem("wa_last_sent", today);
    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, apiKey, messages }),
    }).catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRevisions, token]);

  /* ── Sync ── */
  function runSync(username: string, t: string, silent = false) {
    if (!silent) { setSyncing(true); setSyncMsg("Syncing…"); }
    fetch("/api/leetcode/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ username }),
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Sync failed");
      console.log("[Sync Response]", { newProblems: d.newProblems, autoMarked: d.autoMarked, totalSolves: d.solves?.length });
      if (d.stats) setStats(d.stats);
      if (Array.isArray(d.solves)) {
        console.log("[Sync] Setting solves:", d.solves.length, "problems");
        setSolves(d.solves);
      }
      loadRevisions(t); loadHistory(t);
      if (!silent) {
        const parts: string[] = [];
        if (d.newProblems > 0) parts.push(`${d.newProblems} new`);
        if (d.autoMarked > 0) parts.push(`${d.autoMarked} auto-ticked`);
        setSyncMsg(`✓ ${parts.length ? parts.join(" · ") : "Up to date"} · ${d.solves?.length ?? 0} total`);
      }
    }).catch((e: Error) => { 
      console.error("[Sync Error]", e);
      if (!silent) setSyncMsg(`✗ ${e.message}`); 
    })
      .finally(() => { if (!silent) setSyncing(false); });
  }

  const handleOnboardingComplete = async (username: string) => {
    if (!token) return;
    
    try {
      // Save username to database
      const response = await fetch("/api/settings/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leetcodeUsername: username }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save username");
      }
      
      // Update local state
      setLcUsername(username);
      setShowOnboarding(false);
      setIsFirstLogin(false);
      
      // Start sync
      runSync(username, token, false);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save username";
      console.error("Onboarding error:", errorMessage);
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleSync = () => {
    if (!lcUsername.trim()) { setSyncMsg("Enter username first"); return; }
    if (!token) { setSyncMsg("Sign in first"); return; }
    runSync(lcUsername.trim(), token);
  };

  /* ── Save LeetCode session cookie ── */
  const handleSaveSession = () => {
    if (!token || !lcSessionInput.trim()) return;
    setSavingSession(true);
    setSessionMsg(null);
    fetch("/api/settings/leetcode", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ leetcodeSession: lcSessionInput.trim() }),
    })
      .then(async r => {
        if (!r.ok) throw new Error("Failed to save");
        setHasLcSession(true);
        setLcSessionInput("");
        setSessionMsg("✅ Session saved! Code import is now enabled.");
      })
      .catch(() => setSessionMsg("❌ Failed to save session."))
      .finally(() => setSavingSession(false));
  };

  // Removed: handleSaveUser - now handled by onboarding modal

  /* ── Mark revision ── */
  const markRevision = (id: string, status: "done" | "failed") => {
    if (!token) return;
    setTodayRevisions(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    fetch("/api/revisions/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ revisionId: id, status }),
    }).then(() => { loadRevisions(token); loadHistory(token); loadSolves(token); }).catch(() => undefined);
  };

  /* ── AI: get summary for a revision card ── */
  const getCardSummary = (item: RevisionEntry) => {
    if (cardAI[item.id]?.loading) return;
    // If already fetched, just open modal
    if (cardAI[item.id]?.summary) {
      setModal({ title: item.title, content: cardAI[item.id].summary! });
      return;
    }
    setCardAI(prev => ({ ...prev, [item.id]: { ...prev[item.id], loading: true } }));
    fetch("/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: item.title, difficulty: item.difficulty, tags: item.tags }),
    }).then(r => r.json())
      .then(d => {
        const text = d.summary ?? d.error ?? "No response";
        setCardAI(prev => ({ ...prev, [item.id]: { ...prev[item.id], summary: text, loading: false } }));
        setModal({ title: item.title, content: text });
      })
      .catch(() => setCardAI(prev => ({ ...prev, [item.id]: { ...prev[item.id], loading: false } })));
  };

  /* ── AI: get hint for a revision card ── */
  const getCardHint = (item: RevisionEntry) => {
    if (cardAI[item.id]?.loading) return;
    // If already fetched, just open modal
    if (cardAI[item.id]?.hint) {
      setModal({ title: `Hint: ${item.title}`, content: cardAI[item.id].hint! });
      return;
    }
    setCardAI(prev => ({ ...prev, [item.id]: { ...prev[item.id], loading: true } }));
    console.log("[Hint] Fetching hint for:", item.title);
    fetch("/api/ai/groq-hint", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: item.title, difficulty: item.difficulty, tags: item.tags, stage: item.stage }),
    }).then(r => r.json())
      .then(d => {
        console.log("[Hint] Response:", d);
        const text = d.hint ?? d.error ?? "No response";
        setCardAI(prev => ({ ...prev, [item.id]: { ...prev[item.id], hint: text, loading: false } }));
        setModal({ title: `Hint: ${item.title}`, content: text });
      })
      .catch((e) => {
        console.error("[Hint] Error:", e);
        setCardAI(prev => ({ ...prev, [item.id]: { ...prev[item.id], loading: false } }));
      });
  };

  /* ── Manual solve ── */
  const handleAddSolve = (e: React.FormEvent) => {
    e.preventDefault(); setFormErr(null);
    if (!form.title.trim()) { setFormErr("Title required"); return; }
    if (!token) { setFormErr("Sign in first"); return; }
    fetch("/api/solves/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        title: form.title.trim(), 
        sourceUrl: form.url.trim(), 
        difficulty: form.diff, 
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        code: form.code.trim(),
        language: form.language,
      }),
    }).then(async r => {
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setForm({ title: "", url: "", diff: "Easy", tags: "", code: "", language: "cpp" });
      loadRevisions(token); loadHistory(token); loadSolves(token);
    }).catch((e: Error) => setFormErr(e.message));
  };

  /* ── Learn Tab Functions ── */
  const loadLearnEntries = useCallback((t: string) => {
    setLearnLoading(true);
    const params = new URLSearchParams();
    if (selectedTopic !== "All") params.append("topic", selectedTopic);
    if (learnDifficulty !== "All") params.append("difficulty", learnDifficulty);
    if (learnSearch) params.append("search", learnSearch);
    
    fetch(`/api/learn?${params.toString()}`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.entries)) setLearnEntries(d.entries);
        if (Array.isArray(d.topics)) setLearnTopics(["All", ...d.topics]);
      })
      .catch(() => undefined)
      .finally(() => setLearnLoading(false));
  }, [selectedTopic, learnDifficulty, learnSearch]);

  const handleAddLearnEntry = () => {
    if (!token) return;
    if (!learnForm.topic.trim() || !learnForm.title.trim() || !learnForm.codeSolution.trim()) {
      alert("Topic, title, and code solution are required!");
      return;
    }

    const isEdit = Boolean(editEntry);
    setLearnLoading(true);
    const body = {
      topic: learnForm.topic.trim(),
      subTopic: learnForm.subTopic.trim() || undefined,
      title: learnForm.title.trim(),
      questionText: learnForm.questionText.trim() || undefined,
      difficulty: learnForm.difficulty,
      codeSolution: learnForm.codeSolution,
      language: learnForm.language,
      explanation: learnForm.explanation.trim() || undefined,
      intuition: learnForm.intuition.trim() || undefined,
      timeComplexity: learnForm.timeComplexity.trim() || undefined,
      spaceComplexity: learnForm.spaceComplexity.trim() || undefined,
      tags: learnForm.tags ? learnForm.tags.split(",").map(tg => tg.trim()).filter(Boolean) : [],
      sourceUrl: learnForm.sourceUrl.trim() || undefined,
    };

    fetch("/api/learn", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(isEdit ? { ...body, id: editEntry!.id } : body),
    })
      .then(async r => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed to save entry"); }
        // close modal and clear form
        setShowAddModal(false);
        setEditEntry(null);
        setSelectedEntry(null); // clear view modal so it shows fresh data after edit
        setLearnForm({
          topic: "", subTopic: "", title: "", questionText: "", difficulty: "Medium",
          codeSolution: "", language: "cpp", explanation: "", intuition: "",
          timeComplexity: "", spaceComplexity: "", tags: "", sourceUrl: ""
        });
        loadLearnEntries(token);
      })
      .catch((e: Error) => alert(e.message))
      .finally(() => setLearnLoading(false));
  };

  const handleDeleteLearnEntry = (id: string) => {
    if (!token) return;
    if (!confirm("Delete this entry? This cannot be undone.")) return;

    fetch(`/api/learn?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed to delete"); }
        // close any open modal that was showing this entry
        setSelectedEntry(prev => prev?.id === id ? null : prev);
        loadLearnEntries(token);
      })
      .catch((e: Error) => alert(e.message));
  };

  const handleEditLearnEntry = (entry: ContentEntry) => {
    setEditEntry(entry);
    setLearnForm({
      topic: entry.topic,
      subTopic: entry.sub_topic ?? "",
      title: entry.title,
      questionText: entry.question_text ?? "",
      difficulty: entry.difficulty ?? "Medium",
      codeSolution: entry.code_solution,
      language: entry.language,
      explanation: entry.explanation ?? "",
      intuition: entry.intuition ?? "",
      timeComplexity: entry.time_complexity ?? "",
      spaceComplexity: entry.space_complexity ?? "",
      tags: entry.tags.join(", "),
      sourceUrl: entry.source_url ?? "",
    });
    setShowAddModal(true);
  };

  const toggleFavorite = (entry: ContentEntry) => {
    if (!token) return;
    // Optimistic update
    setLearnEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_favorite: !e.is_favorite } : e));
    fetch("/api/learn", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: entry.id, isFavorite: !entry.is_favorite }),
    })
      .then(async r => {
        if (!r.ok) throw new Error("Failed");
        // sync with server truth (don't reload whole list, just update this one)
      })
      .catch(() => {
        // revert optimistic update on failure
        setLearnEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_favorite: entry.is_favorite } : e));
      });
  };

  // Load Learn entries when tab changes to "learn" or filters change
  useEffect(() => {
    if (tab === "learn" && token) {
      loadLearnEntries(token);
    }
  }, [tab, token, loadLearnEntries]);

  /* ── LeetCode Import for Learn tab ── */
  const handleLcImport = () => {
    if (!token || !lcImportInput.trim()) return;
    setLcImporting(true);
    setLcImportMsg(null);
    fetch("/api/learn/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slugOrUrl: lcImportInput.trim() }),
    })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Import failed");
        // Pre-fill the form
        setLearnForm({
          topic: d.topic ?? "",
          subTopic: d.subTopic ?? "",
          title: d.title ?? "",
          questionText: d.questionText ?? "",
          difficulty: d.difficulty ?? "Medium",
          codeSolution: d.codeSolution ?? "",
          language: d.language ?? "cpp",
          explanation: "",
          intuition: "",
          timeComplexity: "",
          spaceComplexity: "",
          tags: Array.isArray(d.tags) ? d.tags.join(", ") : "",
          sourceUrl: d.sourceUrl ?? "",
        });
        // Also set compiler code
        if (d.codeSolution) {
          setCompilerCode(d.codeSolution);
          setCompilerLanguage(d.language ?? "cpp");
        }
        setLcImportMsg({
          type: "ok",
          text: d.alreadySolved
            ? `✅ Imported "${d.title}" — your saved code was pulled in!`
            : `✅ Imported "${d.title}" — paste your solution below.`,
        });
        setLcImportInput("");
      })
      .catch((e: Error) => setLcImportMsg({ type: "err", text: `❌ ${e.message}` }))
      .finally(() => setLcImporting(false));
  };

  /* ── Run code in compiler ── */
  const runCompiler = async () => {
    if (!compilerCode.trim()) {
      setCompilerError("Please enter some code to run");
      return;
    }
    setCompilerRunning(true);
    setCompilerOutput("");
    setCompilerError("");
    
    try {
      const response = await fetch("/api/compiler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: compilerCode,
          language: compilerLanguage,
          stdin: compilerInput,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        setCompilerError(result.errorMessage || result.error || "Compilation failed");
        if (result.stdout) {
          setCompilerOutput(result.stdout);
        }
      } else {
        setCompilerOutput(result.stdout || "(No output)");
        if (result.stderr) {
          setCompilerError(result.stderr);
        }
      }
    } catch (error) {
      setCompilerError("Failed to connect to compiler service. Please try again.");
    } finally {
      setCompilerRunning(false);
    }
  };

  /* ── Quick save from compiler - directly to database ── */
  const quickSaveFromCompiler = async () => {
    if (!compilerCode.trim()) {
      alert("Please enter code first!");
      return;
    }
    if (!compilerTopic.trim()) {
      alert("Please enter a topic (e.g., Arrays, Trees, DP)");
      return;
    }
    if (!compilerTitle.trim()) {
      alert("Please enter a title for this problem");
      return;
    }
    if (!token) {
      alert("Please sign in first");
      return;
    }

    setLearnLoading(true);
    
    try {
      // Check if we're editing an existing entry
      if (compilerEditingId) {
        // Update existing entry
        const body: Record<string, unknown> = {
          id: compilerEditingId,
          topic: compilerTopic.trim(),
          subTopic: compilerSubTopic.trim() || null,
          title: compilerTitle.trim(),
          questionText: compilerQuestion.trim() || null,
          difficulty: compilerDifficulty,
          codeSolution: compilerCode,
          language: compilerLanguage,
        };
        
        // Only include notes if they have real content (not just placeholder)
        const notesContent = compilerNotes.replace(/<[^>]*>/g, "").trim();
        if (notesContent && !notesContent.startsWith("Write your notes")) {
          body.explanation = compilerNotes;
        }
        
        console.log("[Compiler] Updating entry:", body);

        const response = await fetch("/api/learn", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        
        const data = await response.json();
        console.log("[Compiler] Update response:", data);
        
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to update");
        }
        
        alert(`✅ Updated "${compilerTitle}"!`);
        loadLearnEntries(token);
      } else {
        // Create new entry
        const body: Record<string, unknown> = {
          topic: compilerTopic.trim(),
          subTopic: compilerSubTopic.trim() || null,
          title: compilerTitle.trim(),
          questionText: compilerQuestion.trim() || null,
          difficulty: compilerDifficulty,
          codeSolution: compilerCode,
          language: compilerLanguage,
          tags: [],
        };
        
        // Only include notes if they have real content
        const notesContent = compilerNotes.replace(/<[^>]*>/g, "").trim();
        if (notesContent && !notesContent.startsWith("Write your notes")) {
          body.explanation = compilerNotes;
        }
        
        console.log("[Compiler] Creating new entry:", body);

        const response = await fetch("/api/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        
        const data = await response.json();
        console.log("[Compiler] Create response:", data);
        
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to save");
        }
        
        alert(`✅ Saved "${compilerTitle}" to ${compilerTopic}!`);
        // Expand the topic in navigation so user can see the new entry
        setCompilerExpandedTopics(prev => new Set([...prev, compilerTopic.trim()]));
        // Clear form for new entry
        setCompilerCode("");
        setCompilerQuestion("");
        setCompilerTopic("");
        setCompilerSubTopic("");
        setCompilerTitle("");
        setCompilerOutput("");
        setCompilerError("");
        setCompilerInput("");
        setCompilerEditingId(null);
        setCompilerSelectedEntry(null);
        loadLearnEntries(token);
      }
    } catch (error) {
      console.error("[Compiler] Save error:", error);
      alert(`❌ ${error instanceof Error ? error.message : "Failed to save"}`);
    } finally {
      setLearnLoading(false);
    }
  };
  
  // Load entry into compiler from navigation
  const loadEntryIntoCompiler = (entry: ContentEntry) => {
    setCompilerSelectedEntry(entry);
    setCompilerEditingId(entry.id);
    setCompilerCode(entry.code_solution);
    setCompilerLanguage(entry.language);
    setCompilerTopic(entry.topic);
    setCompilerSubTopic(entry.sub_topic ?? "");
    setCompilerTitle(entry.title);
    setCompilerQuestion(entry.question_text ?? "");
    setCompilerDifficulty(entry.difficulty ?? "Medium");
    setCompilerOutput("");
    setCompilerError("");
    setCompilerInput("");
    setCompilerNotes(entry.explanation ?? "");
    notesLoadedIdRef.current = null; // force notes editor to re-sync for this entry
  };
  
  // Clear compiler for new entry
  const clearCompilerForNew = () => {
    setCompilerSelectedEntry(null);
    setCompilerEditingId(null);
    setCompilerCode("");
    setCompilerQuestion("");
    setCompilerTopic("");
    setCompilerSubTopic("");
    setCompilerTitle("");
    setCompilerDifficulty("Medium");
    setCompilerOutput("");
    setCompilerError("");
    setCompilerInput("");
    setCompilerNotes("");
    notesLoadedIdRef.current = null; // force notes editor to re-sync for new entry
  };
  
  // Syntax highlighting for code editor (LeetCode/VS Code style colors)
  const highlightedCode = useMemo(() => {
    if (!compilerCode) return "";
    
    // Escape HTML first
    let code = compilerCode
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    const lang = compilerLanguage;
    
    // Theme-specific base text color
    const baseColors = {
      light: "#1f2937",
      dark: "#d4d4d4",
      dracula: "#F8F8F2",
      monokai: "#F8F8F2",
      nord: "#D8DEE9",
      githubDark: "#C9D1D9",
    };
    const baseColor = compilerLightMode ? baseColors.light : (baseColors[compilerTheme] || baseColors.dark);
    
    // C++ / C keywords and highlighting
    if (lang === "cpp" || lang === "c") {
      // Comments (green) - must be first to avoid conflicts
      code = code.replace(/(\/\/[^\n]*)/g, '§§COMMENT§§$1§§/COMMENT§§');
      code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '§§COMMENT§§$1§§/COMMENT§§');
      // Strings (orange)
      code = code.replace(/("(?:[^"\\]|\\.)*")/g, '§§STRING§§$1§§/STRING§§');
      code = code.replace(/('(?:[^'\\\\]|\\\\.)*')/g, '§§STRING§§$1§§/STRING§§');
      // Preprocessor (purple)
      code = code.replace(/(#\s*(?:include|define|ifndef|ifdef|endif|pragma|if|else|elif|undef))/g, '§§PREPROC§§$1§§/PREPROC§§');
      // Header files
      code = code.replace(/(&lt;[a-zA-Z0-9_./]+&gt;)/g, '§§STRING§§$1§§/STRING§§');
      // Keywords - types (blue)
      code = code.replace(/\b(int|long|short|char|float|double|bool|void|auto|unsigned|signed|const|static|extern|register|volatile|inline|virtual|explicit|friend|mutable|size_t|wchar_t)\b/g, '§§TYPE§§$1§§/TYPE§§');
      // Keywords - control flow (purple/pink)
      code = code.replace(/\b(if|else|for|while|do|switch|case|default|break|continue|return|goto|throw|try|catch)\b/g, '§§CONTROL§§$1§§/CONTROL§§');
      // Keywords - class/struct (blue)
      code = code.replace(/\b(class|struct|union|enum|namespace|template|typename|public|private|protected|new|delete|this|nullptr|true|false|sizeof|typedef|using|operator)\b/g, '§§KEYWORD§§$1§§/KEYWORD§§');
      // STL types (teal/cyan)
      code = code.replace(/\b(vector|map|set|unordered_map|unordered_set|pair|string|queue|stack|priority_queue|list|deque|array|bitset|tuple|cout|cin|endl|std|sort|min|max|abs|swap|find|begin|end|size|push_back|pop_back|front|back|empty|clear|insert|erase|count|lower_bound|upper_bound)\b/g, '§§STL§§$1§§/STL§§');
      // Function calls (yellow) - word followed by (
      code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '§§FUNC§§$1§§/FUNC§§(');
      // Numbers (light green)
      code = code.replace(/\b(\d+\.?\d*[fFlLuU]*)\b/g, '§§NUMBER§§$1§§/NUMBER§§');
    }
    // Python highlighting
    else if (lang === "python") {
      code = code.replace(/(#[^\n]*)/g, '§§COMMENT§§$1§§/COMMENT§§');
      code = code.replace(/("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')/g, '§§STRING§§$1§§/STRING§§');
      code = code.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '§§STRING§§$1§§/STRING§§');
      code = code.replace(/\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|raise|break|continue|pass|lambda|and|or|not|in|is|global|nonlocal|assert|async|await)\b/g, '§§CONTROL§§$1§§/CONTROL§§');
      code = code.replace(/\b(None|True|False)\b/g, '§§KEYWORD§§$1§§/KEYWORD§§');
      code = code.replace(/\b(int|float|str|list|dict|set|tuple|bool|bytes|type|object|range|len|print|input|open|super|self|enumerate|zip|map|filter|sorted|reversed|sum|min|max|abs|round|any|all|isinstance|hasattr|getattr|setattr)\b/g, '§§STL§§$1§§/STL§§');
      code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '§§FUNC§§$1§§/FUNC§§(');
      code = code.replace(/\b(\d+\.?\d*[jJ]?)\b/g, '§§NUMBER§§$1§§/NUMBER§§');
      code = code.replace(/@(\w+)/g, '§§DECORATOR§§@$1§§/DECORATOR§§');
    }
    // Java highlighting
    else if (lang === "java") {
      code = code.replace(/(\/\/[^\n]*)/g, '§§COMMENT§§$1§§/COMMENT§§');
      code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '§§COMMENT§§$1§§/COMMENT§§');
      code = code.replace(/("(?:[^"\\]|\\.)*")/g, '§§STRING§§$1§§/STRING§§');
      code = code.replace(/\b(int|long|short|byte|char|float|double|boolean|void|class|interface|enum|extends|implements|abstract|final|static|public|private|protected|new|this|super|return|if|else|for|while|do|switch|case|default|break|continue|try|catch|finally|throw|throws|import|package|instanceof|synchronized|volatile|transient|native)\b/g, '§§KEYWORD§§$1§§/KEYWORD§§');
      code = code.replace(/\b(null|true|false)\b/g, '§§KEYWORD§§$1§§/KEYWORD§§');
      code = code.replace(/\b(String|Integer|Long|Double|Float|Boolean|Character|Object|System|Scanner|ArrayList|HashMap|HashSet|LinkedList|Arrays|Collections|Math|StringBuilder|Exception|Thread|List|Map|Set|Queue|Stack|PriorityQueue)\b/g, '§§STL§§$1§§/STL§§');
      code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '§§FUNC§§$1§§/FUNC§§(');
      code = code.replace(/\b(\d+\.?\d*[fFdDlL]?)\b/g, '§§NUMBER§§$1§§/NUMBER§§');
      code = code.replace(/@(\w+)/g, '§§DECORATOR§§@$1§§/DECORATOR§§');
    }
    // JavaScript highlighting
    else if (lang === "javascript") {
      code = code.replace(/(\/\/[^\n]*)/g, '§§COMMENT§§$1§§/COMMENT§§');
      code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '§§COMMENT§§$1§§/COMMENT§§');
      code = code.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '§§STRING§§$1§§/STRING§§');
      code = code.replace(/\b(const|let|var|function|class|extends|return|if|else|for|while|do|switch|case|default|break|continue|try|catch|finally|throw|new|this|super|import|export|from|as|async|await|yield|typeof|instanceof|in|of|delete|void)\b/g, '§§KEYWORD§§$1§§/KEYWORD§§');
      code = code.replace(/\b(null|undefined|true|false|NaN|Infinity)\b/g, '§§KEYWORD§§$1§§/KEYWORD§§');
      code = code.replace(/\b(Array|Object|String|Number|Boolean|Function|Symbol|Map|Set|WeakMap|WeakSet|Promise|Date|RegExp|Error|JSON|Math|console|document|window|setTimeout|setInterval|fetch|parseInt|parseFloat)\b/g, '§§STL§§$1§§/STL§§');
      code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '§§FUNC§§$1§§/FUNC§§(');
      code = code.replace(/\b(\d+\.?\d*)\b/g, '§§NUMBER§§$1§§/NUMBER§§');
    }
    
    // Theme color palettes
    const themeColors = {
      light: {
        comment: "#008000", string: "#a31515", preproc: "#af00db", type: "#0000ff",
        control: "#af00db", keyword: "#0000ff", stl: "#267f99", number: "#098658",
        decorator: "#795e26", func: "#795e26",
      },
      dark: {
        comment: "#6A9955", string: "#CE9178", preproc: "#C586C0", type: "#4FC1FF",
        control: "#C586C0", keyword: "#569CD6", stl: "#4EC9B0", number: "#B5CEA8",
        decorator: "#DCDCAA", func: "#DCDCAA",
      },
      dracula: {
        comment: "#6272A4", string: "#F1FA8C", preproc: "#FF79C6", type: "#8BE9FD",
        control: "#FF79C6", keyword: "#FF79C6", stl: "#50FA7B", number: "#BD93F9",
        decorator: "#F1FA8C", func: "#50FA7B",
      },
      monokai: {
        comment: "#75715E", string: "#E6DB74", preproc: "#F92672", type: "#66D9EF",
        control: "#F92672", keyword: "#F92672", stl: "#A6E22E", number: "#AE81FF",
        decorator: "#FD971F", func: "#A6E22E",
      },
      nord: {
        comment: "#616E88", string: "#A3BE8C", preproc: "#B48EAD", type: "#8FBCBB",
        control: "#81A1C1", keyword: "#81A1C1", stl: "#88C0D0", number: "#B48EAD",
        decorator: "#EBCB8B", func: "#88C0D0",
      },
      githubDark: {
        comment: "#8B949E", string: "#A5D6FF", preproc: "#FF7B72", type: "#79C0FF",
        control: "#FF7B72", keyword: "#FF7B72", stl: "#7EE787", number: "#79C0FF",
        decorator: "#D2A8FF", func: "#D2A8FF",
      },
    };
    
    const colors = compilerLightMode ? themeColors.light : themeColors[compilerTheme] || themeColors.dark;
    
    code = code
      .replace(/§§COMMENT§§/g, `<span style="color:${colors.comment};font-style:italic">`)
      .replace(/§§\/COMMENT§§/g, '</span>')
      .replace(/§§STRING§§/g, `<span style="color:${colors.string}">`)
      .replace(/§§\/STRING§§/g, '</span>')
      .replace(/§§PREPROC§§/g, `<span style="color:${colors.preproc}">`)
      .replace(/§§\/PREPROC§§/g, '</span>')
      .replace(/§§TYPE§§/g, `<span style="color:${colors.type}">`)
      .replace(/§§\/TYPE§§/g, '</span>')
      .replace(/§§CONTROL§§/g, `<span style="color:${colors.control}">`)
      .replace(/§§\/CONTROL§§/g, '</span>')
      .replace(/§§KEYWORD§§/g, `<span style="color:${colors.keyword}">`)
      .replace(/§§\/KEYWORD§§/g, '</span>')
      .replace(/§§STL§§/g, `<span style="color:${colors.stl}">`)
      .replace(/§§\/STL§§/g, '</span>')
      .replace(/§§NUMBER§§/g, `<span style="color:${colors.number}">`)
      .replace(/§§\/NUMBER§§/g, '</span>')
      .replace(/§§DECORATOR§§/g, `<span style="color:${colors.decorator}">`)
      .replace(/§§\/DECORATOR§§/g, '</span>')
      .replace(/§§FUNC§§/g, `<span style="color:${colors.func}">`)
      .replace(/§§\/FUNC§§/g, '</span>');
    
    // Wrap everything in base color
    return `<span style="color:${baseColor}">${code}</span>`;
  }, [compilerCode, compilerLanguage, compilerLightMode, compilerTheme]);

  // Get theme background/border colors for editor
  const editorTheme = useMemo(() => {
    if (compilerLightMode) return { bg: "#ffffff", lineBg: "#f9fafb", lineText: "#9ca3af", border: "#e5e7eb" };
    switch (compilerTheme) {
      case "dracula":    return { bg: "#282A36", lineBg: "#21222C", lineText: "#6272A4", border: "#44475A" };
      case "monokai":    return { bg: "#272822", lineBg: "#1E1F1A", lineText: "#75715E", border: "#3E3D32" };
      case "nord":       return { bg: "#2E3440", lineBg: "#252B35", lineText: "#4C566A", border: "#3B4252" };
      case "githubDark": return { bg: "#0D1117", lineBg: "#010409", lineText: "#484F58", border: "#21262D" };
      default:           return { bg: "#0d1117", lineBg: "#0d1117", lineText: "#6b7280", border: "#30363d" };
    }
  }, [compilerLightMode, compilerTheme]);

  // Group entries by topic and subtopic for navigation
  const compilerNavData = useMemo(() => {
    const filtered = learnEntries.filter(e => {
      if (!compilerNavSearch.trim()) return true;
      const search = compilerNavSearch.toLowerCase();
      return e.title.toLowerCase().includes(search) || 
             e.topic.toLowerCase().includes(search) ||
             (e.sub_topic?.toLowerCase().includes(search));
    });
    
    const byTopic: Record<string, Record<string, ContentEntry[]>> = {};
    filtered.forEach(entry => {
      const topic = entry.topic || "Uncategorized";
      const subTopic = entry.sub_topic || "General";
      if (!byTopic[topic]) byTopic[topic] = {};
      if (!byTopic[topic][subTopic]) byTopic[topic][subTopic] = [];
      byTopic[topic][subTopic].push(entry);
    });
    
    return byTopic;
  }, [learnEntries, compilerNavSearch]);

  // Print code to PDF with syntax highlighting
  const printCodeToPDF = () => {
    if (!compilerCode.trim()) {
      alert("Please enter some code first!");
      return;
    }
    
    const title = compilerTitle || "Untitled Problem";
    const topic = compilerTopic || "General";
    const subTopic = compilerSubTopic || "";
    const difficulty = compilerDifficulty || "Medium";
    const question = compilerQuestion || "";
    const lang = compilerLanguage;
    const languageDisplay = lang === "cpp" ? "C++" : lang === "python" ? "Python" : lang === "java" ? "Java" : lang === "javascript" ? "JavaScript" : lang.toUpperCase();
    
    // Syntax highlighting
    const highlightCode = (code: string, language: string): string => {
      let h = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const cppKw = /\b(auto|break|case|catch|class|const|continue|default|delete|do|else|enum|explicit|extern|false|for|friend|goto|if|inline|namespace|new|nullptr|operator|private|protected|public|return|sizeof|static|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while|int|long|short|char|float|double|bool|string|vector|map|set|pair|queue|stack|priority_queue|unordered_map|unordered_set)\b/g;
      const pyKw = /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|self|print|range|len|str|int|float|list|dict|set)\b/g;
      const javaKw = /\b(abstract|boolean|break|byte|case|catch|char|class|continue|default|do|double|else|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|new|null|package|private|protected|public|return|short|static|super|switch|this|throw|throws|try|void|while|true|false|String|System|ArrayList|HashMap)\b/g;
      const jsKw = /\b(async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|null|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield|true|false|console|Array|Object|String|Number|Promise)\b/g;
      
      if (language === "cpp" || language === "c") {
        h = h.replace(/(\/\/.*$)/gm, '<span class="cmt">$1</span>').replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="cmt">$1</span>').replace(/("(?:[^"\\]|\\.)*")/g, '<span class="str">$1</span>').replace(/('.')/g, '<span class="str">$1</span>').replace(/(#\w+)/g, '<span class="pre">$1</span>').replace(cppKw, '<span class="kw">$1</span>').replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');
      } else if (language === "python") {
        h = h.replace(/(#.*$)/gm, '<span class="cmt">$1</span>').replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="str">$1</span>').replace(pyKw, '<span class="kw">$1</span>').replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>').replace(/@(\w+)/g, '<span class="dec">@$1</span>');
      } else if (language === "java") {
        h = h.replace(/(\/\/.*$)/gm, '<span class="cmt">$1</span>').replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="cmt">$1</span>').replace(/("(?:[^"\\]|\\.)*")/g, '<span class="str">$1</span>').replace(javaKw, '<span class="kw">$1</span>').replace(/\b(\d+\.?\d*[fFdDlL]?)\b/g, '<span class="num">$1</span>').replace(/@(\w+)/g, '<span class="dec">@$1</span>');
      } else if (language === "javascript") {
        h = h.replace(/(\/\/.*$)/gm, '<span class="cmt">$1</span>').replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="cmt">$1</span>').replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="str">$1</span>').replace(jsKw, '<span class="kw">$1</span>').replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');
      }
      return h;
    };
    
    const pw = window.open("", "_blank");
    if (!pw) { alert("Please allow popups"); return; }
    
    const dc = difficulty === "Easy" ? "#22c55e" : difficulty === "Medium" ? "#eab308" : "#ef4444";
    const db = difficulty === "Easy" ? "#dcfce7" : difficulty === "Medium" ? "#fef9c3" : "#fee2e2";
    const hc = highlightCode(compilerCode, lang);
    const esc = (t: string) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:40px}
.c{background:#fff;border-radius:20px;box-shadow:0 25px 80px rgba(0,0,0,.3);max-width:900px;margin:0 auto;overflow:hidden}
.hd{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px 40px;color:#fff}
.tt{font-size:26px;font-weight:700;margin-bottom:15px;display:flex;align-items:center;gap:12px}
.ti{width:40px;height:40px;background:linear-gradient(135deg,#00d9ff,#00ff88);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.mt{display:flex;gap:10px;flex-wrap:wrap}
.bd{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600}
.tp{background:rgba(99,102,241,.2);color:#a5b4fc}.st{background:rgba(168,85,247,.2);color:#c4b5fd}
.df{background:${db};color:${dc}}.lg{background:rgba(34,211,238,.2);color:#67e8f9}
.ct{padding:30px 40px}.sc{margin-bottom:30px}
.sct{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:15px;display:flex;align-items:center;gap:10px}
.sct::before{content:"";width:4px;height:20px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:2px}
.pt{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:12px;padding:20px;font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.8}
.cc{background:#0d1117;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.2)}
.ch{background:linear-gradient(135deg,#161b22,#21262d);padding:15px 25px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #30363d}
.dt{display:flex;gap:8px}.dt span{width:12px;height:12px;border-radius:50%}.r{background:#ff5f56}.y{background:#ffbd2e}.g{background:#27ca40}
.fn{color:#e6edf3;font-size:13px;font-family:'JetBrains Mono',monospace}.ln{background:rgba(56,139,253,.15);color:#58a6ff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600}
.cb{padding:25px;overflow-x:auto}
.cb pre{margin:0;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.8;color:#e6edf3;white-space:pre;tab-size:4}
.kw{color:#ff7b72;font-weight:500}.str{color:#a5d6ff}.cmt{color:#8b949e;font-style:italic}.num{color:#79c0ff}.pre{color:#d2a8ff}.dec{color:#d2a8ff}
.ft{background:#f8fafc;padding:20px 40px;text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb}
@media print{body{background:#fff;padding:0}.c{box-shadow:none;border-radius:0}.cb pre{font-size:11px}}
</style></head><body>
<div class="c"><div class="hd"><h1 class="tt"><span class="ti">💻</span>${esc(title)}</h1>
<div class="mt"><span class="bd tp">📁 ${esc(topic)}</span>${subTopic?`<span class="bd st">📂 ${esc(subTopic)}</span>`:""}<span class="bd df">⚡ ${difficulty}</span><span class="bd lg">🔤 ${languageDisplay}</span></div></div>
<div class="ct">${question?`<div class="sc"><div class="sct">📋 Problem Statement</div><div class="pt">${esc(question)}</div></div>`:""}
<div class="sc"><div class="sct">🚀 Solution Code</div><div class="cc"><div class="ch"><div class="dt"><span class="r"></span><span class="y"></span><span class="g"></span></div>
<span class="fn">${lang==="cpp"?"solution.cpp":lang==="python"?"solution.py":lang==="java"?"Solution.java":"solution.js"}</span><span class="ln">${languageDisplay}</span></div>
<div class="cb"><pre>${hc}</pre></div></div></div></div>
<div class="ft"><strong>🎯 DSA Tracker</strong> • ${new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div></div></body></html>`);
    pw.document.close();
    pw.focus();
    setTimeout(() => pw.print(), 600);
  };

  /* ── Calendar ── */
  const connectCal = () => {
    if (!token) return;
    fetch("/api/google/auth", { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); window.location.href = d.authUrl; })
      .catch((e: Error) => setCalMsg(e.message));
  };
  const syncCal = () => {
    if (!token) return; setCalSyncing(true);
    fetch("/api/google/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setCalMsg(`${d.created ?? 0} event(s) created`); setCalConnected(true); })
      .catch((e: Error) => setCalMsg(e.message)).finally(() => setCalSyncing(false));
  };

  const autoSyncCal = () => {
    if (!token) return; setAutoSyncing(true); setCalMsg(null);
    fetch("/api/google/auto-sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { 
        const d = await r.json(); 
        if (!r.ok) throw new Error(d.error); 
        setCalMsg(`✅ ${d.created ?? 0} event(s) added with reminders (30min + 1hr before)`); 
        setCalConnected(true); 
      })
      .catch((e: Error) => setCalMsg(`❌ ${e.message}`))
      .finally(() => setAutoSyncing(false));
  };

  /* ── Auth ── */
  const signIn = async () => {
    setAuthError(null); setSigningIn(true);
    try {
      const sb = getSupabaseBrowser();
      // queryParams: prompt "select_account" forces Google to show account picker every time
      const { error } = await sb.auth.signInWithOAuth({ 
        provider: "google", 
        options: { 
          redirectTo: `${window.location.origin}/`,
          queryParams: { prompt: "select_account" }
        } 
      });
      if (error) throw error;
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Sign-in failed"); }
    finally { setSigningIn(false); }
  };
  const signOut = async () => {
    try {
      const sb = getSupabaseBrowser();
      // Sign out from Supabase (clears local session)
      await sb.auth.signOut({ scope: "local" });
      // Clear all state
      setToken(null);
      setUserEmail(null);
      setSolves([]); setTodayRevisions([]); setUpcomingRevisions([]); setHistory([]); setStats(null);
      setLearnEntries([]); setLearnTopics([]);
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Sign-out failed"); }
  };

  /* ── Derived ── */
  const todayKey = toDateStr(new Date());
  const pending = useMemo(() => todayRevisions.filter(r => r.status === "scheduled" || r.status === "overdue"), [todayRevisions]);
  const done = useMemo(() => todayRevisions.filter(r => r.status === "done" || r.status === "failed"), [todayRevisions]);
  const upcoming = useMemo(() => upcomingRevisions.filter(r => r.status === "scheduled" || r.status === "overdue"), [upcomingRevisions]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    solves.forEach(sv => sv.tags.forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [solves]);

  // Pattern analytics - group problems by tags with stats
  const patternStats = useMemo(() => {
    const stats = new Map<string, {
      count: number;
      easy: number;
      medium: number;
      hard: number;
      completed: number;
      pending: number;
      problems: SolveEntry[];
    }>();
    
    solves.forEach(solve => {
      solve.tags.forEach(tag => {
        if (!stats.has(tag)) {
          stats.set(tag, { count: 0, easy: 0, medium: 0, hard: 0, completed: 0, pending: 0, problems: [] });
        }
        const s = stats.get(tag)!;
        s.count++;
        s.problems.push(solve);
        if (solve.difficulty === "Easy") s.easy++;
        else if (solve.difficulty === "Medium") s.medium++;
        else if (solve.difficulty === "Hard") s.hard++;
        
        const allDone = solve.revisionStages.every(r => r.status === "done");
        if (allDone) s.completed++;
        else s.pending++;
      });
    });
    
    return Array.from(stats.entries())
      .map(([tag, data]) => ({ tag, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [solves]);

  // Get revisions for selected pattern
  const patternRevisions = useMemo(() => {
    if (!selectedPattern) return [];
    return [...todayRevisions, ...upcomingRevisions].filter(r => 
      r.tags?.includes(selectedPattern)
    );
  }, [selectedPattern, todayRevisions, upcomingRevisions]);

  // Pattern icons mapping
  const patternIcons: Record<string, string> = {
    "array": "📊", "arrays": "📊",
    "string": "📝", "strings": "📝",
    "hash table": "🗂️", "hash-table": "🗂️", "hashmap": "🗂️",
    "dynamic programming": "🧩", "dp": "🧩",
    "tree": "🌳", "trees": "🌳", "binary tree": "🌳",
    "graph": "🕸️", "graphs": "🕸️",
    "binary search": "🔍",
    "two pointers": "👆👆", "two-pointers": "👆👆",
    "sliding window": "🪟",
    "stack": "📚", "stacks": "📚",
    "queue": "📋", "queues": "📋",
    "linked list": "🔗", "linkedlist": "🔗",
    "recursion": "🔄",
    "backtracking": "↩️",
    "greedy": "💰",
    "math": "🔢", "mathematics": "🔢",
    "bit manipulation": "⚡", "bit-manipulation": "⚡",
    "heap": "⛰️", "priority queue": "⛰️",
    "trie": "🌲",
    "sorting": "📈", "sort": "📈",
    "divide and conquer": "⚔️",
    "union find": "🔀", "disjoint set": "🔀",
    "bfs": "🌊", "breadth-first search": "🌊",
    "dfs": "🏊", "depth-first search": "🏊",
    "matrix": "⬜", "2d array": "⬜",
    "simulation": "🎮",
    "design": "🏗️",
    "prefix sum": "➕",
    "monotonic stack": "📊",
  };
  
  const getPatternIcon = (tag: string) => {
    const lower = tag.toLowerCase();
    return patternIcons[lower] || "🏷️";
  };

  // Gradient colors for patterns
  const patternGradients = [
    "from-violet-500 to-purple-500",
    "from-blue-500 to-cyan-500", 
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
    "from-pink-500 to-rose-500",
    "from-indigo-500 to-blue-500",
    "from-red-500 to-orange-500",
    "from-green-500 to-emerald-500",
    "from-yellow-500 to-amber-500",
    "from-fuchsia-500 to-pink-500",
  ];

  const filtered = useMemo(() => solves.filter(s => {
    if (fDiff !== "All" && s.difficulty !== fDiff) return false;
    if (fTag && !s.tags.includes(fTag)) return false;
    if (fSearch && !s.title.toLowerCase().includes(fSearch.toLowerCase())) return false;
    if (fStatus === "complete" && !s.revisionStages.every(r => r.status === "done")) return false;
    if (fStatus === "in-progress" && s.revisionStages.every(r => r.status === "done")) return false;
    return true;
  }), [solves, fDiff, fTag, fSearch, fStatus]);

  /* ── Group history by date ── */
  const historyByDate = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    history.forEach(h => {
      if (!map.has(h.dueOn)) map.set(h.dueOn, []);
      map.get(h.dueOn)!.push(h);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [history]);


  /* ─── Render ─────────────────────────────────────────────────────────── */
  const t = getTheme(lightMode);

  return (
    <div className={`min-h-screen ${t.pageBg}`} style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", minHeight: "100vh", height: "100%" }}>

      {/* ── Onboarding Modal (First Login) ── */}
      {showOnboarding && userEmail && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSignOut={signOut}
          userEmail={userEmail}
        />
      )}

      {/* ── AI Summary Modal ── */}
      {modal && (
        <AISummaryModal
          title={modal.title}
          content={modal.content}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Navbar ── */}
      <motion.nav 
        className={`sticky top-0 z-20 border-b ${t.navBg}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-5 py-3">
          {/* Logo - always visible */}
          <motion.div 
            className="flex items-center gap-2 sm:gap-3 shrink-0"
            whileHover={{ scale: 1.02 }}
          >
            <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg ${lightMode ? "bg-[#0969da]" : "bg-[#1f6feb]"}`}>
              <span className="text-base sm:text-lg font-bold text-white">D</span>
            </div>
            <div className="hidden sm:block">
              <span className={`text-sm sm:text-base font-semibold ${t.navText}`}>DSA Tracker</span>
              <p className={`text-[9px] sm:text-[10px] ${t.navMuted}`}>Spaced Repetition</p>
            </div>
          </motion.div>

          {/* Tabs - scrollable on mobile with modern pill style */}
          <div className={`flex gap-1 sm:gap-2 rounded-xl p-1 sm:p-1.5 overflow-x-auto scrollbar-none mx-2 sm:mx-4 ${lightMode ? "bg-gray-100/80 backdrop-blur-sm" : "bg-white/5 backdrop-blur-sm"}`}>
            {(["dashboard", "questions", "analysis", "learn"] as Tab[]).map((tab2, idx) => (
              <motion.button 
                key={tab2} 
                onClick={() => setTab(tab2)}
                className={`relative rounded-lg px-3 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  tab === tab2 
                    ? lightMode 
                      ? "bg-gray-900 text-white" 
                      : "bg-white text-[#0a0a0a]"
                    : lightMode
                      ? "text-gray-500 hover:text-gray-900"
                      : "text-[#666] hover:text-white"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <span className="sm:hidden">{tab2 === "dashboard" ? "📊" : tab2 === "questions" ? "📝" : tab2 === "analysis" ? "🤖" : "🎓"}</span>
                <span className="hidden sm:inline">{tab2 === "dashboard" ? "Dashboard" : tab2 === "questions" ? "Questions" : tab2 === "analysis" ? "AI Analysis" : "Learn"}</span>
              </motion.button>
            ))}
          </div>

          {/* Right side - theme toggle + auth */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <motion.button 
              onClick={() => setLightMode(p => !p)}
              className={`rounded-lg border px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base transition-all ${t.navBtn}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Toggle light/dark mode"
            >
              {lightMode ? "🌙" : "☀️"}
            </motion.button>
            {authStatus === "loading" ? <span className={`text-[10px] sm:text-xs ${t.navMuted}`}>…</span>
              : authStatus === "in" ? (
                <div className="relative">
                  {/* Profile button */}
                  <motion.button
                    onClick={() => setShowProfileMenu(p => !p)}
                    className={`flex items-center gap-2 rounded-full px-1.5 py-1 sm:px-2.5 sm:py-1.5 transition-all ${showProfileMenu ? (lightMode ? "bg-gray-100 ring-2 ring-indigo-400" : "bg-white/10 ring-2 ring-indigo-500") : (lightMode ? "hover:bg-gray-100" : "hover:bg-white/10")}`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-indigo-400/50" />
                    ) : (
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold ${lightMode ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/20 text-indigo-400"}`}>
                        {(userName || userEmail || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <span className={`hidden md:block text-xs font-medium max-w-[120px] truncate ${lightMode ? "text-gray-700" : "text-gray-300"}`}>
                      {userName || userEmail?.split("@")[0] || "User"}
                    </span>
                    <svg className={`hidden sm:block w-3.5 h-3.5 transition-transform ${showProfileMenu ? "rotate-180" : ""} ${lightMode ? "text-gray-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </motion.button>

                  {/* Profile dropdown */}
                  <AnimatePresence>
                    {showProfileMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 top-full mt-2 w-72 rounded-xl border shadow-2xl z-50 overflow-hidden ${lightMode ? "bg-white border-gray-200 shadow-gray-200/50" : "bg-[#161b22] border-[#30363d] shadow-black/50"}`}
                      >
                        {/* User info header */}
                        <div className={`px-4 py-4 border-b ${lightMode ? "border-gray-100 bg-gradient-to-br from-indigo-50 to-purple-50" : "border-[#30363d] bg-gradient-to-br from-indigo-500/5 to-purple-500/5"}`}>
                          <div className="flex items-center gap-3">
                            {userAvatar ? (
                              <img src={userAvatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-indigo-400/30" />
                            ) : (
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${lightMode ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/20 text-indigo-400"}`}>
                                {(userName || userEmail || "U")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-bold truncate ${lightMode ? "text-gray-900" : "text-white"}`}>{userName || "User"}</p>
                              <p className={`text-[11px] truncate ${lightMode ? "text-gray-500" : "text-gray-400"}`}>{userEmail}</p>
                            </div>
                          </div>
                          {/* Stats row */}
                          <div className="flex items-center gap-3 mt-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lightMode ? "bg-green-100 text-green-700" : "bg-green-500/15 text-green-400"}`}>
                              {solves.length} Solved
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lightMode ? "bg-purple-100 text-purple-700" : "bg-purple-500/15 text-purple-400"}`}>
                              {learnEntries.length} Library
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lightMode ? "bg-orange-100 text-orange-700" : "bg-orange-500/15 text-orange-400"}`}>
                              🔥 Lv.{Math.floor((todayRevisions.filter(r => r.status === "done").length) / 3) + 1}
                            </span>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="py-1.5">
                          <button onClick={() => { setTab("dashboard"); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className="text-base">📊</span> Dashboard
                          </button>
                          <button onClick={() => { setTab("questions"); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className="text-base">📝</span> My Questions
                          </button>
                          <button onClick={() => { setTab("learn"); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className="text-base">🎓</span> Code Library
                          </button>
                          <button onClick={() => { setShowRevisionMode(true); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className="text-base">⚔️</span> Revision Quest
                          </button>
                        </div>

                        {/* Settings section */}
                        <div className={`border-t py-1.5 ${lightMode ? "border-gray-100" : "border-[#30363d]"}`}>
                          <button onClick={() => { setLightMode(p => !p); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className="text-base">{lightMode ? "🌙" : "☀️"}</span> {lightMode ? "Dark Mode" : "Light Mode"}
                          </button>
                          <button onClick={() => {
                            const current = localStorage.getItem("wa_autosend") === "true";
                            if (!current) {
                              localStorage.setItem("wa_autosend", "true");
                              alert("Auto-send enabled!");
                            } else {
                              localStorage.setItem("wa_autosend", "false");
                              alert("Auto-send disabled.");
                            }
                            setShowProfileMenu(false);
                          }} className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className="flex items-center gap-3"><span className="text-base">📱</span> WhatsApp Auto-Send</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${localStorage.getItem("wa_autosend") === "true" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-500"}`}>
                              {localStorage.getItem("wa_autosend") === "true" ? "ON" : "OFF"}
                            </span>
                          </button>
                        </div>

                        {/* Sign out */}
                        <div className={`border-t py-1.5 ${lightMode ? "border-gray-100" : "border-[#30363d]"}`}>
                          <button onClick={() => { signOut(); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-red-50 text-red-600" : "hover:bg-red-500/5 text-red-400"}`}>
                            <span className="text-base">↪</span> Sign out
                          </button>
                          <button onClick={() => { signOut().then(() => signIn()); setShowProfileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition ${lightMode ? "hover:bg-blue-50 text-blue-600" : "hover:bg-blue-500/5 text-blue-400"}`}>
                            <span className="text-base">🔄</span> Switch Account
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Click outside to close */}
                  {showProfileMenu && <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />}
                </div>
              ) : (
                <motion.button 
                  onClick={signIn} 
                  disabled={signingIn}
                  className={`flex items-center gap-2 rounded-lg px-3 sm:px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-white disabled:opacity-50 transition-all shadow-lg ${lightMode ? "bg-gradient-to-r from-[#4285F4] to-[#3578E5] hover:from-[#3578E5] hover:to-[#2B6BD4] shadow-blue-500/25" : "bg-gradient-to-r from-[#4285F4] to-[#6C63FF] hover:from-[#3578E5] hover:to-[#5B52EE] shadow-indigo-500/25"}`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  {signingIn ? "Signing in…" : <><span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Sign in with Google</span></>}
                </motion.button>
              )}
          </div>
        </div>
      </motion.nav>
      {authError && <div className="bg-red-500/10 border-b border-red-500/20 px-3 sm:px-5 py-2 text-center text-[10px] sm:text-xs text-red-400">{authError}</div>}

      {/* Main container - responsive padding */}
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-12 py-4 sm:py-7">

        {/* ════════════════════════════════════════════════════════════════
            DASHBOARD TAB
        ════════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="flex flex-col gap-6">

            {/* ════ HERO BANNER - User Info + Date/Time + Target ════ */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className={`relative overflow-hidden rounded-xl sm:rounded-2xl ${lightMode ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" : "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"}`}
            >
              {/* Animated background shapes */}
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  animate={{ x: [0, 100, 0], y: [0, -50, 0], rotate: [0, 180, 360] }}
                  transition={{ duration: 20, repeat: Infinity }}
                  className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl"
                />
                <motion.div
                  animate={{ x: [0, -80, 0], y: [0, 60, 0] }}
                  transition={{ duration: 15, repeat: Infinity }}
                  className="absolute -bottom-10 -right-10 w-60 h-60 rounded-full bg-white/10 blur-3xl"
                />
              </div>
              
              {/* Content - 3 column layout */}
              <div className="relative px-4 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* LEFT - User Info */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-3xl sm:text-5xl shrink-0"
                  >
                    {streak >= 7 ? "🔥" : streak >= 3 ? "⚡" : "👋"}
                  </motion.div>
                  <div>
                    <motion.p 
                      className="text-white/70 text-[10px] sm:text-xs font-medium uppercase tracking-wider"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      {authStatus === "in" ? "Welcome back" : "Hello there"}
                    </motion.p>
                    <motion.h1 
                      className="text-lg sm:text-2xl font-black text-white"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {authStatus === "in" && userEmail 
                        ? userEmail.split("@")[0].charAt(0).toUpperCase() + userEmail.split("@")[0].slice(1)
                        : "Guest User"}
                    </motion.h1>
                    <motion.p 
                      className="text-white/70 text-[10px] sm:text-xs font-medium flex items-center gap-1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      {streak > 0 && <span className="text-yellow-300">🔥 {streak} day streak</span>}
                      {streak === 0 && "Start your journey today!"}
                    </motion.p>
                  </div>
                </div>
                
                {/* MIDDLE - Date & Time */}
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-4xl sm:text-6xl font-black text-white tracking-tight" style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif" }}>
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </p>
                  <p className="text-white/80 text-sm sm:text-base font-semibold mt-1">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                </motion.div>
                
                {/* RIGHT - Daily Target */}
                <motion.div 
                  className="text-center cursor-pointer group"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  onClick={() => setShowTargetModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="relative">
                    {/* Circular progress */}
                    <svg className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                      {/* Progress circle */}
                      <motion.circle 
                        cx="50" cy="50" r="40" 
                        fill="none" 
                        stroke="rgba(255,255,255,0.9)" 
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min((todayRevisions.filter(r => r.status === "done").length / dailyTarget) * 251.2, 251.2)} 251.2`}
                        initial={{ strokeDasharray: "0 251.2" }}
                        animate={{ strokeDasharray: `${Math.min((todayRevisions.filter(r => r.status === "done").length / dailyTarget) * 251.2, 251.2)} 251.2` }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-2xl sm:text-3xl font-black text-white">{Math.max(dailyTarget - todayRevisions.filter(r => r.status === "done").length, 0)}</p>
                      <p className="text-[9px] sm:text-[10px] text-white/70 font-semibold">LEFT</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/60 mt-1 group-hover:text-white/80 transition">Click to set target</p>
                </motion.div>
              </div>
            </motion.div>
            
            {/* Daily Target Modal */}
            <AnimatePresence>
              {showTargetModal && (
                <motion.div 
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowTargetModal(false)}
                >
                  <motion.div 
                    className={`rounded-2xl p-6 w-80 ${lightMode ? "bg-white shadow-2xl" : "bg-[#161b22] border border-[#30363d]"}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <h3 className={`text-lg font-bold mb-4 ${lightMode ? "text-gray-900" : "text-white"}`}>🎯 Set Daily Target</h3>
                    <p className={`text-sm mb-4 ${lightMode ? "text-gray-600" : "text-gray-400"}`}>How many problems do you want to solve/revise today?</p>
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <button 
                        onClick={() => setDailyTarget(Math.max(1, dailyTarget - 1))}
                        className={`w-10 h-10 rounded-full text-xl font-bold transition ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/10 hover:bg-white/20 text-white"}`}
                      >−</button>
                      <span className={`text-4xl font-black ${lightMode ? "text-indigo-600" : "text-indigo-400"}`}>{dailyTarget}</span>
                      <button 
                        onClick={() => setDailyTarget(Math.min(20, dailyTarget + 1))}
                        className={`w-10 h-10 rounded-full text-xl font-bold transition ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/10 hover:bg-white/20 text-white"}`}
                      >+</button>
                    </div>
                    <div className="flex gap-2 mb-4">
                      {[3, 5, 7, 10].map(n => (
                        <button 
                          key={n}
                          onClick={() => setDailyTarget(n)}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                            dailyTarget === n 
                              ? "bg-indigo-500 text-white" 
                              : lightMode ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >{n}</button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setShowTargetModal(false)}
                      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold hover:from-indigo-400 hover:to-purple-400 transition"
                    >Save Target</button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ════ SCROLLING TESTIMONIALS / FEATURES MARQUEE ════ */}
            <div className="relative overflow-hidden py-2">
              {/* Gradient fade edges */}
              <div className={`absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r ${lightMode ? "from-slate-50 to-transparent" : "from-[#0d1117] to-transparent"}`} />
              <div className={`absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l ${lightMode ? "from-slate-50 to-transparent" : "from-[#0d1117] to-transparent"}`} />
              
              {/* First row - scrolling left */}
              <div className="flex animate-marquee mb-3">
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex gap-4 mr-4">
                    {[
                      { icon: "🎯", text: "Spaced Repetition System", color: "from-purple-500 to-indigo-500" },
                      { icon: "📊", text: "Track 500+ Problems", color: "from-blue-500 to-cyan-500" },
                      { icon: "🔥", text: "Streak Tracking", color: "from-orange-500 to-red-500" },
                      { icon: "💻", text: "Built-in Code Compiler", color: "from-green-500 to-emerald-500" },
                      { icon: "🌙", text: "Dark & Light Modes", color: "from-slate-500 to-zinc-500" },
                      { icon: "📱", text: "Mobile Responsive", color: "from-pink-500 to-rose-500" },
                      { icon: "🔄", text: "LeetCode Auto-Sync", color: "from-yellow-500 to-amber-500" },
                      { icon: "📅", text: "Google Calendar Integration", color: "from-teal-500 to-cyan-500" },
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap ${
                          lightMode 
                            ? "bg-white/90 backdrop-blur-sm border border-slate-200/60 shadow-md" 
                            : "bg-[#161b22]/80 backdrop-blur-sm border border-[#30363d]"
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span className={`text-sm font-semibold ${lightMode ? "text-slate-700" : "text-white/90"}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              
              {/* Second row - scrolling right */}
              <div className="flex animate-marquee-reverse">
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex gap-4 mr-4">
                    {[
                      { emoji: "⭐", user: "Dev_code_01", text: "Perfect for DSA prep!" },
                      { emoji: "🚀", user: "CodeMaster", text: "Improved my consistency 10x" },
                      { emoji: "💡", user: "AlgoNinja", text: "Best revision tracker ever" },
                      { emoji: "🎉", user: "TechStudent", text: "Love the spaced repetition" },
                      { emoji: "✨", user: "InterviewPro", text: "Cracked FAANG interviews!" },
                      { emoji: "🔥", user: "DSALover", text: "30 day streak and counting" },
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-3 px-4 py-2 rounded-full whitespace-nowrap ${
                          lightMode 
                            ? "bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/60" 
                            : "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
                        }`}
                      >
                        <span className="text-lg">{item.emoji}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${lightMode ? "text-indigo-600" : "text-indigo-400"}`}>@{item.user}</span>
                          <span className={`text-sm ${lightMode ? "text-slate-600" : "text-white/70"}`}>{item.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            {stats ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-3 sm:grid-cols-5">
                {[
                  { label: "Total", value: stats.totalSolved, accent: lightMode ? "text-gray-900" : "text-[#fafafa]" },
                  { label: "Easy", value: stats.easySolved, accent: lightMode ? "text-green-600" : "text-[#4ade80]" },
                  { label: "Medium", value: stats.mediumSolved, accent: lightMode ? "text-amber-600" : "text-[#fbbf24]" },
                  { label: "Hard", value: stats.hardSolved, accent: lightMode ? "text-red-600" : "text-[#f87171]" },
                  { label: "Streak", value: streak, accent: lightMode ? "text-orange-600" : "text-[#fb923c]", suffix: "d" },
                ].map((s) => (
                  <div 
                    key={s.label}
                    className={`rounded-xl p-5 border transition-colors ${lightMode ? "bg-white border-gray-200 hover:border-gray-300" : "bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]"}`}
                  >
                    <p className={`text-xs font-medium uppercase tracking-wider mb-3 ${lightMode ? "text-gray-500" : "text-[#a1a1aa]"}`}>{s.label}</p>
                    <p className={`text-3xl sm:text-4xl font-semibold tracking-tight ${s.accent}`}>
                      {s.value}{s.suffix || ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-2xl px-6 sm:px-10 py-10 sm:py-16 border ${lightMode ? "bg-white border-gray-200" : "bg-[#111] border-[#1f1f1f]"}`}
              >
                {/* Content */}
                <div className="max-w-2xl mx-auto text-center">
                  {authStatus !== "in" ? (
                    <>
                      <motion.h1 
                        className={`text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-4 ${lightMode ? "text-gray-900" : "text-white"}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        Your DSA workspace
                        <br />
                        <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">for what matters.</span>
                      </motion.h1>
                      <motion.p 
                        className={`text-sm sm:text-lg mb-8 max-w-md mx-auto leading-relaxed ${lightMode ? "text-gray-500" : "text-gray-400"}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Track problems. Revise with spaced repetition. Code with a built-in compiler. All free.
                      </motion.p>
                      <motion.button
                        onClick={signIn}
                        disabled={signingIn}
                        className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold text-white bg-gradient-to-r from-[#4285F4] to-[#6C63FF] hover:from-[#3578E5] hover:to-[#5B52EE] shadow-xl shadow-indigo-500/25 disabled:opacity-50 transition-all"
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        {signingIn ? "Signing in…" : "Get started with Google"}
                      </motion.button>
                      {/* Features row */}
                      <motion.div 
                        className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        {[
                          { icon: "⚡", text: "Spaced Repetition" },
                          { icon: "💻", text: "Code Compiler" },
                          { icon: "🤖", text: "AI Hints" },
                          { icon: "📱", text: "WhatsApp Alerts" },
                        ].map(f => (
                          <span key={f.text} className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium ${lightMode ? "text-gray-600" : "text-gray-400"}`}>
                            <span>{f.icon}</span> {f.text}
                          </span>
                        ))}
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <motion.div 
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <span className="text-3xl">🚀</span>
                      </motion.div>
                      <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${lightMode ? "text-gray-900" : "text-white"}`}>Ready to Start?</h2>
                      <p className={`text-sm sm:text-base ${lightMode ? "text-gray-500" : "text-gray-400"}`}>Sync your LeetCode to load stats and begin your revision journey.</p>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* Today's Daily Challenge */}
            {dailyProblem && (
              <div className={`rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${lightMode ? "bg-white border border-gray-200" : "bg-[#161b22] border border-[#30363d]"}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${lightMode ? "bg-blue-50" : "bg-blue-500/10"}`}>🎯</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-[10px] font-medium uppercase tracking-wide ${lightMode ? "text-gray-500" : "text-[#7d8590]"}`}>Today&apos;s Daily Challenge</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dailyProblem.difficulty === "Easy" ? (lightMode ? "bg-green-100 text-green-700" : "text-green-400 bg-green-500/10") : dailyProblem.difficulty === "Medium" ? (lightMode ? "bg-amber-100 text-amber-700" : "text-amber-400 bg-amber-500/10") : (lightMode ? "bg-red-100 text-red-700" : "text-red-400 bg-red-500/10")}`}>{dailyProblem.difficulty}</span>
                    </div>
                    <p className={`text-sm font-semibold truncate ${lightMode ? "text-gray-900" : "text-[#e6edf3]"}`}>{dailyProblem.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {dailyProblem.topics.slice(0, 4).map(t => (
                        <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded ${lightMode ? "bg-gray-100 text-gray-600" : "bg-[#21262d] text-[#7d8590]"}`}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <a href={dailyProblem.link} target="_blank" rel="noreferrer" className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition ${lightMode ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d] border border-[#30363d]"}`}>
                  Solve →
                </a>
              </div>
            )}

            {/* 3-col layout - stacks on mobile */}
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-[320px_1fr_280px]">

              {/* ── Col 1: Controls ── */}
              <div className="flex flex-col gap-4">

                {/* LC Sync */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`group relative overflow-hidden rounded-2xl p-6 ${lightMode ? "bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl" : "bg-[#161b22]/50 backdrop-blur-md shadow-xl hover:shadow-2xl"} transition-all`}
                >
                  {/* Gradient border */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0969da] to-[#1f6feb] opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className={`absolute inset-[1px] rounded-2xl ${lightMode ? "bg-white" : "bg-[#0d1117]"}`} />
                  
                  {/* Content */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${lightMode ? "bg-[#ddf4ff]" : "bg-[#0969da]/20"}`}>
                          <span className="text-2xl">💻</span>
                        </div>
                        <p className={`text-base font-bold ${t.textPrimary}`}>LeetCode</p>
                      </div>
                      {lcUsername && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${lightMode ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#1a7f37]/20 text-[#3fb950]"}`}>✓ Linked</span>}
                    </div>
                    {lcUsername ? (
                      <>
                        <div className={`mb-4 rounded-lg border p-4 ${lightMode ? "border-[#d0d7de] bg-[#f6f8fa]" : "border-[#30363d] bg-[#0d1117]/50"}`}>
                          <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${t.textMuted}`}>Username</p>
                          <p className={`text-lg font-black ${t.textPrimary}`}>@{lcUsername}</p>
                        </div>
                        <p className={`text-sm mb-4 leading-relaxed font-medium ${t.textMuted}`}>
                          ⚡ Auto-syncs on login. Re-solved problems auto-tick revisions.
                        </p>
                        <motion.button 
                          onClick={handleSync} 
                          disabled={syncing}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full rounded-lg py-3 text-sm font-bold text-white transition-all disabled:opacity-40 shadow-md ${lightMode ? "bg-[#0969da] hover:bg-[#0860ca]" : "bg-[#1f6feb] hover:bg-[#1a5edb]"}`}
                        >
                          {syncing ? "⏳ Syncing…" : "↻ Manual Sync"}
                        </motion.button>
                        {syncMsg && (
                          <p className={`mt-3 rounded-lg px-4 py-3 text-sm font-semibold leading-relaxed border ${syncMsg.startsWith("✓") ? lightMode ? "bg-[#dafbe1] text-[#1a7f37] border-[#1a7f37]/30" : "bg-[#1a7f37]/20 text-[#3fb950] border-[#238636]/30" : syncMsg.startsWith("✗") ? lightMode ? "bg-[#ffebe9] text-[#cf222e] border-[#cf222e]/30" : "bg-[#cf222e]/20 text-[#f85149] border-[#da3633]/30" : lightMode ? "bg-[#ddf4ff] text-[#0969da] border-[#0969da]/30" : "bg-[#0969da]/20 text-[#58a6ff] border-[#1f6feb]/30"}`}>
                            {syncMsg}
                          </p>
                        )}

                        {/* ── LeetCode Session Cookie (for code import) ── */}
                        <div className={`mt-4 rounded-xl border p-3 ${lightMode ? "bg-orange-50 border-orange-200" : "bg-orange-500/10 border-orange-500/20"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className={`text-[11px] font-bold uppercase tracking-wide ${lightMode ? "text-orange-700" : "text-orange-300"}`}>
                              🔑 Code Import Session
                            </p>
                            {hasLcSession && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lightMode ? "bg-green-100 text-green-700" : "bg-green-500/20 text-green-400"}`}>
                                ✓ Active
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mb-2 leading-relaxed ${lightMode ? "text-orange-800" : "text-orange-200/70"}`}>
                            {hasLcSession
                              ? "Session saved. Your submitted code auto-imports in Learn tab."
                              : "Paste your LEETCODE_SESSION cookie to enable auto-import of your submitted code."}
                          </p>
                          {!hasLcSession && (
                            <>
                              <input
                                value={lcSessionInput}
                                onChange={e => setLcSessionInput(e.target.value)}
                                placeholder="Paste LEETCODE_SESSION cookie value…"
                                type="password"
                                className={`w-full rounded-lg border px-3 py-2 text-xs outline-none mb-2 ${t.input}`}
                              />
                              <motion.button
                                onClick={handleSaveSession}
                                disabled={savingSession || !lcSessionInput.trim()}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full rounded-lg py-2 text-xs font-bold text-white transition disabled:opacity-40 ${lightMode ? "bg-orange-500 hover:bg-orange-600" : "bg-orange-500 hover:bg-orange-400"}`}
                              >
                                {savingSession ? "Saving…" : "Save Session Cookie"}
                              </motion.button>
                            </>
                          )}
                          {hasLcSession && (
                            <button
                              onClick={() => { setHasLcSession(false); setLcSessionInput(""); setSessionMsg(null); }}
                              className={`text-[11px] font-semibold underline ${lightMode ? "text-orange-600" : "text-orange-400"}`}
                            >
                              Replace session cookie
                            </button>
                          )}
                          {!hasLcSession && lcSessionInput === "" && (
                            <button
                              onClick={() => { setHasLcSession(false); }}
                              className={`text-[11px] font-semibold underline ${lightMode ? "text-orange-600" : "text-orange-400"}`}
                            >
                              Replace session cookie
                            </button>
                          )}
                          {sessionMsg && (
                            <p className={`mt-2 text-[11px] font-semibold ${sessionMsg.startsWith("✅") ? (lightMode ? "text-green-700" : "text-green-400") : "text-red-400"}`}>
                              {sessionMsg}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className={`rounded-lg border-2 border-dashed px-4 py-8 text-center ${t.dashed}`}>
                        <span className="text-4xl mb-3 block">🎯</span>
                        <p className="text-sm font-bold">Complete onboarding to link your profile</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Calendar */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`group relative overflow-hidden rounded-2xl p-6 ${lightMode ? "bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl" : "bg-[#161b22]/50 backdrop-blur-md shadow-xl hover:shadow-2xl"} transition-all`}
                >
                  {/* Gradient border */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#bf8700] to-[#d29922] opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className={`absolute inset-[1px] rounded-2xl ${lightMode ? "bg-white" : "bg-[#0d1117]"}`} />
                  
                  {/* Content */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${lightMode ? "bg-[#fff8c5]" : "bg-[#bf8700]/20"}`}>
                          <span className="text-2xl">📅</span>
                        </div>
                        <p className={`text-base font-bold ${t.textPrimary}`}>Calendar</p>
                      </div>
                      {calConnected && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${lightMode ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#1a7f37]/20 text-[#3fb950]"}`}>✓ Connected</span>}
                    </div>
                    <p className={`text-sm mb-4 font-medium ${t.textMuted}`}>🔔 Auto-sync today&apos;s revisions with reminders.</p>
                    <div className="flex flex-col gap-2">
                      {!calConnected ? (
                        <motion.button 
                          onClick={connectCal}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`rounded-lg px-4 py-3 text-sm font-bold transition-all ${lightMode ? "bg-[#fff8c5] text-[#bf8700] hover:bg-[#fff3a0] border border-[#bf8700]/30" : "bg-[#bf8700]/20 text-[#d29922] hover:bg-[#bf8700]/30 border border-[#d29922]/30"}`}
                        >
                          Connect Calendar
                        </motion.button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <motion.button 
                            onClick={autoSyncCal} 
                            disabled={autoSyncing}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold text-white transition-all disabled:opacity-40 shadow-md ${lightMode ? "bg-[#bf8700] hover:bg-[#a67700]" : "bg-[#d29922] hover:bg-[#c28a1f]"}`}
                          >
                            {autoSyncing ? "⏳ Syncing…" : "🔔 Auto-Sync"}
                          </motion.button>
                          <motion.button 
                            onClick={syncCal} 
                            disabled={calSyncing}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-40 transition-all ${lightMode ? "bg-[#fff8c5] text-[#bf8700] hover:bg-[#fff3a0] border border-[#bf8700]/30" : "bg-[#bf8700]/20 text-[#d29922] hover:bg-[#bf8700]/30 border border-[#d29922]/30"}`}
                          >
                            {calSyncing ? "⏳" : "↻"}
                          </motion.button>
                        </div>
                      )}
                      {calMsg && (
                        <p className={`text-sm font-semibold leading-relaxed rounded-lg px-3 py-2 border ${calMsg.startsWith("✅") ? lightMode ? "bg-[#dafbe1] text-[#1a7f37] border-[#1a7f37]/30" : "bg-[#1a7f37]/20 text-[#3fb950] border-[#238636]/30" : calMsg.startsWith("❌") ? lightMode ? "bg-[#ffebe9] text-[#cf222e] border-[#cf222e]/30" : "bg-[#cf222e]/20 text-[#f85149] border-[#da3633]/30" : t.textMuted}`}>
                          {calMsg}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Manual add */}
                <div className={`rounded-xl border p-4 ${t.card}`}>
                  <p className={`text-sm font-semibold mb-1 ${t.textPrimary}`}>Add Manually</p>
                  <p className={`text-xs mb-3 ${t.textMuted}`}>For non-LeetCode problems.</p>
                  <form className="flex flex-col gap-2" onSubmit={handleAddSolve}>
                    <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Problem title"
                      className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${t.input}`} />
                    <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                      placeholder="URL (optional)"
                      className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${t.input}`} />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.diff} onChange={e => setForm(p => ({ ...p, diff: e.target.value as Difficulty }))}
                        className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${t.select}`}>
                        <option>Easy</option><option>Medium</option><option>Hard</option>
                      </select>
                      <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                        placeholder="Tags: dp, tree"
                        className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${t.input}`} />
                    </div>
                    <textarea value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                      placeholder="Paste your C++ code here (optional)"
                      rows={6}
                      className={`rounded-lg border px-3 py-2 text-xs font-mono outline-none transition resize-y ${t.input}`} />
                    <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
                      className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${t.select}`}>
                      <option value="cpp">C++</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="javascript">JavaScript</option>
                    </select>
                    {formErr && <p className="text-xs text-red-400">{formErr}</p>}
                    <button type="submit" className="rounded-lg bg-indigo-500 py-2 text-xs font-semibold text-white hover:bg-indigo-400 transition">
                      Save + Schedule Revisions
                    </button>
                  </form>
                </div>

                {/* Schedule info */}
                <div className={`rounded-xl border p-4 ${t.card}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${t.textFaint}`}>Spaced Repetition</p>
                  <div className="flex gap-2">
                    {DEFAULT_INTERVALS.map((iv, i) => (
                      <div key={i} className={`flex flex-1 flex-col items-center rounded-lg py-2 ${lightMode ? "bg-zinc-100" : "bg-white/5"}`}>
                        <span className={`text-[10px] ${t.textFaint}`}>S{i+1}</span>
                        <span className={`text-sm font-bold ${t.textPrimary}`}>{iv.dayOffset}d</span>
                      </div>
                    ))}
                  </div>
                  <p className={`mt-3 text-[11px] ${t.textFaint}`}>
                    {solves.length} tracked · {todayRevisions.length} today · {upcoming.length} upcoming
                  </p>
                </div>

                {/* Database Usage */}
                {dbUsage && (
                  <div className={`rounded-xl border p-4 ${lightMode ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200" : "bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${lightMode ? "text-blue-900" : "text-blue-300"}`}>
                        💾 Storage Usage
                      </p>
                      <span className={`text-[10px] font-medium ${lightMode ? "text-blue-700" : "text-blue-400"}`}>
                        Free Tier
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className={lightMode ? "text-blue-800" : "text-blue-200"}>
                          {dbUsage?.storage?.usedMB || 0} MB used
                        </span>
                        <span className={lightMode ? "text-blue-600" : "text-blue-300"}>
                          {dbUsage?.storage?.usedPercentage || 0}%
                        </span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${lightMode ? "bg-blue-200" : "bg-blue-900/30"}`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            (dbUsage?.storage?.usedPercentage || 0) > 80 ? "bg-red-500" :
                            (dbUsage?.storage?.usedPercentage || 0) > 50 ? "bg-yellow-500" :
                            "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(dbUsage?.storage?.usedPercentage || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className={`grid grid-cols-2 gap-2 text-[11px] ${lightMode ? "text-blue-800" : "text-blue-200"}`}>
                      <div>
                        <p className={lightMode ? "text-blue-600" : "text-blue-400"}>Problems Stored</p>
                        <p className="font-bold text-sm">{(dbUsage?.capacity?.currentProblems || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className={lightMode ? "text-blue-600" : "text-blue-400"}>Can Store More</p>
                        <p className="font-bold text-sm">{(dbUsage?.capacity?.remainingProblems || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    <p className={`mt-3 text-[10px] ${lightMode ? "text-blue-700" : "text-blue-300"}`}>
                      {(dbUsage?.storage?.remainingMB || 0).toFixed(0)} MB remaining of 500 MB free tier
                    </p>
                  </div>
                )}
              </div>

              {/* ── Col 2: Today's queue ── */}
              <div className="flex flex-col gap-4">
                <div className={`rounded-xl border p-6 ${t.card}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-lg font-semibold tracking-tight ${lightMode ? "text-gray-900" : "text-[#fafafa]"}`}>Today&apos;s Revision Queue</h3>
                    <div className="flex items-center gap-2">
                      {pending.length > 0 && (
                        <button onClick={() => setShowRevisionMode(true)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#d4d4d8] hover:bg-[#3f3f46]"}`}>
                          Revision Mode
                        </button>
                      )}
                      {pending.length > 0 && (
                        <button onClick={async () => {
                          let phone = localStorage.getItem("wa_phone") || "";
                          let apiKey = localStorage.getItem("wa_apikey") || "";
                          if (!phone) {
                            phone = prompt("Enter your WhatsApp number (with country code, e.g. 919876543210):") || "";
                            if (!phone) return;
                            localStorage.setItem("wa_phone", phone);
                          }
                          if (!apiKey) {
                            apiKey = prompt("CallMeBot API key (one-time setup):\n\n1. Add +34 611 01 16 37 to contacts\n2. Send 'I allow callmebot to send me messages' on WhatsApp\n3. Enter the API key you receive:") || "";
                            if (!apiKey) return;
                            localStorage.setItem("wa_apikey", apiKey);
                          }
                          const messages = pending.slice(0, 7).map((item, i) => {
                            const solve = solves.find(s => s.id === item.solveId);
                            const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
                            const snippet = code ? code.split("\n").slice(0, 20).join("\n") : "(no code saved)";
                            return `📖 *${i + 1}. ${item.title}*\n${item.difficulty || ""} | ${item.label}\n\n\`\`\`\n${snippet}\n\`\`\``;
                          });
                          messages.unshift(`⚔️ *Today's Revision* — ${pending.length} questions\n\n_Sending code cards automatically..._`);
                          try {
                            const res = await fetch("/api/whatsapp/send", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ phone, apiKey, messages }),
                            });
                            const data = await res.json();
                            if (data.success) alert("✅ " + (data.message || "Sent to WhatsApp!"));
                            else {
                              if (confirm("❌ " + (data.error || "Failed") + "\n\nClear saved credentials?")) {
                                localStorage.removeItem("wa_phone");
                                localStorage.removeItem("wa_apikey");
                              }
                            }
                          } catch { alert("❌ Network error"); }
                        }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#d4d4d8] hover:bg-[#3f3f46]"}`}>
                          WhatsApp
                        </button>
                      )}
                      {pending.length > 0 && (
                        <button onClick={() => {
                          const current = localStorage.getItem("wa_autosend") === "true";
                          if (!current) {
                            // Enabling — make sure credentials exist
                            let phone = localStorage.getItem("wa_phone") || "";
                            let apiKey = localStorage.getItem("wa_apikey") || "";
                            if (!phone) {
                              phone = prompt("Enter your WhatsApp number (with country code, e.g. 919876543210):") || "";
                              if (!phone) return;
                              localStorage.setItem("wa_phone", phone);
                            }
                            if (!apiKey) {
                              apiKey = prompt("CallMeBot API key:\n\n1. Add +34 611 01 16 37 to contacts\n2. Send 'I allow callmebot to send me messages'\n3. Enter the API key:") || "";
                              if (!apiKey) return;
                              localStorage.setItem("wa_apikey", apiKey);
                            }
                            localStorage.setItem("wa_autosend", "true");
                            alert("✅ Auto-send enabled! You'll get revision codes on WhatsApp daily when you open the app.");
                          } else {
                            localStorage.setItem("wa_autosend", "false");
                            alert("Auto-send disabled.");
                          }
                        }} className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${localStorage.getItem("wa_autosend") === "true" ? (lightMode ? "bg-green-100 text-green-700" : "bg-green-500/15 text-green-300") : (lightMode ? "bg-gray-100 text-gray-400" : "bg-[#27272a] text-[#71717a]")}`} title="Toggle daily auto-send">
                          {localStorage.getItem("wa_autosend") === "true" ? "🔔" : "🔕"}
                        </button>
                      )}
                      <span className={`text-xs ${lightMode ? "text-gray-400" : "text-[#71717a]"}`}>{todayKey}</span>
                    </div>
                  </div>
                  <p className={`text-sm mb-5 ${lightMode ? "text-gray-500" : "text-[#a1a1aa]"}`}>
                    {pending.length === 0 && done.length === 0
                      ? authStatus !== "in" ? "Sign in to see your queue." : "Nothing due today — great work!"
                      : `${pending.length} pending · ${done.length} completed`}
                  </p>

                  {/* Progress bar */}
                  {todayRevisions.length > 0 && (
                    <div className="mb-5">
                      <div className={`flex justify-between text-xs mb-2 ${lightMode ? "text-gray-500" : "text-[#a1a1aa]"}`}>
                        <span>Progress</span>
                        <span className="font-medium">{done.length}/{todayRevisions.length}</span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${lightMode ? "bg-gray-200" : "bg-[#27272a]"}`}>
                        <div className={`h-full rounded-full transition-all duration-500 ${lightMode ? "bg-gray-900" : "bg-[#fafafa]"}`}
                          style={{ width: `${todayRevisions.length > 0 ? (done.length / todayRevisions.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {pending.length === 0 && done.length === 0 && (
                      <div className={`rounded-lg border border-dashed px-4 py-6 text-center text-xs ${t.dashed}`}>
                        {authStatus === "in" ? "Sync LeetCode to populate your revision schedule." : "Sign in with Google to get started."}
                      </div>
                    )}

                    {pending.map(item => {
                      const dc = diffColor(item.difficulty);
                      return (
                        <div key={item.id} className={`group rounded-xl border p-4 transition-all ${t.revisionCard}`}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 mb-2">
                                <div className={`h-3 w-3 shrink-0 rounded-full ${dc.dot}`} />
                                <p className={`truncate text-base font-semibold leading-tight ${lightMode ? "text-gray-900" : "text-[#fafafa]"}`}>{item.title}</p>
                              </div>
                              <div className="flex items-center gap-1.5 ml-5 flex-wrap">
                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${lightMode ? "bg-gray-100 text-gray-600" : "bg-[#27272a] text-[#d4d4d8]"}`}>
                                  {item.label}
                                </span>
                                {item.difficulty && <span className={`text-xs font-medium ${dc.text}`}>{item.difficulty}</span>}
                                {item.tags && item.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className={`rounded-md px-1.5 py-0.5 text-xs ${lightMode ? "bg-gray-100 text-gray-500" : "bg-[#27272a] text-[#a1a1aa]"}`}>{tag}</span>
                                ))}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`block text-[10px] font-medium ${lightMode ? "text-gray-500" : "text-[#7d8590]"}`}>
                                {formatDate(item.dueOn)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {item.sourceUrl && (
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer"
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#e4e4e7] hover:bg-[#3f3f46]"}`}>
                                LeetCode ↗
                              </a>
                            )}
                            <button onClick={() => markRevision(item.id, "done")}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${lightMode ? "bg-green-600 text-white hover:bg-green-700" : "bg-[#22c55e] text-[#09090b] hover:bg-[#16a34a]"}`}>
                              ✓ Done
                            </button>
                            <button onClick={() => markRevision(item.id, "failed")}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${lightMode ? "bg-gray-100 text-red-600 hover:bg-red-50" : "bg-[#27272a] text-[#f87171] hover:bg-[#3f3f46]"}`}>
                              ✗ Failed
                            </button>
                            <button onClick={() => getCardHint(item)}
                              disabled={cardAI[item.id]?.loading}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-40 ${lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#e4e4e7] hover:bg-[#3f3f46]"}`}>
                              {cardAI[item.id]?.loading ? "…" : "Hint"}
                            </button>
                            <button onClick={() => getCardSummary(item)}
                              disabled={cardAI[item.id]?.loading}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-40 ${lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#e4e4e7] hover:bg-[#3f3f46]"}`}>
                              {cardAI[item.id]?.loading ? "…" : "Summary"}
                            </button>
                            <button onClick={() => setRevisionCodePreview(revisionCodePreview === item.id ? null : item.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${revisionCodePreview === item.id ? (lightMode ? "bg-gray-900 text-white" : "bg-[#fafafa] text-[#09090b]") : (lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#e4e4e7] hover:bg-[#3f3f46]")}`}>
                              {revisionCodePreview === item.id ? "Close" : "Code"}
                            </button>
                            <button onClick={() => {
                              const solve = solves.find(s => s.id === item.solveId);
                              const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
                              const lang = solve?.language || learnEntries.find(e => e.title === item.title)?.language || "cpp";
                              const snippet = code ? code.split("\n").slice(0, 20).join("\n") : "(no code saved)";
                              const text = `📖 *${item.title}*\n${item.difficulty || ""} | ${item.label}\n\n\`\`\`${lang}\n${snippet}\n\`\`\``;
                              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                            }}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${lightMode ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-[#27272a] text-[#e4e4e7] hover:bg-[#3f3f46]"}`}>
                              📱 Share
                            </button>
                          </div>
                          {/* Code Preview */}
                          {revisionCodePreview === item.id && (() => {
                            const solve = solves.find(s => s.id === item.solveId);
                            const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
                            const lang = solve?.language || learnEntries.find(e => e.title === item.title)?.language || "cpp";
                            if (!code) return (
                              <div className={`mt-3 rounded-xl border p-3 ${lightMode ? "border-gray-200 bg-gray-50" : "border-[#30363d] bg-[#161b22]"}`}>
                                {addCodeForRevision === item.id ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <select value={addCodeLang} onChange={e => setAddCodeLang(e.target.value)} className={`text-[11px] px-2 py-1 rounded-lg border ${lightMode ? "bg-white border-gray-200" : "bg-[#0d1117] border-[#30363d] text-white"}`}>
                                        <option value="cpp">C++</option><option value="java">Java</option><option value="python">Python</option><option value="javascript">JavaScript</option>
                                      </select>
                                      <span className={`text-[10px] ${lightMode ? "text-gray-400" : "text-gray-500"}`}>Paste your solution code below</span>
                                    </div>
                                    <textarea
                                      value={addCodeText}
                                      onChange={e => setAddCodeText(e.target.value)}
                                      placeholder="Paste your code here..."
                                      className={`w-full h-40 rounded-lg p-3 text-xs font-mono resize-y border ${lightMode ? "bg-white border-gray-200 text-gray-900" : "bg-[#0d1117] border-[#30363d] text-gray-200"}`}
                                      style={{ fontFamily: "'Fira Code', monospace", tabSize: 2 }}
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={async () => {
                                          if (!addCodeText.trim() || !token) return;
                                          try {
                                            // Save code to solves table
                                            await fetch("/api/solves/code", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                              body: JSON.stringify({ solveId: item.solveId, code: addCodeText, language: addCodeLang }),
                                            });
                                            // Also save to content_library if not already there
                                            const existsInLibrary = learnEntries.some(e => e.title === item.title);
                                            if (!existsInLibrary) {
                                              const topic = item.tags?.[0] || "General";
                                              const subTopic = item.tags?.[1] || null;
                                              const res = await fetch("/api/learn", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                body: JSON.stringify({
                                                  topic,
                                                  subTopic,
                                                  title: item.title,
                                                  difficulty: item.difficulty || "Medium",
                                                  codeSolution: addCodeText,
                                                  language: addCodeLang,
                                                  sourceUrl: item.sourceUrl || null,
                                                  tags: item.tags || [],
                                                }),
                                              });
                                              const data = await res.json();
                                              if (data.entry) setLearnEntries(prev => [data.entry, ...prev]);
                                            }
                                            // Update local state
                                            setSolves(prev => prev.map(s => s.id === item.solveId ? { ...s, code: addCodeText, language: addCodeLang } : s));
                                            setAddCodeForRevision(null);
                                            setAddCodeText("");
                                          } catch { /* ignore */ }
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition"
                                      >💾 Save Code</button>
                                      <button onClick={() => { setAddCodeForRevision(null); setAddCodeText(""); }} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <p className={`text-xs italic ${lightMode ? "text-gray-400" : "text-gray-500"}`}>No code found for this question.</p>
                                    <button onClick={() => { setAddCodeForRevision(item.id); setAddCodeText(""); setAddCodeLang("cpp"); }} className={`text-[11px] px-3 py-1 rounded-lg font-bold transition ${lightMode ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200" : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"}`}>
                                      + Add Code
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                            return (
                              <div className={`mt-3 rounded-xl overflow-hidden border ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                                <div className={`flex items-center justify-between px-3 py-2 text-[10px] border-b ${lightMode ? "bg-gray-50 border-gray-200 text-gray-500" : "bg-[#1a1d24] border-[#30363d] text-gray-500"}`}>
                                  <span className="font-bold">{lang.toUpperCase()} • {code.split("\n").length} lines</span>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-blue-400 transition font-bold">📋 Copy</button>
                                    <button onClick={() => setRevisionCodePreview(null)} className="hover:text-red-400 transition font-bold">✕ Close</button>
                                  </div>
                                </div>
                                <div className={`max-h-[350px] overflow-auto ${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117]"}`}>
                                  <pre className="p-3 selectable" style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: "12px", lineHeight: "20px", color: "#d4d4d4", tabSize: 2, whiteSpace: "pre" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(code, lang) }} />
                                </div>
                              </div>
                            );
                          })()}
                          {/* AI response display */}
                          {(cardAI[item.id]?.hint || cardAI[item.id]?.summary) && (
                            <div className={`mt-3 rounded-lg px-3 py-2.5 ${lightMode ? "border border-purple-200 bg-purple-50" : "border border-purple-500/20 bg-purple-500/5"}`}>
                              {cardAI[item.id]?.hint && (
                                <div className="mb-1.5">
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${lightMode ? "text-purple-600" : "text-purple-400/60"}`}>Hint</p>
                                  <p className={`text-xs leading-relaxed ${lightMode ? "text-purple-900" : "text-white/70"}`}>{cardAI[item.id].hint}</p>
                                </div>
                              )}
                              {cardAI[item.id]?.summary && (
                                <div>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${lightMode ? "text-blue-600" : "text-blue-400/60"}`}>Summary</p>
                                  <p className={`text-xs leading-relaxed whitespace-pre-line ${lightMode ? "text-blue-900" : "text-white/70"}`}>{cardAI[item.id].summary}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {done.map(item => (
                      <div key={item.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 opacity-50 ${t.rowBg}`}>
                        <div>
                          <p className={`text-sm line-through ${t.textMuted}`}>{item.title}</p>
                          <p className={`text-[11px] mt-0.5 ${t.textFaint}`}>{item.label}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${item.status === "done" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                          {item.status === "done" ? "✓ Done" : "✗ Failed"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming */}
                <div className={`rounded-xl border p-5 ${t.card}`}>
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-sm font-semibold ${t.textPrimary}`}>Upcoming Revisions</p>
                    <span className={`text-[11px] ${t.textFaint}`}>Next 7 days</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {upcoming.length === 0 ? (
                      <p className={`rounded-lg border border-dashed px-4 py-4 text-center text-xs ${t.dashed}`}>
                        No upcoming revisions.
                      </p>
                    ) : upcoming.slice(0, 10).map(item => {
                      const dc = diffColor(item.difficulty);
                      return (
                        <div key={item.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition ${t.row}`}>
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${dc.dot}`} />
                            <div className="min-w-0">
                              <p className={`truncate text-xs font-medium ${t.textPrimary}`}>{item.title}</p>
                              <p className={`text-[10px] ${t.textFaint}`}>{item.label} · {formatDate(item.dueOn)}</p>
                            </div>
                          </div>
                          <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === "overdue" ? lightMode ? "bg-yellow-100 text-yellow-700" : "bg-yellow-500/15 text-yellow-400" : lightMode ? "bg-indigo-50 text-indigo-700" : "bg-indigo-500/15 text-indigo-400"}`}>
                            {relDate(item.dueOn)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Col 3: Past 10 days activity ── */}
              {/* ── Col 3: Past 20 days activity ── */}
              <div className="flex flex-col gap-4">
                <div className={`rounded-xl border p-5 ${t.card}`}>
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-sm font-semibold ${t.textPrimary}`}>Past 20 Days</p>
                    <span className={`text-[11px] ${t.textFaint}`}>Activity</span>
                  </div>

                  {historyByDate.length === 0 ? (
                    <p className={`rounded-lg border border-dashed px-4 py-6 text-center text-xs ${t.dashed}`}>
                      No activity yet. Mark revisions to see history.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-500/20 scrollbar-track-transparent">
                      {historyByDate.map(([date, items]) => {
                        const doneCount = items.filter(i => i.status === "done").length;
                        const failedCount = items.filter(i => i.status === "failed").length;
                        const isToday = date === todayKey;
                        return (
                          <div key={date}>
                            <div className="flex items-center gap-2 mb-2">
                              <p className={`text-[11px] font-semibold ${isToday ? "text-indigo-500" : t.textMuted}`}>
                                {isToday ? "Today" : date}
                              </p>
                              <div className={`flex-1 h-px ${t.divider}`} />
                              <div className="flex gap-1.5">
                                {doneCount > 0 && <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">{doneCount} done</span>}
                                {failedCount > 0 && <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">{failedCount} failed</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              {items.map(item => {
                                const dc = diffColor(item.difficulty);
                                return (
                                  <div key={item.id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition group ${lightMode ? "hover:bg-zinc-100" : "hover:bg-white/[0.03]"}`}>
                                    <span className={`shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${stageStyle(item.status)}`}>
                                      {stageIcon(item.status)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      {item.sourceUrl ? (
                                        <a href={item.sourceUrl} target="_blank" rel="noreferrer"
                                          className={`block truncate text-xs font-medium hover:text-indigo-500 transition ${t.textPrimary}`}>
                                          {item.title}
                                        </a>
                                      ) : (
                                        <p className={`truncate text-xs font-medium ${t.textPrimary}`}>{item.title}</p>
                                      )}
                                      <p className="text-[10px] text-white/25">Stage {item.stage}{item.difficulty ? ` · ` : ""}<span className={item.difficulty ? dc.text : ""}>{item.difficulty ?? ""}</span></p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                PATTERN BROWSER — Beautiful Topic-wise Revision Access
            ════════════════════════════════════════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className={`mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border overflow-hidden ${lightMode ? "bg-white/90 border-gray-200 shadow-xl" : "bg-[#161b22]/90 border-[#30363d] shadow-2xl"}`}
            >
              {/* Header */}
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b ${lightMode ? "border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50" : "border-[#30363d] bg-gradient-to-r from-indigo-500/10 to-purple-500/10"}`}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <motion.div 
                    className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl ${lightMode ? "bg-gradient-to-br from-indigo-500 to-purple-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"}`}
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <span className="text-xl sm:text-2xl">🎯</span>
                  </motion.div>
                  <div>
                    <h2 className={`text-base sm:text-lg font-black ${t.textPrimary}`}>Pattern Browser</h2>
                    <p className={`text-xs sm:text-sm ${t.textMuted}`}>{patternStats.length} patterns</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                  <button 
                    onClick={() => setPatternView("grid")}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${patternView === "grid" ? (lightMode ? "bg-indigo-500 text-white" : "bg-indigo-500 text-white") : (lightMode ? "bg-gray-100 text-gray-600" : "bg-white/10 text-white/60")}`}
                  >
                    ⊞
                  </button>
                  <button 
                    onClick={() => setPatternView("list")}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${patternView === "list" ? (lightMode ? "bg-indigo-500 text-white" : "bg-indigo-500 text-white") : (lightMode ? "bg-gray-100 text-gray-600" : "bg-white/10 text-white/60")}`}
                  >
                    ☰
                  </button>
                </div>
              </div>

              {/* Pattern Grid/List */}
              <div className={`p-3 sm:p-6 ${lightMode ? "bg-gray-50/50" : "bg-[#0d1117]/50"}`}>
                {patternStats.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-4xl sm:text-6xl mb-3 sm:mb-4"
                    >
                      🎯
                    </motion.div>
                    <p className={`text-base sm:text-lg font-bold mb-2 ${t.textPrimary}`}>No patterns yet!</p>
                    <p className={`text-xs sm:text-sm ${t.textMuted}`}>Sync LeetCode to see breakdown</p>
                  </div>
                ) : patternView === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
                    {patternStats.slice(0, 15).map((pattern, idx) => {
                      const isSelected = selectedPattern === pattern.tag;
                      const gradient = patternGradients[idx % patternGradients.length];
                      const completionRate = pattern.count > 0 ? Math.round((pattern.completed / pattern.count) * 100) : 0;
                      
                      return (
                        <motion.button
                          key={pattern.tag}
                          onClick={() => setSelectedPattern(isSelected ? null : pattern.tag)}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ scale: 1.03, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative group overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-5 text-left transition-all ${
                            isSelected 
                              ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent" 
                              : ""
                          } ${lightMode ? "bg-white shadow-lg hover:shadow-xl" : "bg-[#161b22] shadow-xl hover:shadow-2xl border border-[#30363d]"}`}
                        >
                          {/* Gradient accent */}
                          <div className={`absolute top-0 left-0 right-0 h-1 sm:h-1.5 bg-gradient-to-r ${gradient}`} />
                          
                          {/* Icon + Name */}
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                            <motion.span 
                              className="text-xl sm:text-3xl"
                              animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ duration: 0.5 }}
                            >
                              {getPatternIcon(pattern.tag)}
                            </motion.span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs sm:text-sm font-bold truncate capitalize ${t.textPrimary}`}>{pattern.tag}</p>
                              <p className={`text-[10px] sm:text-xs ${t.textMuted}`}>{pattern.count}</p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mb-2 sm:mb-3">
                            <div className={`h-1.5 sm:h-2 rounded-full overflow-hidden ${lightMode ? "bg-gray-200" : "bg-white/10"}`}>
                              <motion.div 
                                className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${completionRate}%` }}
                                transition={{ duration: 1, delay: idx * 0.05 }}
                              />
                            </div>
                            <p className={`text-[9px] sm:text-[10px] mt-1 ${t.textFaint}`}>{completionRate}%</p>
                          </div>

                          {/* Difficulty breakdown - hidden on very small screens */}
                          <div className="hidden sm:flex gap-1.5 sm:gap-2">
                            {pattern.easy > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold bg-green-500/15 text-green-500">
                                {pattern.easy}E
                              </span>
                            )}
                            {pattern.medium > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold bg-yellow-500/15 text-yellow-500">
                                {pattern.medium}M
                              </span>
                            )}
                            {pattern.hard > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold bg-red-500/15 text-red-500">
                                {pattern.hard}H
                              </span>
                            )}
                          </div>

                          {/* Selection indicator */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 sm:top-3 sm:right-3 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-indigo-500 flex items-center justify-center"
                            >
                              <span className="text-[10px] sm:text-xs text-white">✓</span>
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  /* List View */
                  <div className="flex flex-col gap-2">
                    {patternStats.map((pattern, idx) => {
                      const isSelected = selectedPattern === pattern.tag;
                      const gradient = patternGradients[idx % patternGradients.length];
                      const completionRate = pattern.count > 0 ? Math.round((pattern.completed / pattern.count) * 100) : 0;
                      
                      return (
                        <motion.button
                          key={pattern.tag}
                          onClick={() => setSelectedPattern(isSelected ? null : pattern.tag)}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          whileHover={{ x: 4 }}
                          className={`flex items-center gap-4 rounded-xl p-4 text-left transition-all ${
                            isSelected 
                              ? (lightMode ? "bg-indigo-50 border-2 border-indigo-500" : "bg-indigo-500/15 border-2 border-indigo-500")
                              : (lightMode ? "bg-white border border-gray-200 hover:border-gray-300" : "bg-[#161b22] border border-[#30363d] hover:border-[#484f58]")
                          }`}
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
                            <span className="text-2xl">{getPatternIcon(pattern.tag)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <p className={`text-sm font-bold capitalize ${t.textPrimary}`}>{pattern.tag}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${lightMode ? "bg-gray-100 text-gray-600" : "bg-white/10 text-white/60"}`}>
                                {pattern.count} problems
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${lightMode ? "bg-gray-200" : "bg-white/10"}`}>
                                <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${completionRate}%` }} />
                              </div>
                              <span className={`text-xs font-semibold ${t.textMuted}`}>{completionRate}%</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-green-500/15 text-green-500">{pattern.easy}E</span>
                            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-yellow-500/15 text-yellow-500">{pattern.medium}M</span>
                            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-500">{pattern.hard}H</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Pattern Detail Panel */}
              <AnimatePresence>
                {selectedPattern && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`border-t overflow-hidden ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}
                  >
                    <div className={`p-6 ${lightMode ? "bg-gradient-to-r from-indigo-50/50 to-purple-50/50" : "bg-gradient-to-r from-indigo-500/5 to-purple-500/5"}`}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getPatternIcon(selectedPattern)}</span>
                          <div>
                            <h3 className={`text-lg font-black capitalize ${t.textPrimary}`}>{selectedPattern}</h3>
                            <p className={`text-sm ${t.textMuted}`}>
                              {patternStats.find(p => p.tag === selectedPattern)?.count || 0} problems • 
                              {patternRevisions.length} pending revisions
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedPattern(null)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold ${lightMode ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-white/10 text-white/60 hover:bg-white/15"}`}
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Problems for this pattern */}
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {patternStats.find(p => p.tag === selectedPattern)?.problems.slice(0, 9).map((problem, idx) => {
                          const dc = diffColor(problem.difficulty);
                          const allDone = problem.revisionStages.every(r => r.status === "done");
                          const nextRevision = problem.revisionStages.find(r => r.status === "scheduled" || r.status === "overdue");
                          
                          return (
                            <motion.div
                              key={problem.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`rounded-xl border p-4 ${lightMode ? "bg-white border-gray-200" : "bg-[#161b22] border-[#30363d]"} ${allDone ? "opacity-60" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={`h-2 w-2 rounded-full ${dc.dot}`} />
                                    {problem.sourceUrl ? (
                                      <a href={problem.sourceUrl} target="_blank" rel="noreferrer" 
                                        className={`text-sm font-semibold truncate hover:text-indigo-500 transition ${t.textPrimary}`}>
                                        {problem.title}
                                      </a>
                                    ) : (
                                      <p className={`text-sm font-semibold truncate ${t.textPrimary}`}>{problem.title}</p>
                                    )}
                                  </div>
                                  <p className={`text-xs ${dc.text}`}>{problem.difficulty}</p>
                                </div>
                                {allDone && <span className="text-green-500 text-lg">✓</span>}
                              </div>
                              
                              {/* Revision stages */}
                              <div className="flex gap-1.5 mb-3">
                                {[1, 2, 3].map(n => {
                                  const stage = problem.revisionStages.find(r => r.stage === n);
                                  return (
                                    <div key={n} className={`flex-1 h-1.5 rounded-full ${
                                      stage?.status === "done" ? "bg-green-500" :
                                      stage?.status === "failed" ? "bg-red-500" :
                                      stage?.status === "overdue" ? "bg-yellow-500" :
                                      stage?.status === "scheduled" ? (lightMode ? "bg-indigo-200" : "bg-indigo-500/30") :
                                      (lightMode ? "bg-gray-200" : "bg-white/10")
                                    }`} />
                                  );
                                })}
                              </div>

                              {/* Next revision info */}
                              {nextRevision && (
                                <p className={`text-[11px] ${nextRevision.status === "overdue" ? "text-yellow-500" : t.textFaint}`}>
                                  {nextRevision.status === "overdue" ? "⚠️ Overdue" : `📅 ${relDate(nextRevision.dueOn)}`} • Stage {nextRevision.stage}
                                </p>
                              )}
                              {!nextRevision && allDone && (
                                <p className="text-[11px] text-green-500">✓ All revisions complete!</p>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Show more button */}
                      {(patternStats.find(p => p.tag === selectedPattern)?.problems.length || 0) > 9 && (
                        <div className="text-center mt-4">
                          <button 
                            onClick={() => { setFTag(selectedPattern); setTab("questions"); }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${lightMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-500 text-white hover:bg-indigo-400"}`}
                          >
                            View all {patternStats.find(p => p.tag === selectedPattern)?.count} problems →
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </div>
        )}


        {/* ════════════════════════════════════════════════════════════════
            QUESTION LIST TAB - LeetCode Style
        ════════════════════════════════════════════════════════════════ */}
        {tab === "questions" && (
          <div className="flex flex-col gap-3 sm:gap-5">

            {/* Toolbar - responsive */}
            <div className={`rounded-xl border p-3 sm:p-4 ${lightMode ? "bg-white border-zinc-200" : "bg-[#1c1c1c] border-white/[0.08]"}`}>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex flex-wrap gap-2">
                  <input value={fSearch} onChange={e => setFSearch(e.target.value)}
                    placeholder="🔍 Search…"
                    className={`w-full sm:w-40 lg:w-52 rounded-lg border px-3 py-2 text-xs sm:text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400" : "bg-[#282828] border-white/10 text-white placeholder:text-white/40"}`} />
                  <div className="flex gap-2 flex-1 sm:flex-initial">
                    <select value={fDiff} onChange={e => setFDiff(e.target.value as typeof fDiff)}
                      className={`flex-1 sm:flex-initial rounded-lg border px-2 sm:px-3 py-2 text-xs sm:text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900" : "bg-[#282828] border-white/10 text-white"}`}>
                      <option value="All">Difficulty</option>
                      <option>Easy</option><option>Medium</option><option>Hard</option>
                    </select>
                    <select value={fTag} onChange={e => setFTag(e.target.value)}
                      className={`flex-1 sm:flex-initial rounded-lg border px-2 sm:px-3 py-2 text-xs sm:text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900" : "bg-[#282828] border-white/10 text-white"}`}>
                      <option value="">Topic</option>
                      {allTags.map(tg => <option key={tg}>{tg}</option>)}
                    </select>
                  </div>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value as typeof fStatus)}
                    className={`hidden sm:block rounded-lg border px-3 py-2 text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900" : "bg-[#282828] border-white/10 text-white"}`}>
                    <option value="All">All Status</option>
                    <option value="complete">✓ Done</option>
                    <option value="in-progress">⏳ In Progress</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 justify-between sm:justify-end">
                  <span className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold ${lightMode ? "bg-zinc-100 text-zinc-700" : "bg-white/5 text-white/60"}`}>
                    {filtered.length}
                  </span>
                  <button onClick={() => exportCSV(filtered)}
                    className={`rounded-lg border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${lightMode ? "border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "border-white/10 text-white/70 hover:bg-white/5"}`}>
                    ↓
                  </button>
                  <button onClick={handleSync} disabled={syncing}
                    className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition disabled:opacity-40 ${lightMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-500 text-white hover:bg-indigo-400"}`}>
                    {syncing ? "…" : "↻"}
                  </button>
                </div>
              </div>
            </div>

            {/* LeetCode-style List - responsive */}
            <div className={`rounded-xl border overflow-hidden ${lightMode ? "border-zinc-200" : "border-white/[0.08]"}`}>
              {filtered.length === 0 ? (
                <div className={`p-8 sm:p-12 text-center ${lightMode ? "bg-white" : "bg-[#1c1c1c]"}`}>
                  <p className={`text-xs sm:text-sm font-medium ${lightMode ? "text-zinc-500" : "text-white/40"}`}>
                    {solves.length === 0 ? "No problems yet. Sync LeetCode." : "No matches."}
                  </p>
                </div>
              ) : filtered.map((solve, idx) => {
                const allDone = solve.revisionStages.length > 0 && solve.revisionStages.every(r => r.status === "done");
                const inProgress = solve.revisionStages.some(r => r.status === "done") && !allDone;
                const dc = diffColor(solve.difficulty);
                const isEven = idx % 2 === 0;
                
                // Format last solved date like "May 9"
                const formatLastSolved = (date: string | null) => {
                  if (!date) return null;
                  const d = new Date(date);
                  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  return `${months[d.getMonth()]} ${d.getDate()}`;
                };
                
                return (
                  <div key={solve.id} className={`group flex items-center border-b px-3 sm:px-5 py-2.5 sm:py-3 transition-colors ${lightMode ? "border-zinc-200 hover:bg-zinc-100" : "border-white/[0.08] hover:bg-[#2d2d2d]"} ${isEven ? (lightMode ? "bg-zinc-100/60" : "bg-[#262626]") : (lightMode ? "bg-white" : "bg-[#1a1a1a]")} ${allDone ? "opacity-50" : ""}`}>
                    
                    {/* Serial Number - hidden on mobile */}
                    <div className={`hidden sm:block w-12 shrink-0 text-sm ${lightMode ? "text-zinc-500" : "text-white/40"}`}>
                      {idx + 1}
                    </div>

                    {/* Status Icon */}
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      {allDone && <span className={`text-base ${lightMode ? "text-green-600" : "text-green-500"}`} title="All revisions complete">✓</span>}
                      {inProgress && <span className="text-base text-yellow-500" title="Revisions in progress">⏳</span>}
                    </div>
                    
                    {/* Problem Title */}
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                      <div className="flex items-center gap-2">
                        {solve.sourceUrl ? (
                          <a href={solve.sourceUrl} target="_blank" rel="noreferrer"
                            className={`text-xs sm:text-sm font-medium hover:text-indigo-500 transition truncate ${lightMode ? "text-zinc-900" : "text-white"}`}>
                            {solve.title}
                          </a>
                        ) : (
                          <span className={`text-xs sm:text-sm font-medium truncate ${lightMode ? "text-zinc-900" : "text-white"}`}>{solve.title}</span>
                        )}
                      </div>
                      {/* Mobile: show difficulty inline */}
                      <div className="sm:hidden flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-medium ${dc.text}`}>{solve.difficulty}</span>
                        {solve.tags.slice(0, 2).map(tag => (
                          <span key={tag} className={`rounded px-1.5 py-0.5 text-[10px] ${lightMode ? "bg-zinc-100 text-zinc-600" : "bg-white/5 text-white/50"}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Tags - hidden on mobile */}
                    <div className="hidden lg:flex w-80 shrink-0 items-center gap-1.5 pr-4">
                      {solve.tags.length > 0 ? (
                        <>
                          {solve.tags.slice(0, 3).map(tag => (
                            <span key={tag} className={`rounded px-2 py-0.5 text-xs ${lightMode ? "bg-zinc-100 text-zinc-600" : "bg-white/5 text-white/50"}`}>
                              {tag}
                            </span>
                          ))}
                          {solve.tags.length > 3 && (
                            <span className={`text-xs ${lightMode ? "text-zinc-400" : "text-white/30"}`}>+{solve.tags.length - 3}</span>
                          )}
                        </>
                      ) : (
                        <span className={`text-xs ${lightMode ? "text-zinc-300" : "text-white/20"}`}>—</span>
                      )}
                    </div>
                    
                    {/* Difficulty - hidden on mobile */}
                    <div className="hidden sm:block w-20 lg:w-24 shrink-0 text-center">
                      <span className={`text-xs sm:text-sm font-medium ${dc.text}`}>
                        {solve.difficulty}
                      </span>
                    </div>

                    {/* Last Solved - hidden on small mobile */}
                    <div className="hidden md:flex w-24 lg:w-28 shrink-0 justify-center">
                      {(() => {
                        const dateToShow = solve.lastSolvedAt || solve.solvedOn;
                        if (dateToShow) {
                          const d = new Date(dateToShow);
                          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                          const formattedDate = `${months[d.getMonth()]} ${d.getDate()}`;
                          return (
                            <span className={`inline-block rounded px-2 py-0.5 text-[10px] sm:text-xs font-medium ${lightMode ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>
                              {formattedDate}
                            </span>
                          );
                        }
                        return <span className={`text-xs ${lightMode ? "text-zinc-400" : "text-white/20"}`}>—</span>;
                      })()}
                    </div>
                    
                    {/* Revision Stages */}
                    <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 shrink-0">
                      {[1,2,3].map(n => {
                        const stage = solve.revisionStages.find(r => r.stage === n);
                        return (
                          <div key={n} className="flex flex-col items-center gap-0.5 sm:gap-1">
                            {stage ? (
                              <>
                                <span className={`inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold ring-1 ${stageStyle(stage.status)}`}
                                  title={`Stage ${n} · ${formatDate(stage.dueOn)} · ${stage.status}`}>
                                  {stageIcon(stage.status)}
                                </span>
                                <span className={`text-[10px] font-medium ${lightMode ? "text-zinc-600" : "text-white/50"}`}>
                                  {(() => {
                                    const d = new Date(stage.dueOn);
                                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                    return `${months[d.getMonth()]} ${d.getDate()}`;
                                  })()}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${lightMode ? "bg-zinc-100 text-zinc-400" : "bg-white/5 text-white/20"}`}>
                                  —
                                </span>
                                <span className={`text-[10px] ${lightMode ? "text-zinc-400" : "text-white/25"}`}>—</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ANALYSIS TAB — AI-powered insights + streak
            Requires GEMINI_API_KEY in .env.local
            Get free key: https://aistudio.google.com/app/apikey
        ════════════════════════════════════════════════════════════════ */}
        {tab === "analysis" && (
          <div className="flex flex-col gap-5 max-w-3xl mx-auto">

            {/* Streak hero */}
            <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-6 text-center">
              <p className="text-5xl font-black text-orange-500">{streak}</p>
              <p className={`mt-1 text-sm font-semibold ${t.textMuted}`}>day streak</p>
              <p className={`mt-2 text-xs ${t.textFaint}`}>
                {streak === 0 ? "Complete a revision today to start your streak." :
                 streak === 1 ? "Great start! Come back tomorrow to keep it going." :
                 streak < 7 ? `${7 - streak} more days to a week streak!` :
                 streak < 30 ? `${30 - streak} more days to a month streak! 🔥` :
                 "Incredible consistency! You're a DSA machine. 🏆"}
              </p>
            </div>

            {/* Today's study summary — all problems touched today */}
            <div className={`rounded-xl border p-5 ${t.card}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-semibold ${t.textPrimary}`}>Today&apos;s Problems</p>
                <span className={`text-[11px] ${t.textFaint}`}>{toDateStr(new Date())}</span>
              </div>
              {todayRevisions.length === 0 ? (
                <p className={`text-xs ${t.textFaint}`}>No revisions today yet. Complete some from the Dashboard.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {todayRevisions.map(item => {
                    const dc = diffColor(item.difficulty);
                    return (
                      <div key={item.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${t.rowBg}`}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${dc.dot}`} />
                          <div className="min-w-0">
                            <p className={`truncate text-xs font-medium ${t.textPrimary}`}>{item.title}</p>
                            <p className={`text-[10px] ${t.textFaint}`}>{item.label} · {item.difficulty}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "done" ? "bg-green-500/15 text-green-400" : item.status === "failed" ? "bg-red-500/15 text-red-400" : "bg-white/5 text-white/40"}`}>
                            {item.status}
                          </span>
                          <button
                            onClick={() => getCardSummary(item)}
                            disabled={cardAI[item.id]?.loading}
                            className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition disabled:opacity-40">
                            {cardAI[item.id]?.loading ? "…" : "📖 Full Summary"}
                          </button>
                          <button
                            onClick={() => getCardHint(item)}
                            disabled={cardAI[item.id]?.loading}
                            className="rounded-lg bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition disabled:opacity-40">
                            {cardAI[item.id]?.loading ? "…" : "💡 Hint"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily plan */}
            <div className={`rounded-xl border p-5 ${t.card}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-semibold ${t.textPrimary}`}>Today&apos;s AI Plan</p>
                <button onClick={() => token && loadAnalysis(token)} disabled={analysisLoading}
                  className={`rounded-lg border px-3 py-1 text-[11px] disabled:opacity-40 transition ${lightMode ? "border-zinc-200 text-zinc-500 hover:bg-zinc-50" : "border-white/10 text-white/50 hover:bg-white/5"}`}>
                  {analysisLoading ? "Loading…" : "↻ Refresh"}
                </button>
              </div>
              {aiPlan ? (
                <p className={`text-sm leading-relaxed ${t.textMuted}`}>{aiPlan}</p>
              ) : (
                <p className={`text-xs ${t.textFaint}`}>
                  {analysisLoading ? "Generating your plan…" : "Click Refresh to generate your daily plan."}
                </p>
              )}
            </div>

            {/* Weak areas */}
            <div className={`rounded-xl border p-5 ${t.card}`}>
              <p className={`text-sm font-semibold mb-3 ${t.textPrimary}`}>Weak Area Analysis</p>
              {aiAnalysis ? (
                <p className={`text-sm leading-relaxed ${t.textMuted}`}>{aiAnalysis}</p>
              ) : (
                <p className={`text-xs ${t.textFaint}`}>
                  {analysisLoading ? "Analyzing your revision history…" : "Click Refresh above to analyze your weak areas."}
                </p>
              )}
            </div>

            {/* Setup instructions — only show if AI not working */}
            {!aiPlan && !analysisLoading && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                <p className="text-sm font-semibold text-indigo-400 mb-2">⚠️ AI Not Working?</p>
                <p className={`text-xs mb-3 ${t.textMuted}`}>
                  Make sure your key is from <strong className="text-white/70">Google AI Studio</strong>, not Google Cloud Console.
                  Google Cloud keys have limit:0 on free tier.
                </p>
                <ol className={`flex flex-col gap-1.5 text-xs list-decimal list-inside ${t.textMuted}`}>
                  <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">aistudio.google.com/app/apikey</a></li>
                  <li>Click &quot;Create API key in new project&quot;</li>
                  <li>Copy the key (starts with AIzaSy...)</li>
                  <li>Replace <code className="bg-white/10 px-1 rounded">GEMINI_API_KEY</code> in <code className="bg-white/10 px-1 rounded">.env.local</code></li>
                  <li>Stop dev server → run <code className="bg-white/10 px-1 rounded">npm run dev</code> again</li>
                </ol>
                <p className={`mt-3 text-[11px] ${t.textFaint}`}>
                  Free tier: 1,500 requests/day · 15 req/min · No credit card
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            LEARN TAB — Content Library (Personal DSA Encyclopedia)
            Store and organize problems by topic with solutions
        ════════════════════════════════════════════════════════════════ */}
        {tab === "learn" && (
          <div className={`flex flex-col md:flex-row h-[calc(100vh-140px)] sm:h-[calc(100vh-120px)] gap-0 rounded-xl overflow-hidden border ${t.card}`}>

            {/* ════ COMPILER BUTTON - Floating ════ */}
            <motion.button
              onClick={() => { 
                setShowCompiler(true); 
                if (token && learnEntries.length === 0) loadLearnEntries(token);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-2xl ${lightMode ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" : "bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600"}`}
            >
              <span className="text-lg">⚡</span>
              <span className="hidden sm:inline">Run Code</span>
            </motion.button>
            
            {/* ════ FLASH REVISION BUTTON - Floating ════ */}
            <motion.button
              onClick={() => { 
                // Open revision panel with current topic's entries or last 6 entries
                const entriesToRevise = learnEntries.slice(0, 6).map(e => e.id);
                setRevisionCards(entriesToRevise);
                setShowRevisionPanel(true);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`fixed bottom-4 right-36 sm:bottom-6 sm:right-40 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-2xl ${lightMode ? "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700" : "bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600"}`}
            >
              <span className="text-lg">🃏</span>
              <span className="hidden sm:inline">Flash Revision</span>
            </motion.button>

            {/* ════ PATTERN SHEET BUTTON - Floating ════ */}
            <motion.button
              onClick={() => setShowPatternSheet(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`fixed bottom-4 right-72 sm:bottom-6 sm:right-[320px] z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-2xl ${lightMode ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" : "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600"}`}
            >
              <span className="text-lg">📊</span>
              <span className="hidden sm:inline">Pattern Sheet</span>
            </motion.button>
            
            {/* ════════ MULTI-QUESTION FLASH REVISION PANEL ════════ */}
            <AnimatePresence>
              {showRevisionPanel && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex flex-col"
                  style={{ backgroundColor: lightMode ? "#f5f5f5" : "#08090d" }}
                >
                  {/* Header */}
                  <div className={`flex items-center gap-3 px-4 py-2.5 border-b shrink-0 ${lightMode ? "bg-white border-gray-200" : "bg-[#161b22] border-[#30363d]"}`}>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <span className="text-white text-sm">🃏</span>
                      </div>
                      <div>
                        <h2 className={`text-sm font-bold ${lightMode ? "text-gray-900" : "text-white"}`}>Flash Revision</h2>
                        <p className={`text-[10px] ${lightMode ? "text-gray-500" : "text-gray-400"}`}>{revisionCards.length} cards • Click or hover to zoom • Swipe ← →</p>
                      </div>
                    </div>
                    
                    {/* Topic filter chips */}
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none mx-3">
                      <button
                        onClick={() => {
                          const all = learnEntries.slice(0, 8).map(e => e.id);
                          setRevisionCards(all);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition ${lightMode ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"}`}
                      >All</button>
                      {[...new Set(learnEntries.map(e => e.topic))].sort().map(topic => (
                        <button
                          key={topic}
                          onClick={() => {
                            const topicEntries = learnEntries.filter(e => e.topic === topic).map(e => e.id);
                            setRevisionCards(topicEntries);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition ${lightMode ? "bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700" : "bg-white/5 text-gray-400 hover:bg-indigo-500/20 hover:text-indigo-300"}`}
                        >{topic}</button>
                      ))}
                    </div>
                    
                    {/* Search to add */}
                    <div className="relative w-48 shrink-0">
                      <input
                        placeholder="🔍 Add question..."
                        className={`w-full rounded-lg border px-3 py-1.5 text-[11px] outline-none transition focus:ring-2 ${lightMode ? "bg-gray-50 border-gray-300 text-gray-800 focus:ring-purple-200" : "bg-[#0d1117] border-[#30363d] text-white focus:ring-purple-500/30"}`}
                        onChange={(e) => {
                          const dropdown = document.getElementById("revision-search-dropdown");
                          if (dropdown) dropdown.style.display = e.target.value ? "block" : "none";
                        }}
                        onFocus={(e) => { const dropdown = document.getElementById("revision-search-dropdown"); if (dropdown && (e.target as HTMLInputElement).value) dropdown.style.display = "block"; }}
                        onBlur={() => setTimeout(() => { const dropdown = document.getElementById("revision-search-dropdown"); if (dropdown) dropdown.style.display = "none"; }, 200)}
                        id="revision-search-input"
                      />
                      <div id="revision-search-dropdown" className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto z-50 hidden ${lightMode ? "bg-white border-gray-200" : "bg-[#161b22] border-[#30363d]"}`}>
                        {learnEntries.filter(e => !revisionCards.includes(e.id)).slice(0, 8).map(entry => (
                          <button key={entry.id} onClick={() => { setRevisionCards(prev => [...prev, entry.id]); const input = document.getElementById("revision-search-input") as HTMLInputElement; if (input) input.value = ""; }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition ${lightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"}`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${entry.difficulty === "Easy" ? "bg-green-500" : entry.difficulty === "Medium" ? "bg-yellow-500" : "bg-red-500"}`} />
                            <span className="truncate font-medium">{entry.title}</span>
                            <span className={`ml-auto text-[9px] shrink-0 ${lightMode ? "text-gray-400" : "text-gray-600"}`}>{entry.topic}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {([2, 3, 4, 6] as const).map(cols => (
                        <button key={cols} onClick={() => setRevisionLayout(cols)}
                          className={`w-7 h-7 rounded-lg text-[10px] font-bold transition flex items-center justify-center ${revisionLayout === cols ? "bg-purple-500 text-white shadow" : lightMode ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
                        >{cols}</button>
                      ))}
                      <input type="range" min="180" max="500" value={revisionCardHeight} onChange={(e) => setRevisionCardHeight(Number(e.target.value))} className="w-16 h-1 accent-purple-500 cursor-pointer ml-1" />
                      <button onClick={() => setRevisionCards(prev => [...prev].sort(() => Math.random() - 0.5))} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition ${lightMode ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>🔀</button>
                      <button onClick={() => setShowRevisionPanel(false)} className={`rounded-lg p-1.5 text-base transition ${lightMode ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/10 text-white/50"}`}>✕</button>
                    </div>
                  </div>
                  
                  {/* Card grid with hover zoom */}
                  <div 
                    className="flex-1 overflow-y-auto p-4 gap-4"
                    style={{ display: "grid", gridTemplateColumns: `repeat(${revisionLayout}, 1fr)`, alignContent: "start" }}
                  >
                    {revisionCards.map((cardId) => {
                      const entry = learnEntries.find(e => e.id === cardId);
                      if (!entry) return null;
                      return (
                        <div
                          key={cardId}
                          className="relative group/card"
                          style={{ height: `${revisionCardHeight}px` }}
                        >
                          {/* Card — click to zoom (no auto hover) */}
                          <div 
                            className={`absolute inset-0 flex flex-col rounded-xl overflow-hidden border cursor-pointer transition-all duration-200 ease-out ${lightMode ? "bg-white border-gray-200 hover:border-gray-300" : "bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]"}`}
                            onClick={() => setZoomedCardId(cardId)}
                          >
                            <div className={`flex items-center justify-between px-3 py-2 shrink-0 border-b ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#09090b] border-[#27272a]"}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${entry.difficulty === "Easy" ? "bg-green-500" : entry.difficulty === "Medium" ? "bg-yellow-500" : "bg-red-500"}`} />
                                <span className={`text-xs font-medium truncate ${lightMode ? "text-gray-900" : "text-[#fafafa]"}`}>{entry.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { loadEntryIntoCompiler(entry); setShowCompiler(true); setShowRevisionPanel(false); }} className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 font-bold">▶</button>
                                <button onClick={() => navigator.clipboard.writeText(entry.code_solution)} className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold">📋</button>
                                <button onClick={() => setRevisionCards(prev => prev.filter(id => id !== cardId))} className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold">✕</button>
                              </div>
                            </div>
                            <div className={`px-3 py-0.5 text-[8px] flex items-center gap-1.5`}>
                              <span className={`px-1.5 py-0.5 rounded font-bold ${lightMode ? "bg-indigo-50 text-indigo-600" : "bg-indigo-500/15 text-indigo-400"}`}>{entry.topic}</span>
                              {entry.sub_topic && <span className={lightMode ? "text-gray-400" : "text-gray-600"}>{entry.sub_topic}</span>}
                            </div>
                            <div className={`flex-1 overflow-y-auto overflow-x-hidden ${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117]"}`}>
                              <pre className="p-3 selectable" style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: "11px", lineHeight: "18px", color: "#d4d4d4", tabSize: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(entry.code_solution, entry.language) }} />
                            </div>
                            {/* Zoom hint on hover */}
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none">
                              <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full">🔍 Click to zoom</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add card button */}
                    <motion.button
                      onClick={() => {
                        const available = learnEntries.filter(e => !revisionCards.includes(e.id));
                        if (available.length > 0) setRevisionCards(prev => [...prev, available[0].id]);
                      }}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
                        lightMode ? "border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 text-gray-400 hover:text-purple-500" : "border-[#2d333b] hover:border-purple-500/50 hover:bg-purple-500/5 text-gray-600 hover:text-purple-400"
                      }`}
                      style={{ height: `${revisionCardHeight}px` }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="text-4xl mb-2 opacity-60">+</span>
                      <span className="text-xs font-bold">Add Card</span>
                      <span className="text-[9px] mt-1 opacity-50">{learnEntries.filter(e => !revisionCards.includes(e.id)).length} available</span>
                    </motion.button>
                  </div>
                  
                  {/* ═══ CENTERED HOVER PREVIEW (appears on hover, disappears on leave) ═══ */}
                  <AnimatePresence>
                    {hoverPreviewId && !zoomedCardId && (() => {
                      const pv = learnEntries.find(e => e.id === hoverPreviewId);
                      if (!pv) return null;
                      const pvIdx = revisionCards.indexOf(hoverPreviewId!);
                      const canGoPrev = pvIdx > 0;
                      const canGoNext = pvIdx < revisionCards.length - 1;
                      return (
                        <motion.div
                          key="hover-preview"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.15 }}
                          className="fixed inset-0 z-40 flex items-center justify-center"
                          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}
                          onMouseEnter={() => {
                            // Pointer entered preview — cancel any pending close
                            if (hoverCloseTimerRef.current) { clearTimeout(hoverCloseTimerRef.current); hoverCloseTimerRef.current = null; }
                          }}
                          onMouseLeave={() => {
                            // Pointer left preview — close it
                            setHoverPreviewId(null);
                          }}
                          onClick={() => setHoverPreviewId(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setHoverPreviewId(null);
                            if (e.key === "ArrowRight" && canGoNext) setHoverPreviewId(revisionCards[pvIdx + 1]);
                            if (e.key === "ArrowLeft" && canGoPrev) setHoverPreviewId(revisionCards[pvIdx - 1]);
                          }}
                          tabIndex={0}
                          ref={(el) => { if (el) el.focus(); }}
                        >
                          {/* Left nav arrow */}
                          {canGoPrev && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setHoverPreviewId(revisionCards[pvIdx - 1]); }}
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl transition-all hover:scale-110 z-50"
                              title="Previous (← arrow key)"
                            >←</button>
                          )}
                          {/* Right nav arrow */}
                          {canGoNext && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setHoverPreviewId(revisionCards[pvIdx + 1]); }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl transition-all hover:scale-110 z-50"
                              title="Next (→ arrow key)"
                            >→</button>
                          )}
                          <div
                            className={`flex flex-col rounded-2xl overflow-hidden border-2 shadow-2xl ${lightMode ? "bg-white border-purple-300" : "bg-[#12141a] border-purple-500/50"}`}
                            style={{ width: "min(700px, 85vw)", height: "min(600px, 80vh)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className={`flex items-center gap-2 px-4 py-3 shrink-0 border-b ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#1a1d24] border-[#30363d]"}`}>
                              <span className={`w-3 h-3 rounded-full ${pv.difficulty === "Easy" ? "bg-green-500" : pv.difficulty === "Medium" ? "bg-yellow-500" : "bg-red-500"}`} />
                              <span className={`text-sm font-bold ${lightMode ? "text-gray-900" : "text-white"}`}>{pv.title}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lightMode ? "bg-indigo-50 text-indigo-600" : "bg-indigo-500/15 text-indigo-400"}`}>{pv.topic}</span>
                              <span className={`ml-auto text-[10px] ${lightMode ? "text-gray-400" : "text-gray-500"}`}>{pvIdx + 1}/{revisionCards.length} · ← → to navigate · Esc to close</span>
                            </div>
                            <div className={`flex-1 overflow-y-auto overflow-x-auto relative ${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117]"}`}>
                              <pre className="p-4 selectable" style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: "13px", lineHeight: "22px", color: "#d4d4d4", tabSize: 4, whiteSpace: "pre" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(pv.code_solution, pv.language) }} />
                              {/* Invisible left/right tap zones over code area */}
                              {canGoPrev && (
                                <div
                                  className="absolute left-0 top-0 w-1/2 h-full cursor-w-resize z-10 group/left"
                                  onClick={(e) => { e.stopPropagation(); setHoverPreviewId(revisionCards[pvIdx - 1]); }}
                                >
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/0 group-hover/left:bg-white/15 flex items-center justify-center text-white/0 group-hover/left:text-white/80 transition-all text-sm">←</div>
                                </div>
                              )}
                              {canGoNext && (
                                <div
                                  className="absolute right-0 top-0 w-1/2 h-full cursor-e-resize z-10 group/right"
                                  onClick={(e) => { e.stopPropagation(); setHoverPreviewId(revisionCards[pvIdx + 1]); }}
                                >
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/0 group-hover/right:bg-white/15 flex items-center justify-center text-white/0 group-hover/right:text-white/80 transition-all text-sm">→</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                  
                  {/* ═══ FULLSCREEN SWIPE VIEWER (like WhatsApp photos) ═══ */}
                  <AnimatePresence>
                    {zoomedCardId && (() => {
                      const zoomedEntry = learnEntries.find(e => e.id === zoomedCardId);
                      if (!zoomedEntry) return null;
                      const currentIdx = revisionCards.indexOf(zoomedCardId);
                      return (
                        <motion.div
                          key="zoom-overlay"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-50 flex items-center justify-center"
                          style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
                          onClick={() => setZoomedCardId(null)}
                          onKeyDown={(e) => { 
                            if (e.key === "Escape") setZoomedCardId(null);
                            if (e.key === "ArrowRight" && currentIdx < revisionCards.length - 1) setZoomedCardId(revisionCards[currentIdx + 1]);
                            if (e.key === "ArrowLeft" && currentIdx > 0) setZoomedCardId(revisionCards[currentIdx - 1]);
                          }}
                          onWheel={(e) => {
                            // Trackpad horizontal scroll = swipe
                            if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 50) {
                              if (e.deltaX > 0 && currentIdx < revisionCards.length - 1) setZoomedCardId(revisionCards[currentIdx + 1]);
                              if (e.deltaX < 0 && currentIdx > 0) setZoomedCardId(revisionCards[currentIdx - 1]);
                            }
                          }}
                          tabIndex={0}
                          role="dialog"
                        >
                          {/* Left arrow */}
                          {currentIdx > 0 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setZoomedCardId(revisionCards[currentIdx - 1]); }}
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition z-50"
                            >←</button>
                          )}
                          {/* Right arrow */}
                          {currentIdx < revisionCards.length - 1 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setZoomedCardId(revisionCards[currentIdx + 1]); }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition z-50"
                            >→</button>
                          )}
                          
                          {/* Card counter */}
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium z-50">
                            {currentIdx + 1} / {revisionCards.length}
                          </div>
                          
                          {/* Close */}
                          <button onClick={(e) => { e.stopPropagation(); setZoomedCardId(null); }} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition z-50">✕</button>
                          
                          {/* The zoomed card */}
                          <motion.div
                            key={zoomedCardId}
                            initial={{ opacity: 0, scale: 0.95, x: 50 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95, x: -50 }}
                            transition={{ duration: 0.2 }}
                            className={`flex flex-col rounded-2xl overflow-hidden border-2 ${lightMode ? "bg-white border-purple-300" : "bg-[#12141a] border-purple-500/40"}`}
                            style={{ width: `${zoomSize.w}px`, height: `${zoomSize.h}px`, maxWidth: "92vw", maxHeight: "88vh" }}
                            onClick={e => e.stopPropagation()}
                          >
                            {/* Header */}
                            <div className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#1a1d24] border-[#30363d]"}`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${zoomedEntry.difficulty === "Easy" ? "bg-green-500" : zoomedEntry.difficulty === "Medium" ? "bg-yellow-500" : "bg-red-500"}`} />
                                <span className={`text-base font-bold truncate ${lightMode ? "text-gray-900" : "text-white"}`}>{zoomedEntry.title}</span>
                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${lightMode ? "bg-indigo-50 text-indigo-600" : "bg-indigo-500/15 text-indigo-400"}`}>{zoomedEntry.topic}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Zoom font control */}
                                <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${lightMode ? "bg-gray-100" : "bg-white/10"}`} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => setZoomFontSize(f => Math.max(10, f - 1))} className={`px-2 py-1 rounded text-[11px] font-bold ${lightMode ? "hover:bg-gray-200 text-gray-600" : "hover:bg-white/10 text-white/70"}`}>A−</button>
                                  <span className={`px-1.5 text-[10px] font-bold ${lightMode ? "text-gray-700" : "text-white/70"}`}>{zoomFontSize}</span>
                                  <button onClick={() => setZoomFontSize(f => Math.min(28, f + 1))} className={`px-2 py-1 rounded text-[11px] font-bold ${lightMode ? "hover:bg-gray-200 text-gray-600" : "hover:bg-white/10 text-white/70"}`}>A+</button>
                                </div>
                                <button onClick={() => { loadEntryIntoCompiler(zoomedEntry); setShowCompiler(true); setShowRevisionPanel(false); setZoomedCardId(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-bold">▶ Run</button>
                                <button onClick={() => navigator.clipboard.writeText(zoomedEntry.code_solution)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold">📋 Copy</button>
                              </div>
                            </div>
                            {/* Code - full width, fully scrollable both directions */}
                            <div className={`flex-1 overflow-auto ${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117]"}`}>
                              <div className="flex min-w-min">
                                <div className="shrink-0 py-4 pl-4 pr-3 text-right select-none border-r border-white/5 sticky left-0" style={{ backgroundColor: lightMode ? "#1e1e2e" : "#0d1117" }}>
                                  {zoomedEntry.code_solution.split("\n").map((_, i) => (
                                    <div key={i} style={{ fontFamily: "'Fira Code', monospace", fontSize: `${zoomFontSize}px`, lineHeight: `${zoomFontSize + 10}px`, color: "#4b5563" }}>{i + 1}</div>
                                  ))}
                                </div>
                                <pre className="flex-1 py-4 pl-5 pr-8 selectable" style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: `${zoomFontSize}px`, lineHeight: `${zoomFontSize + 10}px`, color: "#d4d4d4", tabSize: 4, whiteSpace: "pre", letterSpacing: "0.3px" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(zoomedEntry.code_solution, zoomedEntry.language) }} />
                              </div>
                            </div>
                            {/* Resize handle corner */}
                            <div 
                              className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize opacity-40 hover:opacity-100 transition-opacity"
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingZoom("corner"); }}
                            >
                              <svg className="w-4 h-4 m-0.5 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M20 20h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2z"/></svg>
                            </div>
                          </motion.div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ════════ REVISION MODE PANEL (Gamified) ════════ */}
            <AnimatePresence>
              {showRevisionMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex flex-col"
                  style={{ backgroundColor: lightMode ? "#f8fafc" : "#0d1117" }}
                >
                  {/* Gamified Header */}
                  <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${lightMode ? "border-gray-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50" : "border-[#30363d] bg-gradient-to-r from-indigo-900/20 via-purple-900/20 to-pink-900/20"}`}>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <span className="text-3xl">⚔️</span>
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50"
                        />
                      </div>
                      <div>
                        <h2 className={`text-lg font-bold ${lightMode ? "text-gray-900" : "text-white"}`}>Revision Quest</h2>
                        <p className={`text-xs ${lightMode ? "text-gray-500" : "text-gray-400"}`}>
                          Complete revisions to earn XP • Each done = +{(() => { const baseXP = 10; return pending.length > 0 ? baseXP + (pending[0]?.difficulty === "Hard" ? 15 : pending[0]?.difficulty === "Medium" ? 10 : 5) : baseXP; })()}–{10 + 15} XP
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* XP & Level display */}
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${lightMode ? "bg-yellow-100 border border-yellow-300" : "bg-yellow-500/15 border border-yellow-500/30"}`}>
                          <span className="text-sm">⭐</span>
                          <span className={`text-sm font-bold ${lightMode ? "text-yellow-700" : "text-yellow-400"}`}>{done.length * 15} XP</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${lightMode ? "bg-purple-100 border border-purple-300" : "bg-purple-500/15 border border-purple-500/30"}`}>
                          <span className="text-sm">🏆</span>
                          <span className={`text-sm font-bold ${lightMode ? "text-purple-700" : "text-purple-400"}`}>Lv.{Math.floor(done.length / 3) + 1}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${lightMode ? "bg-orange-100 border border-orange-300" : "bg-orange-500/15 border border-orange-500/30"}`}>
                          <span className="text-sm">🔥</span>
                          <span className={`text-sm font-bold ${lightMode ? "text-orange-700" : "text-orange-400"}`}>{done.length}/{todayRevisions.length}</span>
                        </div>
                      </div>
                      {/* WhatsApp send button */}
                      <button
                        onClick={async () => {
                          // Get saved credentials from localStorage or prompt
                          let phone = localStorage.getItem("wa_phone") || "";
                          let apiKey = localStorage.getItem("wa_apikey") || "";
                          if (!phone) {
                            phone = prompt("Enter your WhatsApp number (with country code, e.g. 919876543210):") || "";
                            if (!phone) return;
                            localStorage.setItem("wa_phone", phone);
                          }
                          if (!apiKey) {
                            apiKey = prompt("Enter your CallMeBot API key:\n\nFirst time setup (free, 30 seconds):\n1. Add +34 611 01 16 37 to contacts\n2. Send 'I allow callmebot to send me messages' on WhatsApp\n3. Wait for API key reply\n\nEnter your key:") || "";
                            if (!apiKey) return;
                            localStorage.setItem("wa_apikey", apiKey);
                          }
                          // Build one message per question with code
                          const messages = pending.slice(0, 7).map((item, i) => {
                            const solve = solves.find(s => s.id === item.solveId);
                            const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
                            const snippet = code ? code.split("\n").slice(0, 25).join("\n") : "(no code saved)";
                            return `📖 *Revision ${i + 1}/${pending.length}*\n\n*${item.title}*\n${item.difficulty || ""} | ${item.label} | ${(item.tags || []).slice(0, 3).join(", ")}\n\n\`\`\`${solve?.language || "cpp"}\n${snippet}\n\`\`\``;
                          });
                          // Add summary as first message
                          messages.unshift(`⚔️ *Today's Revision Quest*\n\n${pending.length} questions to revise\n${done.length} already completed\n\n🎯 Complete all for +${pending.length * 15} XP!\n\n_Sending ${Math.min(pending.length, 7)} code cards..._`);

                          try {
                            const res = await fetch("/api/whatsapp/send", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ phone, apiKey, messages }),
                            });
                            const data = await res.json();
                            if (data.success) alert("✅ " + (data.message || "Sent to WhatsApp!"));
                            else {
                              // Clear saved credentials if failed (might be wrong)
                              if (confirm("❌ Failed: " + (data.error || "Unknown error") + "\n\nClear saved credentials and try again?")) {
                                localStorage.removeItem("wa_phone");
                                localStorage.removeItem("wa_apikey");
                              }
                            }
                          } catch { alert("❌ Network error"); }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${lightMode ? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200" : "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25"}`}
                      >
                        <span>📱</span> WhatsApp
                      </button>
                      {/* Direct wa.me share link (fallback - opens WhatsApp app directly) */}
                      <button
                        onClick={() => {
                          const summary = pending.slice(0, 5).map((item, i) => {
                            const solve = solves.find(s => s.id === item.solveId);
                            const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
                            const snippet = code ? code.split("\n").slice(0, 10).join("\n") : "(no code)";
                            return `${i + 1}. *${item.title}* (${item.difficulty || "–"})\n\`\`\`\n${snippet}\n\`\`\``;
                          }).join("\n\n");
                          const text = `📖 *Today's Revision*\n${pending.length} questions\n\n${summary}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${lightMode ? "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100" : "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/15"}`}
                        title="Opens WhatsApp directly to share"
                      >
                        <span>🔗</span> Share Link
                      </button>
                      <button onClick={() => setShowRevisionMode(false)} className={`rounded-lg p-2 text-lg transition ${lightMode ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/10 text-white/50"}`}>✕</button>
                    </div>
                  </div>

                  {/* XP Progress Bar */}
                  <div className={`px-6 py-3 border-b ${lightMode ? "border-gray-100 bg-white" : "border-[#21262d] bg-[#161b22]"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold ${lightMode ? "text-gray-500" : "text-gray-500"}`}>QUEST PROGRESS</span>
                      <div className={`flex-1 h-3 rounded-full overflow-hidden ${lightMode ? "bg-gray-200" : "bg-white/10"}`}>
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 shadow-lg"
                          initial={{ width: 0 }}
                          animate={{ width: `${todayRevisions.length > 0 ? (done.length / todayRevisions.length) * 100 : 0}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${done.length === todayRevisions.length && todayRevisions.length > 0 ? "text-green-500" : lightMode ? "text-gray-600" : "text-gray-400"}`}>
                        {done.length === todayRevisions.length && todayRevisions.length > 0 ? "🏆 COMPLETE!" : `${Math.round((done.length / Math.max(todayRevisions.length, 1)) * 100)}%`}
                      </span>
                    </div>
                    {/* Milestone badges */}
                    <div className="flex items-center gap-2 mt-2">
                      {[1, 3, 5, 7].map(milestone => (
                        <span key={milestone} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${done.length >= milestone ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : lightMode ? "bg-gray-100 text-gray-300 border border-gray-200" : "bg-white/5 text-gray-700 border border-white/5"}`}>
                          {done.length >= milestone ? "🌟" : "○"} {milestone}
                        </span>
                      ))}
                      {done.length === todayRevisions.length && todayRevisions.length > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-300 border border-yellow-500/40"
                        >
                          👑 All Clear!
                        </motion.span>
                      )}
                    </div>
                  </div>

                  {/* Scrollable revision list with code */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {pending.length === 0 ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-center py-20`}
                      >
                        <motion.span
                          className="text-6xl block mb-4"
                          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >🏆</motion.span>
                        <p className={`text-2xl font-bold ${lightMode ? "text-gray-900" : "text-white"}`}>Quest Complete!</p>
                        <p className={`text-sm mt-2 ${lightMode ? "text-gray-500" : "text-gray-400"}`}>You earned <span className="text-yellow-400 font-bold">{done.length * 15} XP</span> today. Keep the streak alive! 🔥</p>
                        <div className="mt-6 flex items-center justify-center gap-3">
                          <span className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30 font-bold text-sm">
                            Level {Math.floor(done.length / 3) + 1} Achieved
                          </span>
                        </div>
                      </motion.div>
                    ) : pending.map((item, idx) => {
                      const solve = solves.find(s => s.id === item.solveId);
                      const code = solve?.code || learnEntries.find(e => e.title === item.title)?.code_solution || "";
                      const lang = solve?.language || learnEntries.find(e => e.title === item.title)?.language || "cpp";
                      const dc = diffColor(item.difficulty || "Medium");
                      const xpReward = 10 + (item.difficulty === "Hard" ? 15 : item.difficulty === "Medium" ? 10 : 5);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`rounded-xl border overflow-hidden ${lightMode ? "border-gray-200 bg-white shadow-sm hover:shadow-md" : "border-[#30363d] bg-[#161b22] hover:border-purple-500/30"} transition-all`}
                        >
                          {/* Question header with XP badge */}
                          <div className={`flex items-center justify-between px-5 py-3 border-b ${lightMode ? "border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50" : "border-[#30363d] bg-gradient-to-r from-indigo-500/5 to-purple-500/5"}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className={`text-sm font-mono font-bold ${lightMode ? "text-indigo-400" : "text-indigo-500"}`}>#{idx + 1}</span>
                              <div className={`h-2.5 w-2.5 rounded-full ${dc.dot}`} />
                              <span className={`text-sm font-bold truncate ${lightMode ? "text-gray-900" : "text-white"}`}>{item.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lightMode ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/15 text-indigo-400"}`}>{item.label}</span>
                              {item.difficulty && <span className={`text-xs font-bold ${dc.text}`}>{item.difficulty}</span>}
                              {item.tags && item.tags.slice(0, 2).map(tag => (
                                <span key={tag} className={`rounded-full px-2 py-0.5 text-[9px] ${lightMode ? "bg-gray-100 text-gray-500" : "bg-white/5 text-gray-500"}`}>{tag}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lightMode ? "bg-yellow-100 text-yellow-700" : "bg-yellow-500/15 text-yellow-400"}`}>+{xpReward} XP</span>
                              {item.sourceUrl && (
                                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={`text-[10px] px-2 py-1 rounded-lg font-bold transition ${lightMode ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"}`}>
                                  LeetCode ↗
                                </a>
                              )}
                              <button onClick={() => markRevision(item.id, "done")} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 transition-all hover:scale-105">
                                ✓ Done (+{xpReward}XP)
                              </button>
                              <button onClick={() => markRevision(item.id, "failed")} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition">
                                ✗
                              </button>
                            </div>
                          </div>
                          {/* Code area */}
                          {code ? (
                            <div className={`${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117]"}`}>
                              <div className={`flex items-center justify-between px-4 py-1.5 text-[10px] border-b ${lightMode ? "border-gray-700/20" : "border-[#21262d]"}`}>
                                <span className="text-gray-500 font-bold">{lang.toUpperCase()} • {code.split("\n").length} lines</span>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => navigator.clipboard.writeText(code)} className="text-gray-500 hover:text-blue-400 transition font-bold">📋 Copy</button>
                                  <button onClick={() => { const text = `*${item.title}* (${item.difficulty || "–"})\n\`\`\`${lang}\n${code.split("\n").slice(0, 20).join("\n")}\n\`\`\``; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }} className="text-gray-500 hover:text-green-400 transition font-bold">📱 Share</button>
                                </div>
                              </div>
                              <pre className="p-4 overflow-x-auto selectable" style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: "12px", lineHeight: "20px", color: "#d4d4d4", tabSize: 2, whiteSpace: "pre", maxHeight: "400px", overflowY: "auto" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(code, lang) }} />
                            </div>
                          ) : (
                            <div className={`px-5 py-5 ${lightMode ? "bg-gray-50" : "bg-[#161b22]"}`}>
                              {addCodeForRevision === item.id ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold ${lightMode ? "text-gray-700" : "text-gray-300"}`}>Add your solution:</span>
                                    <select value={addCodeLang} onChange={e => setAddCodeLang(e.target.value)} className={`text-[11px] px-2 py-1 rounded-lg border ${lightMode ? "bg-white border-gray-200" : "bg-[#0d1117] border-[#30363d] text-white"}`}>
                                      <option value="cpp">C++</option><option value="java">Java</option><option value="python">Python</option><option value="javascript">JavaScript</option>
                                    </select>
                                  </div>
                                  <textarea
                                    value={addCodeText}
                                    onChange={e => setAddCodeText(e.target.value)}
                                    placeholder="Paste your code here..."
                                    className={`w-full h-48 rounded-lg p-3 text-xs font-mono resize-y border ${lightMode ? "bg-white border-gray-200 text-gray-900" : "bg-[#0d1117] border-[#30363d] text-gray-200"}`}
                                    style={{ fontFamily: "'Fira Code', monospace", tabSize: 2 }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={async () => {
                                        if (!addCodeText.trim() || !token) return;
                                        try {
                                          // Save code to solves table
                                          await fetch("/api/solves/code", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                            body: JSON.stringify({ solveId: item.solveId, code: addCodeText, language: addCodeLang }),
                                          });
                                          // Also save to content_library if not already there
                                          const existsInLibrary = learnEntries.some(e => e.title === item.title);
                                          if (!existsInLibrary) {
                                            const topic = item.tags?.[0] || "General";
                                            const subTopic = item.tags?.[1] || null;
                                            const res = await fetch("/api/learn", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                              body: JSON.stringify({
                                                topic,
                                                subTopic,
                                                title: item.title,
                                                difficulty: item.difficulty || "Medium",
                                                codeSolution: addCodeText,
                                                language: addCodeLang,
                                                sourceUrl: item.sourceUrl || null,
                                                tags: item.tags || [],
                                              }),
                                            });
                                            const data = await res.json();
                                            if (data.entry) setLearnEntries(prev => [data.entry, ...prev]);
                                          }
                                          setSolves(prev => prev.map(s => s.id === item.solveId ? { ...s, code: addCodeText, language: addCodeLang } : s));
                                          setAddCodeForRevision(null);
                                          setAddCodeText("");
                                        } catch { /* ignore */ }
                                      }}
                                      className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg transition-all hover:scale-105"
                                    >💾 Save Code</button>
                                    <button onClick={() => { setAddCodeForRevision(null); setAddCodeText(""); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-3 py-4">
                                  <span className="text-2xl opacity-40">📝</span>
                                  <p className={`text-sm ${lightMode ? "text-gray-400" : "text-gray-500"}`}>No code saved for this question yet.</p>
                                  <button onClick={() => { setAddCodeForRevision(item.id); setAddCodeText(""); setAddCodeLang("cpp"); }} className={`text-xs px-4 py-2 rounded-lg font-bold transition ${lightMode ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200" : "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20"}`}>
                                    + Add Code Now
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Completed items with XP earned */}
                    {done.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`rounded-xl border p-5 ${lightMode ? "border-green-200 bg-green-50" : "border-green-500/20 bg-green-500/5"}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className={`text-xs font-bold ${lightMode ? "text-green-700" : "text-green-400"}`}>✓ Conquered Today ({done.length})</p>
                          <span className={`text-xs font-bold ${lightMode ? "text-yellow-600" : "text-yellow-400"}`}>+{done.length * 15} XP earned</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {done.map(item => (
                            <motion.span
                              key={item.id}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${item.status === "done" ? (lightMode ? "bg-green-100 text-green-700 border border-green-300" : "bg-green-500/15 text-green-400 border border-green-500/25") : (lightMode ? "bg-red-100 text-red-700 border border-red-300" : "bg-red-500/15 text-red-400 border border-red-500/25")}`}
                            >
                              {item.status === "done" ? "⚡" : "✗"} {item.title}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ════════ PATTERN SHEET PANEL ════════ */}
            <AnimatePresence>
              {showPatternSheet && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex flex-col"
                  style={{ backgroundColor: lightMode ? "#f8fafc" : "#0d1117" }}
                >
                  {/* Header */}
                  <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${lightMode ? "border-gray-200 bg-white" : "border-[#30363d] bg-[#161b22]"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📊</span>
                      <div>
                        <h2 className={`text-lg font-bold ${lightMode ? "text-gray-900" : "text-white"}`}>Pattern Sheet</h2>
                        <p className={`text-xs ${lightMode ? "text-gray-500" : "text-gray-400"}`}>{learnEntries.length} questions · {[...new Set(learnEntries.map(e => e.topic))].length} topics · Download as Excel</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          const ExcelJS = (await import("exceljs")).default;
                          const { saveAs } = await import("file-saver");
                          const workbook = new ExcelJS.Workbook();
                          workbook.creator = "DSA Pattern Sheet";
                          workbook.created = new Date();

                          // Group entries by topic
                          const grouped: Record<string, ContentEntry[]> = {};
                          learnEntries.forEach(entry => {
                            const t = entry.topic || "Uncategorized";
                            if (!grouped[t]) grouped[t] = [];
                            grouped[t].push(entry);
                          });

                          // ═══ SUMMARY SHEET ═══
                          const summarySheet = workbook.addWorksheet("📋 Summary");
                          summarySheet.columns = [
                            { header: "", key: "num", width: 5 },
                            { header: "Topic", key: "topic", width: 35 },
                            { header: "Total", key: "count", width: 10 },
                            { header: "Easy", key: "easy", width: 10 },
                            { header: "Medium", key: "medium", width: 10 },
                            { header: "Hard", key: "hard", width: 10 },
                          ];
                          // Title row
                          summarySheet.spliceRows(1, 0, ["", "📊 DSA Pattern Sheet - Summary", "", "", "", ""]);
                          const titleRow = summarySheet.getRow(1);
                          titleRow.height = 35;
                          titleRow.font = { bold: true, size: 16, color: { argb: "FF1F2937" } };
                          summarySheet.mergeCells("B1:F1");
                          
                          // Header row (row 2)
                          const sumHeaderRow = summarySheet.getRow(2);
                          sumHeaderRow.values = ["#", "Topic", "Total", "Easy", "Medium", "Hard"];
                          sumHeaderRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
                          sumHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
                          sumHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
                          sumHeaderRow.height = 26;
                          sumHeaderRow.eachCell((cell) => {
                            cell.border = { bottom: { style: "medium", color: { argb: "FF4F46E5" } } };
                          });

                          let topicIdx = 0;
                          Object.entries(grouped).forEach(([topic, entries]) => {
                            topicIdx++;
                            const row = summarySheet.addRow({
                              num: topicIdx,
                              topic: topic,
                              count: entries.length,
                              easy: entries.filter(e => e.difficulty === "Easy").length,
                              medium: entries.filter(e => e.difficulty === "Medium").length,
                              hard: entries.filter(e => e.difficulty === "Hard").length,
                            });
                            row.height = 22;
                            row.font = { size: 11 };
                            row.alignment = { vertical: "middle" };
                            row.getCell(2).font = { bold: true, size: 11, color: { argb: "FF1F2937" } };
                            row.getCell(4).font = { size: 10, color: { argb: "FF22C55E" } };
                            row.getCell(5).font = { size: 10, color: { argb: "FFEAB308" } };
                            row.getCell(6).font = { size: 10, color: { argb: "FFEF4444" } };
                            if (topicIdx % 2 === 0) {
                              row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
                            }
                            row.eachCell((cell) => {
                              cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
                            });
                          });

                          // Total row
                          const totalRow = summarySheet.addRow({
                            num: "",
                            topic: "TOTAL",
                            count: learnEntries.length,
                            easy: learnEntries.filter(e => e.difficulty === "Easy").length,
                            medium: learnEntries.filter(e => e.difficulty === "Medium").length,
                            hard: learnEntries.filter(e => e.difficulty === "Hard").length,
                          });
                          totalRow.height = 26;
                          totalRow.font = { bold: true, size: 11 };
                          totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
                          totalRow.eachCell((cell) => {
                            cell.border = { top: { style: "medium", color: { argb: "FF6366F1" } } };
                          });

                          // ═══ TOPIC SHEETS (one per topic with proper code display) ═══
                          Object.entries(grouped).forEach(([topic, entries]) => {
                            const sheetName = topic.substring(0, 31).replace(/[\\/*?[\]]/g, "");
                            const sheet = workbook.addWorksheet(sheetName);
                            
                            // Set columns wide enough for code
                            sheet.columns = [
                              { key: "A", width: 5 },
                              { key: "B", width: 90 },
                              { key: "C", width: 14 },
                              { key: "D", width: 20 },
                            ];

                            // Topic title at top
                            sheet.addRow(["", `📁 ${topic}`, "", ""]);
                            const topicTitleRow = sheet.getRow(1);
                            topicTitleRow.height = 32;
                            topicTitleRow.getCell(2).font = { bold: true, size: 14, color: { argb: "FF4F46E5" } };
                            sheet.mergeCells("B1:D1");

                            // Spacer
                            sheet.addRow([]);

                            entries.forEach((entry, idx) => {
                              // ── Question Header Row ──
                              const qRow = sheet.addRow([
                                idx + 1,
                                `${entry.title}`,
                                entry.difficulty || "–",
                                entry.sub_topic || "–",
                              ]);
                              qRow.height = 24;
                              qRow.font = { bold: true, size: 11 };
                              qRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0FF" } };
                              qRow.alignment = { vertical: "middle" };
                              qRow.eachCell((cell) => {
                                cell.border = {
                                  top: { style: "thin", color: { argb: "FF6366F1" } },
                                  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                                };
                              });
                              // Difficulty color
                              const diffColor = entry.difficulty === "Easy" ? "FF22C55E" : entry.difficulty === "Medium" ? "FFEAB308" : "FFEF4444";
                              qRow.getCell(3).font = { bold: true, size: 10, color: { argb: diffColor } };
                              qRow.getCell(4).font = { size: 10, italic: true, color: { argb: "FF6B7280" } };

                              // ── Language + info row ──
                              const langRow = sheet.addRow(["", `Language: ${entry.language} | Lines: ${entry.code_solution.split("\n").length}`, "", ""]);
                              langRow.height = 18;
                              langRow.getCell(2).font = { size: 9, italic: true, color: { argb: "FF6B7280" } };

                              // ── Code Row (the actual code in a big cell) ──
                              const codeRow = sheet.addRow(["", entry.code_solution, "", ""]);
                              const lineCount = entry.code_solution.split("\n").length;
                              codeRow.height = Math.max(30, Math.min(lineCount * 13, 500));
                              const codeCell = codeRow.getCell(2);
                              codeCell.font = { name: "Consolas", size: 10, color: { argb: "FFD4D4D4" } };
                              codeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1E2E" } };
                              codeCell.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
                              codeCell.border = {
                                top: { style: "thin", color: { argb: "FF30363D" } },
                                bottom: { style: "thin", color: { argb: "FF30363D" } },
                                left: { style: "thin", color: { argb: "FF30363D" } },
                                right: { style: "thin", color: { argb: "FF30363D" } },
                              };
                              // Merge code cell across columns for width
                              const codeRowNum = codeRow.number;
                              sheet.mergeCells(`B${codeRowNum}:D${codeRowNum}`);

                              // Spacer between questions
                              const spacer = sheet.addRow([]);
                              spacer.height = 8;
                            });
                          });

                          const buffer = await workbook.xlsx.writeBuffer();
                          const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                          saveAs(blob, `DSA_Pattern_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg transition-all hover:scale-105"
                      >
                        <span>📥</span> Download Excel
                      </button>
                      <button
                        onClick={() => {
                          // Select all or currently visible entries for PDF
                          const entries = learnEntries;
                          if (entries.length === 0) { alert("No questions to export."); return; }
                          
                          const pw = window.open("", "_blank");
                          if (!pw) { alert("Please allow popups"); return; }

                          const pages = entries.map((entry, idx) => {
                            const code = entry.code_solution
                              .replace(/&/g, "&amp;")
                              .replace(/</g, "&lt;")
                              .replace(/>/g, "&gt;");
                            const dc = entry.difficulty === "Easy" ? "#16a34a" : entry.difficulty === "Medium" ? "#d97706" : "#dc2626";
                            return `
                              <div class="page" ${idx > 0 ? 'style="page-break-before: always;"' : ''}>
                                <div class="header">
                                  <span class="num">${idx + 1}</span>
                                  <div class="meta">
                                    <h2>${entry.title}</h2>
                                    <div class="tags">
                                      <span class="diff" style="color:${dc}">${entry.difficulty || "–"}</span>
                                      <span class="topic">${entry.topic}</span>
                                      ${entry.sub_topic ? `<span class="subtopic">${entry.sub_topic}</span>` : ""}
                                      <span class="lang">${entry.language}</span>
                                    </div>
                                  </div>
                                </div>
                                <pre class="code">${code}</pre>
                              </div>`;
                          }).join("");

                          pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>DSA Code Sheet</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #fff; }
  .cover { padding: 80px 60px; text-align: center; page-break-after: always; }
  .cover h1 { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
  .cover p { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
  .page { padding: 40px 50px; }
  .header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
  .num { font-size: 14px; font-weight: 700; color: #fff; background: #111; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .meta h2 { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
  .tags { display: flex; gap: 8px; flex-wrap: wrap; }
  .tags span { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #f3f4f6; color: #4b5563; font-weight: 500; }
  .diff { background: none !important; font-weight: 600 !important; }
  .code { font-family: 'JetBrains Mono', 'Consolas', monospace; font-size: 12px; line-height: 1.7; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; white-space: pre; overflow-x: auto; color: #1f2937; }
  @media print {
    body { background: #fff; }
    .page { padding: 30px 40px; }
    .code { font-size: 11px; border: 1px solid #d1d5db; }
  }
</style>
</head><body>
<div class="cover">
  <h1>DSA Code Sheet</h1>
  <p>${entries.length} Questions · ${[...new Set(entries.map(e => e.topic))].length} Topics</p>
  <p style="margin-top:4px;font-size:12px;color:#9ca3af;">Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
</div>
${pages}
</body></html>`);
                          pw.document.close();
                          pw.focus();
                          setTimeout(() => pw.print(), 600);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm shadow-lg transition-all hover:scale-105"
                      >
                        <span>📄</span> Download PDF
                      </button>
                      <button onClick={() => setShowPatternSheet(false)} className={`rounded-lg p-2 text-lg transition ${lightMode ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/10 text-white/50"}`}>✕</button>
                    </div>
                  </div>

                  {/* Content — grouped by topic */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {(() => {
                      const grouped: Record<string, ContentEntry[]> = {};
                      learnEntries.forEach(entry => {
                        const t = entry.topic || "Uncategorized";
                        if (!grouped[t]) grouped[t] = [];
                        grouped[t].push(entry);
                      });
                      return Object.entries(grouped).map(([topic, entries]) => (
                        <div key={topic} className={`rounded-xl border overflow-hidden ${lightMode ? "border-gray-200 bg-white shadow-sm" : "border-[#30363d] bg-[#161b22]"}`}>
                          {/* Topic header */}
                          <div className={`flex items-center justify-between px-5 py-3 border-b ${lightMode ? "border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50" : "border-[#30363d] bg-gradient-to-r from-indigo-500/10 to-purple-500/10"}`}>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-bold ${lightMode ? "text-indigo-700" : "text-indigo-400"}`}>{topic}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lightMode ? "bg-indigo-100 text-indigo-600" : "bg-indigo-500/20 text-indigo-400"}`}>{entries.length} questions</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold">
                              <span className="text-green-500">{entries.filter(e => e.difficulty === "Easy").length} Easy</span>
                              <span className="text-yellow-500">{entries.filter(e => e.difficulty === "Medium").length} Med</span>
                              <span className="text-red-500">{entries.filter(e => e.difficulty === "Hard").length} Hard</span>
                            </div>
                          </div>
                          {/* Questions table */}
                          <div className="divide-y divide-opacity-50" style={{ borderColor: lightMode ? "#e5e7eb" : "#21262d" }}>
                            {entries.map((entry, idx) => (
                              <div key={entry.id} className={`flex gap-4 px-5 py-3 transition-colors ${lightMode ? "hover:bg-gray-50" : "hover:bg-white/[0.02]"}`}>
                                <span className={`shrink-0 w-6 text-center text-xs font-mono ${lightMode ? "text-gray-400" : "text-gray-600"}`}>{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${entry.difficulty === "Easy" ? "bg-green-500" : entry.difficulty === "Medium" ? "bg-yellow-500" : "bg-red-500"}`} />
                                    <span className={`text-sm font-semibold truncate ${lightMode ? "text-gray-900" : "text-white"}`}>{entry.title}</span>
                                    {entry.sub_topic && <span className={`text-[10px] px-1.5 py-0.5 rounded ${lightMode ? "bg-gray-100 text-gray-500" : "bg-white/5 text-gray-500"}`}>{entry.sub_topic}</span>}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${lightMode ? "bg-blue-50 text-blue-600" : "bg-blue-500/10 text-blue-400"}`}>{entry.language}</span>
                                  </div>
                                  {/* Code preview — collapsible */}
                                  <details className="group">
                                    <summary className={`text-[10px] cursor-pointer select-none font-bold ${lightMode ? "text-indigo-500 hover:text-indigo-700" : "text-indigo-400 hover:text-indigo-300"}`}>
                                      👁 View Code ({entry.code_solution.split("\n").length} lines)
                                    </summary>
                                    <div className={`mt-2 rounded-lg overflow-hidden border ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                                      <div className={`flex items-center justify-between px-3 py-1.5 text-[10px] border-b ${lightMode ? "bg-gray-50 border-gray-200 text-gray-500" : "bg-[#1a1d24] border-[#30363d] text-gray-500"}`}>
                                        <span>{entry.language} • {entry.title}</span>
                                        <button onClick={() => navigator.clipboard.writeText(entry.code_solution)} className="hover:text-blue-400 transition">📋 Copy</button>
                                      </div>
                                      <pre className={`p-3 overflow-x-auto text-[11px] leading-[18px] ${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117]"}`} style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace", color: "#d4d4d4", tabSize: 2, whiteSpace: "pre" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(entry.code_solution, entry.language) }} />
                                    </div>
                                  </details>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ════ LEFT SIDEBAR - Collapsible on mobile ════ */}
            <div className={`flex ${selectedEntry ? "hidden md:flex" : "flex"} w-full md:w-64 shrink-0 flex-col border-b md:border-b-0 md:border-r max-h-[50vh] md:max-h-none ${lightMode ? "border-gray-200 bg-[#f6f8fa]" : "border-[#30363d] bg-[#0d1117]"}`}>
              {/* Sidebar header */}
              <div className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${t.textFaint}`}>Topics</span>
                <motion.button
                  onClick={() => {
                    setEditEntry(null);
                    setLearnForm({ topic:"", subTopic:"", title:"", questionText:"", difficulty:"Medium", codeSolution:"", language:"cpp", explanation:"", intuition:"", timeComplexity:"", spaceComplexity:"", tags:"", sourceUrl:"" });
                    setShowAddModal(true);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Add new entry"
                  className={`flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-white ${lightMode ? "bg-[#0969da]" : "bg-[#1f6feb]"}`}
                >+</motion.button>
              </div>

              {/* Search */}
              <div className={`px-2 sm:px-3 py-2 border-b ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                <input
                  value={learnSearch}
                  onChange={e => setLearnSearch(e.target.value)}
                  placeholder="Search..."
                  className={`w-full rounded-md border px-2 sm:px-2.5 py-1.5 text-xs outline-none transition ${t.input}`}
                />
              </div>

              {/* Topic groups + items */}
              <div className="flex-1 overflow-y-auto py-2">
                {learnLoading ? (
                  <p className={`px-4 py-3 text-xs ${t.textFaint}`}>Loading…</p>
                ) : learnEntries.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-3xl mb-2">📚</p>
                    <p className={`text-xs ${t.textFaint}`}>No entries yet.<br/>Click + to add one.</p>
                  </div>
                ) : (() => {
                  // Group entries by topic
                  const groups = new Map<string, typeof learnEntries>();
                  learnEntries.forEach(e => {
                    if (!groups.has(e.topic)) groups.set(e.topic, []);
                    groups.get(e.topic)!.push(e);
                  });
                  return Array.from(groups.entries()).map(([topic, items]) => (
                    <div key={topic}>
                      <button
                        onClick={() => setSelectedTopic(selectedTopic === topic ? "All" : topic)}
                        className={`flex w-full items-center gap-1.5 px-3 sm:px-4 py-1.5 text-left transition ${lightMode ? "hover:bg-gray-100" : "hover:bg-white/5"}`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-widest ${lightMode ? "text-gray-400" : "text-[#7d8590]"}`}>
                          {topic}
                        </span>
                        <span className={`ml-auto text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${lightMode ? "bg-gray-200 text-gray-500" : "bg-white/10 text-white/40"}`}>
                          {items.length}
                        </span>
                      </button>
                      {items.map(entry => {
                        const isActive = selectedEntry?.id === entry.id;
                        const dc = diffColor(entry.difficulty as Difficulty | undefined);
                        return (
                          <button
                            key={entry.id}
                            onClick={() => setSelectedEntry(entry)}
                            className={`flex w-full items-start gap-2 px-3 sm:px-4 py-2 text-left transition-colors ${
                              isActive
                                ? lightMode ? "bg-[#dbeafe] border-r-2 border-[#0969da]" : "bg-[#1f6feb]/20 border-r-2 border-[#1f6feb]"
                                : lightMode ? "hover:bg-gray-100" : "hover:bg-white/5"
                            }`}
                          >
                            <div className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${dc.dot}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-medium leading-tight truncate ${isActive ? (lightMode ? "text-[#0969da]" : "text-[#58a6ff]") : t.textPrimary}`}>
                                {entry.title}
                              </p>
                              {entry.sub_topic && (
                                <p className={`text-[10px] truncate ${t.textFaint}`}>{entry.sub_topic}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>

              {/* Sidebar footer: difficulty filter */}
              <div className={`border-t px-2 sm:px-3 py-2 ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                <select
                  value={learnDifficulty}
                  onChange={e => setLearnDifficulty(e.target.value)}
                  className={`w-full rounded-md border px-2 py-1.5 text-xs outline-none ${t.select}`}
                >
                  <option value="All">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            {/* ════ RIGHT CONTENT PANEL ════ */}
            <div className={`flex flex-1 flex-col overflow-hidden ${selectedEntry ? "flex" : "hidden md:flex"}`}>
              {selectedEntry ? (
                <>
                  {/* Entry header bar */}
                  <div className={`flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b px-3 sm:px-6 py-2 sm:py-3 shrink-0 ${lightMode ? "border-gray-200 bg-white" : "border-[#30363d] bg-[#161b22]"}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Back button - mobile only */}
                      <button
                        onClick={() => setSelectedEntry(null)}
                        className={`md:hidden flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${lightMode ? "bg-gray-100 text-gray-600" : "bg-white/10 text-white/60"}`}
                      >
                        ←
                      </button>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded shrink-0 ${lightMode ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/20 text-indigo-300"}`}>
                        {selectedEntry.topic}
                      </span>
                      <h2 className={`text-xs sm:text-sm font-bold truncate ${t.textPrimary}`}>{selectedEntry.title}</h2>
                      {selectedEntry.difficulty && (
                        <span className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${diffColor(selectedEntry.difficulty as Difficulty).badge}`}>
                          {selectedEntry.difficulty}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        onClick={() => toggleFavorite(selectedEntry)}
                        className={`text-sm sm:text-base transition hover:scale-110 ${selectedEntry.is_favorite ? "" : "opacity-30 hover:opacity-70"}`}
                      >{selectedEntry.is_favorite ? "⭐" : "☆"}</button>
                      <button
                        onClick={() => { handleEditLearnEntry(selectedEntry); }}
                        className={`rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition ${lightMode ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/20"}`}
                      ><span className="sm:hidden">✏️</span><span className="hidden sm:inline">✏️ Edit</span></button>
                      <button
                        onClick={() => handleDeleteLearnEntry(selectedEntry.id)}
                        className={`rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition ${lightMode ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200" : "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20"}`}
                      ><span className="sm:hidden">🗑</span><span className="hidden sm:inline">🗑 Delete</span></button>
                    </div>
                  </div>

                  {/* Entry body */}
                  <div className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 ${lightMode ? "bg-white" : "bg-[#0d1117]"}`}>

                    {/* Tags row */}
                    {selectedEntry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedEntry.tags.map(tag => (
                          <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded ${t.tag}`}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Question */}
                    {selectedEntry.question_text && (
                      <div className={`rounded-lg border p-3 sm:p-4 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161b22] border-[#30363d]"}`}>
                        <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-2 ${t.textFaint}`}>📋 Problem</p>
                        <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${t.textPrimary}`}>{selectedEntry.question_text}</p>
                      </div>
                    )}

                    {/* Intuition */}
                    {selectedEntry.intuition && (
                      <div className={`rounded-lg border p-3 sm:p-4 ${lightMode ? "bg-amber-50 border-amber-200" : "bg-yellow-500/10 border-yellow-500/20"}`}>
                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${lightMode ? "text-amber-600" : "text-yellow-400"}`}>💡 Key Insight</p>
                        <p className={`text-sm leading-relaxed whitespace-pre-line ${lightMode ? "text-amber-900" : "text-yellow-100"}`}>{selectedEntry.intuition}</p>
                      </div>
                    )}

                    {/* Explanation / Notes */}
                    {selectedEntry.explanation && (
                      <div>
                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${t.textFaint}`}>📝 Notes & Approach</p>
                        {selectedEntry.explanation.includes("<") ? (
                          /* Rich HTML notes from editor */
                          <div 
                            className={`text-sm leading-relaxed prose prose-sm max-w-none ${lightMode ? "prose-gray" : "prose-invert"} ${lightMode ? "text-gray-700" : "text-gray-200"}`}
                            dangerouslySetInnerHTML={{ __html: selectedEntry.explanation }}
                          />
                        ) : (
                          /* Plain text notes */
                          <p className={`text-sm leading-relaxed whitespace-pre-line ${t.textPrimary}`}>{selectedEntry.explanation}</p>
                        )}
                      </div>
                    )}

                    {/* Code */}
                    <div>
                      <div className={`flex items-center justify-between rounded-t-xl px-4 py-3 ${lightMode ? "bg-[#1e1e2e]" : "bg-[#161b22] border border-b-0 border-[#30363d]"}`}>
                        <div className="flex items-center gap-3">
                          {/* Macbook dots */}
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                          </div>
                          <span className="text-[12px] font-bold uppercase tracking-wider text-gray-400">
                            {selectedEntry.language === "cpp" ? "main.cpp" : selectedEntry.language === "python" ? "solution.py" : selectedEntry.language === "java" ? "Solution.java" : "solution.js"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              loadEntryIntoCompiler(selectedEntry);
                              setShowCompiler(true);
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-400 transition"
                          >▶ Run in Compiler</button>
                          <button
                            onClick={() => { navigator.clipboard.writeText(selectedEntry.code_solution); }}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 transition"
                          >📋 Copy</button>
                        </div>
                      </div>
                      <div className={`rounded-b-xl overflow-hidden ${lightMode ? "bg-[#1e1e2e]" : "bg-[#0d1117] border border-t-0 border-[#30363d]"}`}>
                        <div className="flex">
                          {/* Line numbers */}
                          <div className="shrink-0 py-4 pl-4 pr-3 text-right select-none border-r border-white/5" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                            {selectedEntry.code_solution.split("\n").map((_, i) => (
                              <div key={i} className="text-[12px] leading-[22px] text-gray-600">{i + 1}</div>
                            ))}
                          </div>
                          {/* Code content */}
                          <pre className="flex-1 py-4 pl-4 pr-4 overflow-x-auto text-[13px] leading-[22px] selectable" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", tabSize: 4, color: "#d4d4d4" }} dangerouslySetInnerHTML={{ __html: highlightCodeHtml(selectedEntry.code_solution, selectedEntry.language) }} />
                        </div>
                      </div>
                    </div>

                    {/* Complexity */}
                    {(selectedEntry.time_complexity || selectedEntry.space_complexity) && (
                      <div className={`flex gap-6 rounded-lg border p-4 ${lightMode ? "bg-green-50 border-green-200" : "bg-green-500/10 border-green-500/20"}`}>
                        <div>
                          <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${lightMode ? "text-green-600" : "text-green-400"}`}>⏱ Time</p>
                          <p className={`text-sm font-mono font-semibold ${lightMode ? "text-green-900" : "text-green-100"}`}>{selectedEntry.time_complexity ?? "—"}</p>
                        </div>
                        <div>
                          <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${lightMode ? "text-green-600" : "text-green-400"}`}>💾 Space</p>
                          <p className={`text-sm font-mono font-semibold ${lightMode ? "text-green-900" : "text-green-100"}`}>{selectedEntry.space_complexity ?? "—"}</p>
                        </div>
                      </div>
                    )}

                    {/* Source */}
                    {selectedEntry.source_url && (
                      <a href={selectedEntry.source_url} target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium underline ${lightMode ? "text-blue-600 hover:text-blue-800" : "text-blue-400 hover:text-blue-300"}`}>
                        🔗 {selectedEntry.source_url}
                      </a>
                    )}
                  </div>
                </>
              ) : (
                /* Empty state when nothing selected */
                <div className={`flex flex-1 flex-col items-center justify-center ${lightMode ? "bg-white" : "bg-[#0d1117]"}`}>
                  <div className="text-6xl mb-4">👈</div>
                  <p className={`text-base font-bold mb-1 ${t.textPrimary}`}>Select a problem</p>
                  <p className={`text-sm ${t.textMuted}`}>Pick any topic from the left sidebar</p>
                  <motion.button
                    onClick={() => {
                      setEditEntry(null);
                      setLearnForm({ topic:"", subTopic:"", title:"", questionText:"", difficulty:"Medium", codeSolution:"", language:"cpp", explanation:"", intuition:"", timeComplexity:"", spaceComplexity:"", tags:"", sourceUrl:"" });
                      setLcImportInput("");
                      setLcImportMsg(null);
                      setShowAddModal(true);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`mt-6 rounded-lg px-5 py-2.5 text-sm font-bold text-white ${lightMode ? "bg-[#0969da] hover:bg-[#0860ca]" : "bg-[#1f6feb] hover:bg-[#1a5edb]"}`}
                  >➕ Add First Entry</motion.button>
                </div>
              )}
            </div>

            {/* ════ ADD / EDIT MODAL ════ */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); setEditEntry(null); } }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] ${lightMode ? "bg-white border-gray-200" : "bg-[#13151f] border-white/10"}`}
                >
                  {/* Modal header */}
                  <div className={`flex items-center justify-between border-b px-6 py-4 shrink-0 ${lightMode ? "border-gray-100" : "border-white/[0.07]"}`}>
                    <h2 className={`text-base font-bold ${t.textPrimary}`}>{editEntry ? "✏️ Edit Entry" : "➕ Add New Entry"}</h2>
                    <button onClick={() => { setShowAddModal(false); setEditEntry(null); setLcImportInput(""); setLcImportMsg(null); }} className={`text-xl ${t.textFaint} hover:opacity-70`}>✕</button>
                  </div>

                  {/* Form — scrollable */}
                  <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">

                    {/* ── LeetCode Import Strip ── */}
                    {!editEntry && (
                      <div className={`rounded-xl border p-3 ${lightMode ? "bg-[#fff8f0] border-orange-200" : "bg-orange-500/10 border-orange-500/20"}`}>
                        <p className={`text-[11px] font-bold mb-2 ${lightMode ? "text-orange-700" : "text-orange-300"}`}>
                          ⚡ Import from LeetCode
                        </p>
                        <div className="flex gap-2">
                          <input
                            value={lcImportInput}
                            onChange={e => setLcImportInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleLcImport()}
                            placeholder="Paste URL or slug: two-sum, 3sum, https://leetcode.com/problems/…"
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs outline-none transition ${t.input}`}
                          />
                          <motion.button
                            onClick={handleLcImport}
                            disabled={lcImporting || !lcImportInput.trim()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold text-white transition disabled:opacity-40 ${lightMode ? "bg-orange-500 hover:bg-orange-600" : "bg-orange-500 hover:bg-orange-400"}`}
                          >
                            {lcImporting ? "⏳" : "Import"}
                          </motion.button>
                        </div>
                        {lcImportMsg && (
                          <p className={`mt-2 text-[11px] font-semibold ${lcImportMsg.type === "ok" ? (lightMode ? "text-green-700" : "text-green-400") : "text-red-400"}`}>
                            {lcImportMsg.text}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── QUICK ADD SECTION ── */}
                    <div className={`rounded-xl border p-3 ${lightMode ? "bg-green-50 border-green-200" : "bg-green-500/10 border-green-500/20"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-[11px] font-bold ${lightMode ? "text-green-700" : "text-green-300"}`}>
                          ⚡ Quick Add: Paste code → Fill details → Save
                        </p>
                        <button
                          onClick={() => {
                            setCompilerCode(learnForm.codeSolution);
                            setCompilerLanguage(learnForm.language);
                            setShowAddModal(false);
                            setShowCompiler(true);
                          }}
                          className={`text-[10px] font-bold px-2 py-1 rounded transition ${lightMode ? "bg-green-500 text-white hover:bg-green-600" : "bg-green-600 text-white hover:bg-green-500"}`}
                        >
                          ▶️ Test in Compiler
                        </button>
                      </div>
                    </div>

                    {/* Code — MOST IMPORTANT field, now at TOP */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-[11px] font-bold ${t.textMuted}`}>💻 Code Solution *</label>
                        <div className="flex gap-2">
                          <select value={learnForm.language} onChange={e => setLearnForm(p => ({...p, language: e.target.value}))}
                            className={`rounded border px-2 py-1 text-[10px] outline-none ${t.select}`}>
                            <option value="cpp">C++</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="javascript">JS</option>
                          </select>
                        </div>
                      </div>
                      <textarea value={learnForm.codeSolution} onChange={e => setLearnForm(p => ({...p, codeSolution: e.target.value}))}
                        placeholder="Paste your solution here…"
                        rows={8} 
                        spellCheck={false}
                        className={`w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none resize-y ${lightMode ? "bg-gray-900 text-green-400 border-gray-700 placeholder:text-gray-600" : "bg-[#0d1117] text-green-400 border-[#30363d] placeholder:text-gray-600"}`} />
                    </div>

                    {/* Row 1: topic + title (most essential) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>📁 Topic *</label>
                        <input value={learnForm.topic} onChange={e => setLearnForm(p => ({...p, topic: e.target.value}))}
                          placeholder="Arrays, Trees, DP…"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>📌 Title *</label>
                        <input value={learnForm.title} onChange={e => setLearnForm(p => ({...p, title: e.target.value}))}
                          placeholder="Two Sum, LCA of BST…"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                    </div>

                    {/* Row 2: difficulty + sub-topic + tags */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Difficulty</label>
                        <select value={learnForm.difficulty} onChange={e => setLearnForm(p => ({...p, difficulty: e.target.value}))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.select}`}>
                          <option>Easy</option><option>Medium</option><option>Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Sub-Topic</label>
                        <input value={learnForm.subTopic} onChange={e => setLearnForm(p => ({...p, subTopic: e.target.value}))}
                          placeholder="Sliding Window…"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Tags</label>
                        <input value={learnForm.tags} onChange={e => setLearnForm(p => ({...p, tags: e.target.value}))}
                          placeholder="dp, hash, bfs"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                    </div>

                    {/* Intuition — quick note */}
                    <div>
                      <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>💡 Key Insight (optional)</label>
                      <input value={learnForm.intuition} onChange={e => setLearnForm(p => ({...p, intuition: e.target.value}))}
                        placeholder="The aha moment — e.g. use hash map for O(1) lookup"
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>📝 Approach (optional)</label>
                      <textarea value={learnForm.explanation} onChange={e => setLearnForm(p => ({...p, explanation: e.target.value}))}
                        placeholder="Step-by-step walkthrough…"
                        rows={3} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${t.input}`} />
                    </div>

                    {/* Complexity + source row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Time</label>
                        <input value={learnForm.timeComplexity} onChange={e => setLearnForm(p => ({...p, timeComplexity: e.target.value}))}
                          placeholder="O(n log n)"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Space</label>
                        <input value={learnForm.spaceComplexity} onChange={e => setLearnForm(p => ({...p, spaceComplexity: e.target.value}))}
                          placeholder="O(n)"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Source URL</label>
                        <input value={learnForm.sourceUrl} onChange={e => setLearnForm(p => ({...p, sourceUrl: e.target.value}))}
                          placeholder="https://…"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                    </div>

                    {/* Question text (least important, at bottom) */}
                    <div>
                      <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Problem Statement (optional)</label>
                      <textarea value={learnForm.questionText} onChange={e => setLearnForm(p => ({...p, questionText: e.target.value}))}
                        placeholder="Full problem description…"
                        rows={3} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${t.input}`} />
                    </div>
                  </div>

                  {/* Modal footer */}
                  <div className={`flex gap-3 border-t px-6 py-4 shrink-0 ${lightMode ? "border-gray-100" : "border-white/[0.07]"}`}>
                    <button onClick={() => { setShowAddModal(false); setEditEntry(null); setLcImportInput(""); setLcImportMsg(null); }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/5 hover:bg-white/10 text-gray-300"}`}>
                      Cancel
                    </button>
                    <button onClick={handleAddLearnEntry} disabled={learnLoading}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition shadow-md disabled:opacity-50 ${lightMode ? "bg-[#0969da] hover:bg-[#0860ca]" : "bg-[#1f6feb] hover:bg-[#1a5edb]"}`}>
                      {learnLoading ? "Saving…" : editEntry ? "💾 Update" : "➕ Add Entry"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* ════ COMPILER MODAL - LeetCode/GFG Style ════ */}
            {showCompiler && (
              <div className={`fixed inset-0 z-50 compiler-no-select ${compilerLightMode ? "bg-[#f0f0f0]" : "bg-[#0d1117]"}`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex flex-col"
                >
                  {/* ═══ TOP HEADER BAR ═══ */}
                  <div className={`flex items-center justify-between px-3 sm:px-4 py-2 border-b shrink-0 ${compilerLightMode ? "bg-white border-gray-300 shadow-sm" : "bg-[#161b22] border-[#30363d]"}`}>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                          <span className="text-white text-sm font-bold">⚡</span>
                        </div>
                        <div className="hidden sm:block">
                          <h2 className={`text-sm font-bold ${compilerLightMode ? "text-gray-900" : "text-white"}`}>Code Studio</h2>
                          <p className={`text-[10px] ${compilerLightMode ? "text-gray-600" : "text-gray-400"}`}>
                            {compilerEditingId ? `✏️ Editing: ${compilerTitle || "Untitled"}` : "📝 New Problem"}
                          </p>
                        </div>
                      </div>
                      
                      {/* New / Edit indicator on mobile */}
                      <span className={`sm:hidden text-[10px] px-2 py-0.5 rounded ${compilerEditingId ? "bg-yellow-100 text-yellow-700 border border-yellow-300" : "bg-green-100 text-green-700 border border-green-300"}`}>
                        {compilerEditingId ? "Edit" : "New"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Language selector */}
                      <select 
                        value={compilerLanguage} 
                        onChange={e => setCompilerLanguage(e.target.value)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${compilerLightMode ? "bg-gray-100 border-gray-300 text-gray-800" : "bg-[#21262d] border-[#30363d] text-white"}`}
                      >
                        <option value="cpp">C++ 17</option>
                        <option value="c">C</option>
                        <option value="python">Python 3</option>
                        <option value="java">Java</option>
                        <option value="javascript">JavaScript</option>
                      </select>

                      {/* Run button */}
                      <motion.button 
                        onClick={runCompiler}
                        disabled={compilerRunning || !compilerCode.trim()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white transition disabled:opacity-50 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-lg shadow-green-500/25"
                      >
                        {compilerRunning ? (
                          <><span className="animate-spin">⏳</span><span className="hidden sm:inline">Running</span></>
                        ) : (
                          <><span>▶</span><span className="hidden sm:inline">Run Code</span></>
                        )}
                      </motion.button>

                      {/* Save button */}
                      <motion.button 
                        onClick={quickSaveFromCompiler}
                        disabled={!compilerCode.trim() || !compilerTopic.trim() || !compilerTitle.trim() || learnLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white transition disabled:opacity-50 shadow-lg ${
                          compilerEditingId 
                            ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 shadow-yellow-500/25" 
                            : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 shadow-blue-500/25"
                        }`}
                      >
                        {learnLoading ? "⏳" : compilerEditingId ? "💾 Update" : "💾 Save"}
                      </motion.button>

                      {/* New button (if editing) */}
                      {compilerEditingId && (
                        <motion.button 
                          onClick={clearCompilerForNew}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="hidden sm:flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white/70 bg-white/10 hover:bg-white/15 transition"
                        >
                          ✨ New
                        </motion.button>
                      )}

                      {/* Print PDF button */}
                      <motion.button 
                        onClick={printCodeToPDF}
                        disabled={!compilerCode.trim()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="hidden sm:flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white/70 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
                        title="Print to PDF"
                      >
                        🖨️ PDF
                      </motion.button>

                      {/* Layout picker */}
                      <div className="relative hidden sm:block">
                        <motion.button 
                          onClick={() => { setShowLayoutMenu(!showLayoutMenu); setShowThemeMenu(false); }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            compilerLightMode 
                              ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          }`}
                          title="Change layout"
                        >
                          {compilerLayout === "default" ? "◧" : compilerLayout === "reversed" ? "◨" : compilerLayout === "vertical" ? "⬒" : "▢"}
                        </motion.button>
                        {showLayoutMenu && (
                          <div className={`absolute top-full right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[200px] ${compilerLightMode ? "bg-white border border-gray-200" : "bg-[#161b22] border border-[#30363d]"}`}>
                            {[
                              { key: "default", label: "◧ Default", desc: "Nav | Code | IO" },
                              { key: "reversed", label: "◨ Reversed", desc: "IO | Code | Nav" },
                              { key: "vertical", label: "⬒ Vertical", desc: "Stacked layout" },
                              { key: "focus", label: "▢ Focus Mode", desc: "Code only" },
                            ].map(item => (
                              <button
                                key={item.key}
                                onClick={() => { setCompilerLayout(item.key as "default" | "reversed" | "vertical" | "focus"); setShowLayoutMenu(false); }}
                                className={`w-full text-left px-4 py-2.5 transition flex flex-col ${
                                  compilerLayout === item.key
                                    ? compilerLightMode ? "bg-blue-50 text-blue-700" : "bg-blue-500/10 text-blue-400"
                                    : compilerLightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-white/80"
                                }`}
                              >
                                <span className="text-sm font-bold">{item.label}</span>
                                <span className={`text-[10px] ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}>{item.desc}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Theme picker */}
                      <div className="relative hidden sm:block">
                        <motion.button 
                          onClick={() => { setShowThemeMenu(!showThemeMenu); setShowLayoutMenu(false); }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            compilerLightMode 
                              ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          }`}
                          title="Change theme"
                        >
                          🎨
                        </motion.button>
                        {showThemeMenu && (
                          <div className={`absolute top-full right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[180px] ${compilerLightMode ? "bg-white border border-gray-200" : "bg-[#161b22] border border-[#30363d]"}`}>
                            {[
                              { key: "light", label: "☀️ Light", preview: "#ffffff" },
                              { key: "dark", label: "🌙 Dark", preview: "#0d1117" },
                              { key: "dracula", label: "🧛 Dracula", preview: "#282A36" },
                              { key: "monokai", label: "🎨 Monokai", preview: "#272822" },
                              { key: "nord", label: "❄️ Nord", preview: "#2E3440" },
                              { key: "githubDark", label: "🐙 GitHub Dark", preview: "#0D1117" },
                            ].map(item => {
                              const isActive = item.key === "light" ? compilerLightMode : (!compilerLightMode && compilerTheme === item.key);
                              return (
                                <button
                                  key={item.key}
                                  onClick={() => { 
                                    if (item.key === "light") setCompilerLightMode(true);
                                    else { setCompilerLightMode(false); setCompilerTheme(item.key as "dark" | "dracula" | "monokai" | "nord" | "githubDark"); }
                                    setShowThemeMenu(false); 
                                  }}
                                  className={`w-full text-left px-4 py-2.5 transition flex items-center gap-2 ${
                                    isActive
                                      ? compilerLightMode ? "bg-blue-50 text-blue-700" : "bg-blue-500/10 text-blue-400"
                                      : compilerLightMode ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-white/80"
                                  }`}
                                >
                                  <span className="w-4 h-4 rounded shrink-0 border border-white/10" style={{ backgroundColor: item.preview }} />
                                  <span className="text-sm font-semibold">{item.label}</span>
                                  {isActive && <span className="ml-auto text-xs">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* Light/Dark mode toggle for compiler */}
                      <motion.button 
                        onClick={() => setCompilerLightMode(!compilerLightMode)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`hidden sm:flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          compilerLightMode 
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" 
                            : "bg-white/10 text-white/70 hover:bg-white/15"
                        }`}
                        title={compilerLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
                      >
                        {compilerLightMode ? "🌙" : "☀️"}
                      </motion.button>

                      {/* Close button */}
                      <button 
                        onClick={() => { setShowCompiler(false); clearCompilerForNew(); }}
                        className={`rounded-lg p-2 text-lg transition ${compilerLightMode ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/10 text-white/50"}`}
                      >✕</button>
                    </div>
                  </div>

                  {/* ═══ MAIN CONTENT - Layout depends on compilerLayout ═══ */}
                  <div 
                    id="compiler-main-content"
                    className={`flex-1 flex overflow-hidden gap-1 p-1 transition-all duration-300 ${compilerLayout === "reversed" ? "flex-row-reverse" : compilerLayout === "vertical" ? "flex-col" : ""} ${compilerLightMode ? "bg-[#f0f0f0]" : "bg-[#0d1117]"}`}
                  >
                    
                    {/* ═══ LEFT SIDEBAR - Navigation Tree ═══ */}
                    <div 
                      className={`shrink-0 flex-col rounded-lg overflow-hidden border ${!isDraggingLeft ? "transition-[width] duration-150" : ""} ${compilerLayout === "focus" || compilerLayout === "vertical" ? "hidden" : leftPanelCollapsed ? "hidden md:flex" : "hidden md:flex"} ${compilerLightMode ? "bg-white border-gray-200 shadow-sm" : "bg-[#161b22] border-[#30363d]"}`}
                      style={{ width: leftPanelCollapsed ? "40px" : `${compilerLeftWidth}px` }}
                    >
                      {leftPanelCollapsed ? (
                        /* Collapsed view - just show expand button */
                        <div className="flex flex-col items-center py-3 gap-3">
                          <button 
                            onClick={() => setLeftPanelCollapsed(false)}
                            className={`p-2 rounded-lg transition ${compilerLightMode ? "hover:bg-gray-200 text-gray-700" : "hover:bg-white/10 text-white/70"}`}
                            title="Expand library"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                          </button>
                          <div className={`writing-vertical text-[10px] font-bold uppercase tracking-wider ${compilerLightMode ? "text-gray-500" : "text-gray-500"}`} style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                            📚 Library ({learnEntries.length})
                          </div>
                        </div>
                      ) : (
                        <>
                      {/* Nav Header */}
                      <div className={`px-3 py-2.5 border-b flex items-center justify-between ${compilerLightMode ? "bg-white border-gray-300" : "bg-[#161b22] border-[#30363d]"}`}>
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${compilerLightMode ? "text-gray-700" : "text-gray-400"}`}>📚 My Library</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={clearCompilerForNew}
                            className={`text-[10px] px-2 py-1 rounded-md font-semibold transition ${compilerLightMode ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"}`}
                          >
                            + New
                          </button>
                          <button 
                            onClick={() => setLeftPanelCollapsed(true)}
                            className={`p-1 rounded transition ${compilerLightMode ? "hover:bg-gray-200 text-gray-500" : "hover:bg-white/10 text-white/50"}`}
                            title="Collapse panel"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Search */}
                      <div className={`p-2.5 border-b ${compilerLightMode ? "border-gray-300 bg-white" : "border-[#30363d]/50"}`}>
                        <input 
                          value={compilerNavSearch}
                          onChange={e => setCompilerNavSearch(e.target.value)}
                          placeholder="🔍 Search problems..."
                          className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition focus:ring-2 ${compilerLightMode ? "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-green-200 focus:border-green-400" : "border-[#30363d] bg-[#0d1117] text-[#e6edf3] placeholder:text-gray-500 focus:ring-green-500/30"}`}
                        />
                      </div>
                      
                      {/* Navigation Tree */}
                      <div className="flex-1 overflow-y-auto p-2">
                        {Object.keys(compilerNavData).length === 0 ? (
                          <div className={`text-center py-8 ${compilerLightMode ? "text-gray-400" : "text-gray-500"}`}>
                            <p className="text-2xl mb-2">📭</p>
                            <p className="text-[11px]">No saved problems yet</p>
                            <p className="text-[10px] mt-1 opacity-60">Add code on the right →</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(compilerNavData).sort().map(([topic, subTopics]) => (
                              <div key={topic}>
                                {/* Topic Header */}
                                <button
                                  onClick={() => setCompilerExpandedTopics(prev => {
                                    const next = new Set(prev);
                                    if (next.has(topic)) next.delete(topic);
                                    else next.add(topic);
                                    return next;
                                  })}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition ${
                                    compilerLightMode ? "hover:bg-gray-200" : "hover:bg-white/5"
                                  }`}
                                >
                                  <span className={`text-[10px] ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}>{compilerExpandedTopics.has(topic) ? "▼" : "▶"}</span>
                                  <span className={`text-xs font-bold ${compilerLightMode ? "text-gray-800" : "text-white"}`}>📁 {topic}</span>
                                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${compilerLightMode ? "bg-gray-200 text-gray-600" : "bg-white/10 text-white/50"}`}>
                                    {Object.values(subTopics).flat().length}
                                  </span>
                                </button>
                                
                                {/* Sub-topics & Problems */}
                                <AnimatePresence>
                                  {compilerExpandedTopics.has(topic) && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className={`overflow-hidden ml-3 border-l border-dashed pl-2 ${compilerLightMode ? "border-gray-300" : "border-white/10"}`}
                                    >
                                      {Object.entries(subTopics).sort().map(([subTopic, entries]) => (
                                        <div key={subTopic} className="my-1">
                                          <p className={`text-[10px] font-semibold px-2 py-1 ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}>
                                            📂 {subTopic}
                                          </p>
                                          {entries.map(entry => (
                                            <button
                                              key={entry.id}
                                              onClick={() => loadEntryIntoCompiler(entry)}
                                              className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition truncate flex items-center gap-1.5 ${
                                                compilerEditingId === entry.id 
                                                  ? "bg-blue-500/20 text-blue-400" 
                                                  : compilerLightMode 
                                                    ? "hover:bg-gray-200 text-gray-700" 
                                                    : "hover:bg-white/5 text-white/70"
                                              }`}
                                            >
                                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                entry.difficulty === "Easy" ? "bg-green-500" :
                                                entry.difficulty === "Medium" ? "bg-yellow-500" : "bg-red-500"
                                              }`} />
                                              <span className="truncate">{entry.title}</span>
                                            </button>
                                          ))}
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Nav Footer - Stats */}
                      <div className={`px-3 py-2.5 border-t text-[11px] font-medium ${compilerLightMode ? "bg-white border-gray-200 text-gray-500" : "bg-[#161b22] border-[#30363d] text-white/50"}`}>
                        📊 {learnEntries.length} problems saved
                      </div>
                        </>
                      )}
                    </div>

                    {/* ═══ LEFT-MIDDLE DRAG HANDLE ═══ */}
                    <div
                      className={`drag-handle ${compilerLayout === "focus" || compilerLayout === "vertical" || leftPanelCollapsed ? "hidden" : "hidden md:flex"} cursor-col-resize group relative shrink-0 items-center justify-center`}
                      style={{ width: "6px" }}
                      onMouseDown={(e) => { e.preventDefault(); setIsDraggingLeft(true); }}
                      title="Drag to resize"
                    >
                      {/* Visible line indicator */}
                      <div 
                        className={`h-full transition-all rounded-full ${
                          isDraggingLeft 
                            ? "bg-blue-500 w-1" 
                            : "bg-transparent group-hover:bg-blue-400 w-0.5"
                        }`}
                      />
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${compilerLightMode ? "text-blue-400" : "text-blue-500"}`}>
                        <svg width="8" height="24" viewBox="0 0 8 24" fill="currentColor"><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/></svg>
                      </div>
                    </div>

                    {/* ═══ MIDDLE - CODE EDITOR (LeetCode Style) ═══ */}
                    <div 
                      className={`flex flex-col overflow-hidden min-w-0 rounded-lg border ${compilerLightMode ? "bg-white border-gray-200 shadow-sm" : "bg-[#0d1117] border-[#30363d]"}`}
                      style={{ 
                        flex: compilerLayout === "vertical" ? "none" : "1",
                        height: compilerLayout === "vertical" ? `${verticalSplit}%` : "auto",
                        width: compilerLayout === "vertical" ? "100%" : "auto",
                      }}
                    >
                      {/* Editor Header with tabs */}
                      <div className={`flex items-center justify-between px-3 sm:px-4 py-2 border-b ${compilerLightMode ? "bg-gray-50 border-gray-200" : "bg-[#1e1e2e] border-[#30363d]"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${compilerLightMode ? "bg-white text-gray-800 border border-gray-200 shadow-sm" : "bg-[#0d1117] text-green-400 border border-[#30363d]"}`}>
                            <span>💻</span>
                            <span>{compilerLanguage === "cpp" ? "main.cpp" : compilerLanguage === "python" ? "main.py" : compilerLanguage === "java" ? "Main.java" : "main.js"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Font size controls */}
                          <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${compilerLightMode ? "bg-white border border-gray-200" : "bg-white/5"}`}>
                            <button 
                              onClick={() => setCompilerFontSize(Math.max(10, compilerFontSize - 1))}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${compilerLightMode ? "hover:bg-gray-100 text-gray-600" : "hover:bg-white/10 text-white/60"}`}
                              title="Decrease font size"
                            >A−</button>
                            <span className={`px-1.5 text-[10px] font-bold min-w-[24px] text-center ${compilerLightMode ? "text-gray-700" : "text-white/70"}`}>{compilerFontSize}</span>
                            <button 
                              onClick={() => setCompilerFontSize(Math.min(24, compilerFontSize + 1))}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${compilerLightMode ? "hover:bg-gray-100 text-gray-600" : "hover:bg-white/10 text-white/60"}`}
                              title="Increase font size"
                            >A+</button>
                          </div>
                          
                          <button 
                            onClick={() => { 
                              const el = document.getElementById("compiler-textarea");
                              if (el) el.focus();
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${compilerLightMode ? "bg-white hover:bg-gray-100 text-gray-600 border border-gray-200" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
                            title="Focus editor"
                          >⌨️</button>
                          <button 
                            onClick={() => { setCompilerCode(""); setCompilerOutput(""); setCompilerError(""); }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${compilerLightMode ? "bg-white hover:bg-gray-100 text-gray-600 border border-gray-200" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
                          >🗑️ Clear</button>
                          <button 
                            onClick={() => navigator.clipboard.writeText(compilerCode)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${compilerLightMode ? "bg-white hover:bg-gray-100 text-gray-600 border border-gray-200" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
                          >📋 Copy</button>
                          
                          {/* Reset panels button */}
                          <button 
                            onClick={() => { setCompilerLeftWidth(240); setCompilerRightWidth(340); setCompilerIOSplit(50); setCompilerFontSize(13); }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${compilerLightMode ? "bg-white hover:bg-gray-100 text-gray-600 border border-gray-200" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
                            title="Reset layout"
                          >⟲</button>
                        </div>
                      </div>
                      
                      {/* Line Numbers + Code Editor - Theme aware */}
                      <div className="flex-1 flex overflow-hidden relative rounded-b-lg" style={{ backgroundColor: editorTheme.bg }}>
                        {/* Line numbers - will sync scroll */}
                        <div 
                          id="compiler-line-numbers"
                          className="w-10 sm:w-12 shrink-0 py-4 pr-2 text-right select-none overflow-hidden border-r" 
                          style={{ 
                            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", 
                            fontSize: `${compilerFontSize}px`, 
                            lineHeight: `${compilerFontSize + 9}px`,
                            backgroundColor: editorTheme.lineBg,
                            borderColor: editorTheme.border,
                          }}
                        >
                          {(compilerCode || " ").split("\n").map((_, i) => (
                            <div key={i} style={{ height: `${compilerFontSize + 9}px`, color: editorTheme.lineText }}>
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        
                        {/* Empty state placeholder */}
                        {!compilerCode && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 ml-12">
                            <div className="text-center" style={{ color: editorTheme.lineText }}>
                              <p className="text-4xl mb-3 opacity-50">💻</p>
                              <p className="text-sm font-medium">Start coding here</p>
                              <p className="text-xs mt-1 opacity-60">Tab / Shift+Tab for indent • Enter for auto-indent</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Syntax highlighted code overlay - scrollable container */}
                        <div className="flex-1 relative overflow-hidden">
                          {/* Highlighted code display (behind textarea) - synced scroll */}
                          <pre
                            id="compiler-highlighted-code"
                            className="absolute inset-0 py-4 pr-4 pl-3 overflow-hidden pointer-events-none whitespace-pre m-0"
                            style={{ 
                              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
                              fontSize: `${compilerFontSize}px`,
                              lineHeight: `${compilerFontSize + 9}px`,
                              tabSize: 4,
                            }}
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: highlightedCode + "\n" }}
                          />
                          
                          {/* Transparent textarea for editing - handles scroll */}
                          <textarea
                            id="compiler-textarea"
                            value={compilerCode}
                            onChange={e => setCompilerCode(e.target.value)}
                            onScroll={e => {
                              // Sync scroll with highlighted code and line numbers
                              const textarea = e.target as HTMLTextAreaElement;
                              const highlighted = document.getElementById("compiler-highlighted-code");
                              const lineNumbers = document.getElementById("compiler-line-numbers");
                              if (highlighted) {
                                highlighted.scrollTop = textarea.scrollTop;
                                highlighted.scrollLeft = textarea.scrollLeft;
                              }
                              if (lineNumbers) {
                                lineNumbers.scrollTop = textarea.scrollTop;
                              }
                            }}
                          onKeyDown={e => {
                            const textarea = e.target as HTMLTextAreaElement;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
                            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
                            
                            // Get comment syntax based on language
                            const getCommentPrefix = () => {
                              if (compilerLanguage === "python") return "# ";
                              return "// "; // cpp, c, java, javascript
                            };
                            
                            // Helper: get line boundaries
                            const getLineRange = (pos: number) => {
                              const before = compilerCode.substring(0, pos);
                              const lineStart = before.lastIndexOf("\n") + 1;
                              const nextNewline = compilerCode.indexOf("\n", pos);
                              const lineEnd = nextNewline === -1 ? compilerCode.length : nextNewline;
                              return { lineStart, lineEnd };
                            };
                            
                            // Helper: get all selected lines
                            const getSelectedLines = () => {
                              const startLine = getLineRange(start).lineStart;
                              const endLine = getLineRange(end).lineEnd;
                              return { startLine, endLine };
                            };
                            
                            // ═══ Ctrl/Cmd + / : Toggle line comment ═══
                            if (ctrlKey && e.key === "/") {
                              e.preventDefault();
                              const commentStr = getCommentPrefix();
                              const { startLine, endLine } = getSelectedLines();
                              const selectedText = compilerCode.substring(startLine, endLine);
                              const lines = selectedText.split("\n");
                              
                              // Check if ALL non-empty lines are commented
                              const allCommented = lines.every(line => {
                                const trimmed = line.trimStart();
                                return trimmed === "" || trimmed.startsWith(commentStr.trim());
                              });
                              
                              const newLines = lines.map(line => {
                                if (line.trim() === "") return line;
                                const indentMatch = line.match(/^(\s*)/);
                                const indent = indentMatch ? indentMatch[1] : "";
                                const content = line.substring(indent.length);
                                if (allCommented) {
                                  // Uncomment
                                  if (content.startsWith(commentStr)) return indent + content.substring(commentStr.length);
                                  if (content.startsWith(commentStr.trim())) return indent + content.substring(commentStr.trim().length).trimStart();
                                  return line;
                                } else {
                                  // Comment (only non-commented lines)
                                  if (content.startsWith(commentStr.trim())) return line;
                                  return indent + commentStr + content;
                                }
                              });
                              
                              const newText = newLines.join("\n");
                              const newCode = compilerCode.substring(0, startLine) + newText + compilerCode.substring(endLine);
                              setCompilerCode(newCode);
                              const lengthDiff = newText.length - selectedText.length;
                              setTimeout(() => {
                                textarea.selectionStart = start + (allCommented ? -commentStr.length : commentStr.length);
                                textarea.selectionEnd = end + lengthDiff;
                              }, 0);
                              return;
                            }
                            
                            // ═══ Alt + Up/Down : Move line up/down ═══
                            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                              e.preventDefault();
                              const { startLine, endLine } = getSelectedLines();
                              const currentBlock = compilerCode.substring(startLine, endLine);
                              
                              if (e.key === "ArrowUp") {
                                if (startLine === 0) return;
                                const prevLineStart = compilerCode.lastIndexOf("\n", startLine - 2) + 1;
                                const prevLine = compilerCode.substring(prevLineStart, startLine - 1);
                                const newCode = 
                                  compilerCode.substring(0, prevLineStart) +
                                  currentBlock + "\n" +
                                  prevLine +
                                  compilerCode.substring(endLine);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  const shift = prevLine.length + 1;
                                  textarea.selectionStart = start - shift;
                                  textarea.selectionEnd = end - shift;
                                }, 0);
                              } else {
                                if (endLine >= compilerCode.length) return;
                                const nextLineEnd = compilerCode.indexOf("\n", endLine + 1);
                                const nextEnd = nextLineEnd === -1 ? compilerCode.length : nextLineEnd;
                                const nextLine = compilerCode.substring(endLine + 1, nextEnd);
                                const newCode = 
                                  compilerCode.substring(0, startLine) +
                                  nextLine + "\n" +
                                  currentBlock +
                                  compilerCode.substring(nextEnd);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  const shift = nextLine.length + 1;
                                  textarea.selectionStart = start + shift;
                                  textarea.selectionEnd = end + shift;
                                }, 0);
                              }
                              return;
                            }
                            
                            // ═══ Shift+Alt + Up/Down : Duplicate line up/down ═══
                            if (e.altKey && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                              e.preventDefault();
                              const { startLine, endLine } = getSelectedLines();
                              const currentBlock = compilerCode.substring(startLine, endLine);
                              const newCode = 
                                compilerCode.substring(0, endLine) +
                                "\n" + currentBlock +
                                compilerCode.substring(endLine);
                              setCompilerCode(newCode);
                              if (e.key === "ArrowDown") {
                                setTimeout(() => {
                                  const shift = currentBlock.length + 1;
                                  textarea.selectionStart = start + shift;
                                  textarea.selectionEnd = end + shift;
                                }, 0);
                              }
                              return;
                            }
                            
                            // ═══ Ctrl/Cmd + D : Duplicate line ═══
                            if (ctrlKey && e.key === "d" && !e.shiftKey) {
                              e.preventDefault();
                              const { startLine, endLine } = getSelectedLines();
                              const currentBlock = compilerCode.substring(startLine, endLine);
                              const newCode = 
                                compilerCode.substring(0, endLine) +
                                "\n" + currentBlock +
                                compilerCode.substring(endLine);
                              setCompilerCode(newCode);
                              setTimeout(() => {
                                const shift = currentBlock.length + 1;
                                textarea.selectionStart = start + shift;
                                textarea.selectionEnd = end + shift;
                              }, 0);
                              return;
                            }
                            
                            // ═══ Ctrl/Cmd + Shift + K : Delete line ═══
                            if (ctrlKey && e.shiftKey && e.key === "K") {
                              e.preventDefault();
                              const { startLine, endLine } = getSelectedLines();
                              const nextChar = compilerCode.charAt(endLine);
                              const removeExtra = nextChar === "\n" ? 1 : 0;
                              const newCode = 
                                compilerCode.substring(0, startLine) +
                                compilerCode.substring(endLine + removeExtra);
                              setCompilerCode(newCode);
                              setTimeout(() => {
                                textarea.selectionStart = textarea.selectionEnd = startLine;
                              }, 0);
                              return;
                            }
                            
                            // ═══ Ctrl/Cmd + A : Select all (native, but ensure works) ═══
                            // Handled natively
                            
                            // ═══ Ctrl/Cmd + Enter : Run code ═══
                            if (ctrlKey && e.key === "Enter") {
                              e.preventDefault();
                              if (!compilerRunning && compilerCode.trim()) runCompiler();
                              return;
                            }
                            
                            // ═══ Ctrl/Cmd + S : Save code ═══
                            if (ctrlKey && e.key === "s") {
                              e.preventDefault();
                              if (compilerCode.trim() && compilerTopic.trim() && compilerTitle.trim()) {
                                quickSaveFromCompiler();
                              }
                              return;
                            }
                            
                            // ═══ Tab : Add indent / Shift+Tab : Remove indent ═══
                            if (e.key === "Tab") {
                              e.preventDefault();
                              const spaces = "    ";
                              
                              // Multi-line selection: indent/dedent all lines
                              if (start !== end && compilerCode.substring(start, end).includes("\n")) {
                                const { startLine, endLine } = getSelectedLines();
                                const selectedText = compilerCode.substring(startLine, endLine);
                                const lines = selectedText.split("\n");
                                const newLines = e.shiftKey
                                  ? lines.map(l => l.startsWith("    ") ? l.substring(4) : l.startsWith("\t") ? l.substring(1) : l)
                                  : lines.map(l => spaces + l);
                                const newText = newLines.join("\n");
                                const newCode = compilerCode.substring(0, startLine) + newText + compilerCode.substring(endLine);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  textarea.selectionStart = startLine;
                                  textarea.selectionEnd = startLine + newText.length;
                                }, 0);
                                return;
                              }
                              
                              if (e.shiftKey) {
                                const { lineStart } = getLineRange(start);
                                const lineIndent = compilerCode.substring(lineStart, start);
                                if (lineIndent.startsWith("    ")) {
                                  const newCode = compilerCode.substring(0, lineStart) + compilerCode.substring(lineStart + 4);
                                  setCompilerCode(newCode);
                                  setTimeout(() => {
                                    textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
                                  }, 0);
                                }
                              } else {
                                const newCode = compilerCode.substring(0, start) + spaces + compilerCode.substring(end);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  textarea.selectionStart = textarea.selectionEnd = start + 4;
                                }, 0);
                              }
                              return;
                            }
                            
                            // ═══ Enter : Auto-indent + smart brace close ═══
                            if (e.key === "Enter") {
                              const beforeCursor = compilerCode.substring(0, start);
                              const { lineStart } = getLineRange(start);
                              const currentLine = beforeCursor.substring(lineStart);
                              const indent = currentLine.match(/^(\s*)/)?.[1] || "";
                              const lastChar = beforeCursor.trim().slice(-1);
                              const nextChar = compilerCode.charAt(start);
                              const extraIndent = ["{", "(", "[", ":"].includes(lastChar) ? "    " : "";
                              
                              // Smart: if inside {} or [] or (), add extra newline
                              const isInsideBrace = 
                                (lastChar === "{" && nextChar === "}") ||
                                (lastChar === "[" && nextChar === "]") ||
                                (lastChar === "(" && nextChar === ")");
                              
                              e.preventDefault();
                              if (isInsideBrace) {
                                const newCode = compilerCode.substring(0, start) + "\n" + indent + "    " + "\n" + indent + compilerCode.substring(start);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + 4;
                                }, 0);
                              } else {
                                const newCode = compilerCode.substring(0, start) + "\n" + indent + extraIndent + compilerCode.substring(start);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + extraIndent.length;
                                }, 0);
                              }
                              return;
                            }
                            
                            // ═══ Skip over closing bracket if it matches ═══
                            const closingChars = ["}", ")", "]", '"', "'", "`"];
                            if (closingChars.includes(e.key) && start === end) {
                              const nextChar = compilerCode.charAt(start);
                              if (nextChar === e.key) {
                                // Skip over it instead of inserting another
                                e.preventDefault();
                                setTimeout(() => {
                                  textarea.selectionStart = textarea.selectionEnd = start + 1;
                                }, 0);
                                return;
                              }
                            }
                            
                            // ═══ Auto-close brackets: { ( [ " ' ` ═══
                            const bracketPairs: Record<string, string> = { "{": "}", "(": ")", "[": "]", '"': '"', "'": "'", "`": "`" };
                            if (bracketPairs[e.key] && start === end) {
                              // Don't auto-close quotes if cursor is inside a word
                              if ((e.key === '"' || e.key === "'" || e.key === "`")) {
                                const prevChar = compilerCode.charAt(start - 1);
                                if (prevChar && /[a-zA-Z0-9_]/.test(prevChar)) return; // Let it type normally
                              }
                              e.preventDefault();
                              const closeChar = bracketPairs[e.key];
                              const newCode = compilerCode.substring(0, start) + e.key + closeChar + compilerCode.substring(end);
                              setCompilerCode(newCode);
                              setTimeout(() => {
                                textarea.selectionStart = textarea.selectionEnd = start + 1;
                              }, 0);
                              return;
                            }
                            
                            // ═══ Backspace removes matching pair if empty ═══
                            if (e.key === "Backspace" && start === end && start > 0) {
                              const prevChar = compilerCode.charAt(start - 1);
                              const nextChar = compilerCode.charAt(start);
                              const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]", '"': '"', "'": "'", "`": "`" };
                              if (pairs[prevChar] === nextChar) {
                                e.preventDefault();
                                const newCode = compilerCode.substring(0, start - 1) + compilerCode.substring(start + 1);
                                setCompilerCode(newCode);
                                setTimeout(() => {
                                  textarea.selectionStart = textarea.selectionEnd = start - 1;
                                }, 0);
                                return;
                              }
                            }
                          }}
                          placeholder=""
                          spellCheck={false}
                          className="absolute inset-0 w-full h-full py-4 pr-4 pl-3 outline-none resize-none bg-transparent border-none focus:ring-0 focus:outline-none"
                          style={{ 
                            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
                            fontSize: `${compilerFontSize}px`,
                            lineHeight: `${compilerFontSize + 9}px`,
                            caretColor: compilerLightMode ? "#3b82f6" : "#22c55e",
                            tabSize: 4,
                            MozTabSize: 4,
                            color: "transparent",
                            WebkitTextFillColor: "transparent",
                            overflow: "auto",
                          }}
                        />
                        </div>
                      </div>
                    </div>

                    {/* ═══ MIDDLE-RIGHT DRAG HANDLE (Horizontal / Vertical) ═══ */}
                    {compilerLayout === "vertical" ? (
                      <div
                        className={`drag-handle hidden md:flex cursor-row-resize group relative shrink-0 items-center justify-center w-full`}
                        style={{ height: "6px" }}
                        onMouseDown={(e) => { e.preventDefault(); setIsDraggingVertical(true); }}
                        title="Drag to resize"
                      >
                        <div 
                          className={`w-full transition-all rounded-full ${
                            isDraggingVertical 
                              ? "bg-blue-500 h-1" 
                              : "bg-transparent group-hover:bg-blue-400 h-0.5"
                          }`}
                        />
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${compilerLightMode ? "text-blue-400" : "text-blue-500"}`}>
                          <svg width="24" height="8" viewBox="0 0 24 8" fill="currentColor"><circle cx="6" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="18" cy="4" r="1.5"/></svg>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`drag-handle ${compilerLayout === "focus" || rightPanelCollapsed ? "hidden" : "hidden md:flex"} cursor-col-resize group relative shrink-0 items-center justify-center`}
                        style={{ width: "6px" }}
                        onMouseDown={(e) => { e.preventDefault(); setIsDraggingRight(true); }}
                        title="Drag to resize"
                      >
                        <div 
                          className={`h-full transition-all rounded-full ${
                            isDraggingRight 
                              ? "bg-blue-500 w-1" 
                              : "bg-transparent group-hover:bg-blue-400 w-0.5"
                          }`}
                        />
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${compilerLightMode ? "text-blue-400" : "text-blue-500"}`}>
                          <svg width="8" height="24" viewBox="0 0 8 24" fill="currentColor"><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/></svg>
                        </div>
                      </div>
                    )}

                    {/* ═══ RIGHT PANEL - Problem Details + I/O ═══ */}
                    <div 
                      id="compiler-right-panel"
                      className={`shrink-0 flex flex-col rounded-lg overflow-hidden border ${!isDraggingRight && !isDraggingVertical ? "transition-[width,height] duration-150" : ""} ${compilerLayout === "focus" ? "hidden" : "hidden md:flex"} ${compilerLightMode ? "bg-white border-gray-200 shadow-sm" : "bg-[#161b22] border-[#30363d]"}`}
                      style={{ 
                        width: compilerLayout === "vertical" ? "100%" : rightPanelCollapsed ? "40px" : `${compilerRightWidth}px`,
                        height: compilerLayout === "vertical" ? `${100 - verticalSplit}%` : "auto",
                        flex: compilerLayout === "vertical" ? "1" : "none",
                      }}
                    >
                      
                      {rightPanelCollapsed ? (
                        /* Collapsed view - just show expand button */
                        <div className="flex flex-col items-center py-3 gap-3">
                          <button 
                            onClick={() => setRightPanelCollapsed(false)}
                            className={`p-2 rounded-lg transition ${compilerLightMode ? "hover:bg-gray-200 text-gray-700" : "hover:bg-white/10 text-white/70"}`}
                            title="Expand panel"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${compilerLightMode ? "text-gray-500" : "text-gray-500"}`} style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                            📋 Testcase & Result
                          </div>
                        </div>
                      ) : (
                        <>
                      {/* ═══ Problem Info - Collapsible & Resizable ═══ */}
                      <div 
                        className={`flex flex-col border-b overflow-hidden ${compilerLightMode ? "border-gray-300" : "border-[#30363d]"}`}
                        style={problemInfoCollapsed ? {} : { flexBasis: `${problemInfoHeight}%`, flexShrink: 0, minHeight: 0 }}
                      >
                        <button 
                          onClick={() => setProblemInfoCollapsed(!problemInfoCollapsed)}
                          className={`w-full px-3 py-2.5 flex items-center justify-between transition shrink-0 ${compilerLightMode ? "bg-white hover:bg-gray-50" : "bg-[#0d1117] hover:bg-[#161b22]"}`}
                        >
                          <div className="flex items-center gap-2">
                            <svg 
                              className={`transition-transform ${problemInfoCollapsed ? "" : "rotate-90"} ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}
                              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                            >
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${compilerLightMode ? "text-gray-700" : "text-gray-400"}`}>📋 Problem Info</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {compilerEditingId && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-md font-medium ${compilerLightMode ? "bg-yellow-100 text-yellow-700 border border-yellow-300" : "bg-yellow-500/20 text-yellow-400"}`}>Editing</span>
                            )}
                            <span
                              onClick={(e) => { e.stopPropagation(); setRightPanelCollapsed(true); }}
                              className={`p-1 rounded transition cursor-pointer ${compilerLightMode ? "hover:bg-gray-200 text-gray-500" : "hover:bg-white/10 text-white/50"}`}
                              title="Collapse panel"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                            </span>
                          </div>
                        </button>
                        {!problemInfoCollapsed && (
                        <div 
                          className={`p-3 space-y-3 overflow-y-auto flex-1 min-h-0 ${compilerLightMode ? "bg-white" : ""}`}
                        >
                          {/* Topic + SubTopic */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={`text-[10px] font-semibold mb-1 block ${compilerLightMode ? "text-gray-700" : "text-gray-400"}`}>📁 Topic *</label>
                              <input 
                                value={compilerTopic}
                                onChange={e => setCompilerTopic(e.target.value)}
                                placeholder="Arrays..."
                                list="compiler-topic-list"
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-[11px] outline-none transition focus:ring-2 ${compilerLightMode ? "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-blue-200 focus:border-blue-400" : "bg-[#0d1117] border-[#30363d] text-white focus:ring-blue-500/30"}`}
                              />
                              <datalist id="compiler-topic-list">
                                {["Arrays", "Strings", "Linked List", "Stack", "Queue", "Trees", "Binary Search", "Dynamic Programming", "Graphs", "Backtracking", "Greedy", "Heap", "Trie", "Math", "Bit Manipulation"].map(tp => (
                                  <option key={tp} value={tp} />
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <label className={`text-[10px] font-semibold mb-1 block ${compilerLightMode ? "text-gray-700" : "text-gray-400"}`}>📂 Sub-topic</label>
                              <input 
                                value={compilerSubTopic}
                                onChange={e => setCompilerSubTopic(e.target.value)}
                                placeholder="Sliding Window..."
                                list="compiler-subtopic-list"
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-[11px] outline-none transition focus:ring-2 ${compilerLightMode ? "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-blue-200 focus:border-blue-400" : "bg-[#0d1117] border-[#30363d] text-white focus:ring-blue-500/30"}`}
                              />
                              <datalist id="compiler-subtopic-list">
                                {["Two Pointers", "Sliding Window", "Prefix Sum", "Binary Search", "BFS", "DFS", "Recursion", "Memoization", "Tabulation", "Sorting", "Hashing"].map(st => (
                                  <option key={st} value={st} />
                                ))}
                              </datalist>
                            </div>
                          </div>
                          {/* Title */}
                          <div>
                            <label className={`text-[10px] font-semibold mb-1 block ${compilerLightMode ? "text-gray-700" : "text-gray-400"}`}>📌 Title *</label>
                            <input 
                              value={compilerTitle}
                              onChange={e => setCompilerTitle(e.target.value)}
                              placeholder="Two Sum..."
                              className={`w-full rounded-lg border px-2.5 py-1.5 text-[11px] outline-none transition focus:ring-2 ${compilerLightMode ? "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-blue-200 focus:border-blue-400" : "bg-[#0d1117] border-[#30363d] text-white focus:ring-blue-500/30"}`}
                            />
                          </div>
                          {/* Difficulty */}
                          <div className="flex gap-1.5">
                            {["Easy", "Medium", "Hard"].map(d => (
                              <button
                                key={d}
                                onClick={() => setCompilerDifficulty(d)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition border ${
                                  compilerDifficulty === d
                                    ? d === "Easy" ? "bg-green-500 text-white border-green-600 shadow-sm" : d === "Medium" ? "bg-yellow-500 text-black border-yellow-600 shadow-sm" : "bg-red-500 text-white border-red-600 shadow-sm"
                                    : compilerLightMode ? "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200" : "bg-white/5 text-white/50 border-transparent hover:bg-white/10"
                                }`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                          {/* Question text (collapsible) */}
                          <div>
                            <label className={`text-[10px] font-semibold mb-1 block ${compilerLightMode ? "text-gray-700" : "text-gray-400"}`}>📝 Problem Statement</label>
                            <textarea 
                              value={compilerQuestion}
                              onChange={e => setCompilerQuestion(e.target.value)}
                              placeholder="Optional: paste problem..."
                              rows={2}
                              className={`w-full rounded-lg border px-2.5 py-1.5 text-[10px] outline-none resize-y transition focus:ring-2 ${compilerLightMode ? "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:ring-blue-200 focus:border-blue-400" : "bg-[#0d1117] border-[#30363d] text-white focus:ring-blue-500/30"}`}
                            />
                          </div>
                        </div>
                        )}
                      </div>

                      {/* ═══ DRAG HANDLE - Between Problem Info and Testcase ═══ */}
                      {!problemInfoCollapsed && (
                        <div
                          className={`drag-handle cursor-row-resize group relative shrink-0 flex items-center justify-center ${compilerLightMode ? "bg-gray-100" : "bg-[#161b22]"}`}
                          style={{ height: "6px" }}
                          onMouseDown={(e) => { e.preventDefault(); setIsDraggingProblemInfo(true); }}
                          title="Drag to resize Problem Info section"
                        >
                          <div 
                            className={`w-full transition-all rounded-full ${
                              isDraggingProblemInfo 
                                ? "bg-blue-500 h-1" 
                                : "bg-transparent group-hover:bg-blue-400 h-0.5"
                            }`}
                          />
                          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${compilerLightMode ? "text-blue-400" : "text-blue-500"}`}>
                            <svg width="24" height="8" viewBox="0 0 24 8" fill="currentColor"><circle cx="6" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="18" cy="4" r="1.5"/></svg>
                          </div>
                        </div>
                      )}
                      
                      {/* ═══ IO / Notes View Toggle ═══ */}
                      <div className={`flex items-center gap-0 shrink-0 border-b ${compilerLightMode ? "bg-[#fafafa] border-gray-200" : "bg-[#161b22] border-[#30363d]"}`}>
                        <button
                          onClick={() => setRightPanelView("io")}
                          className={`flex-1 px-3 py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                            rightPanelView === "io" 
                              ? compilerLightMode ? "text-blue-600 border-blue-500" : "text-blue-400 border-blue-500" 
                              : compilerLightMode ? "text-gray-500 hover:text-gray-700 border-transparent" : "text-gray-500 hover:text-gray-300 border-transparent"
                          }`}
                        >
                          <span>⚡</span> Testcase & Result
                        </button>
                        <button
                          onClick={() => setRightPanelView("notes")}
                          className={`flex-1 px-3 py-2 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                            rightPanelView === "notes" 
                              ? compilerLightMode ? "text-purple-600 border-purple-500" : "text-purple-400 border-purple-500" 
                              : compilerLightMode ? "text-gray-500 hover:text-gray-700 border-transparent" : "text-gray-500 hover:text-gray-300 border-transparent"
                          }`}
                        >
                          <span>📝</span> Notes & Tricks
                        </button>
                      </div>

                      {/* ═══ CONTENT BASED ON VIEW ═══ */}
                      {rightPanelView === "notes" ? (
                        /* ═══ NOTES EDITOR - Notion-like Rich Notes ═══ */
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                          <div className={`px-3 py-2 flex items-center justify-between shrink-0 border-b ${compilerLightMode ? "bg-white border-gray-200" : "bg-[#0d1117] border-[#30363d]"}`}>
                            <span className={`text-[10px] font-semibold ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}>
                              Supports: Markdown • Paste images • Code blocks
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(compilerNotes)}
                              className={`text-[9px] px-2 py-0.5 rounded ${compilerLightMode ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/10 text-white/50"}`}
                            >📋 Copy</button>
                          </div>
                          <div 
                            ref={notesEditorRef}
                            id="compiler-notes-editor"
                            contentEditable
                            dir="ltr"
                            lang="en"
                            className={`flex-1 overflow-y-auto p-4 outline-none max-w-none selectable ${
                              compilerLightMode 
                                ? "bg-white text-gray-800" 
                                : "bg-[#0d1117] text-gray-200"
                            }`}
                            style={{ 
                              fontFamily: "'Inter', system-ui, sans-serif",
                              fontSize: "14px",
                              lineHeight: "1.8",
                              minHeight: "100%",
                              whiteSpace: "pre-wrap",
                              wordWrap: "break-word",
                              textAlign: "left",
                              direction: "ltr",
                              unicodeBidi: "normal",
                            }}
                            onInput={(e) => {
                              // Uncontrolled: only sync to state, never re-render this div's content
                              const el = e.target as HTMLDivElement;
                              setCompilerNotes(el.innerHTML);
                            }}
                            onPaste={(e) => {
                              // Handle image paste
                              const items = e.clipboardData?.items;
                              if (items) {
                                for (let i = 0; i < items.length; i++) {
                                  if (items[i].type.startsWith("image/")) {
                                    e.preventDefault();
                                    const file = items[i].getAsFile();
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const img = document.createElement("img");
                                        img.src = ev.target?.result as string;
                                        img.style.maxWidth = "100%";
                                        img.style.borderRadius = "8px";
                                        img.style.margin = "8px 0";
                                        const selection = window.getSelection();
                                        if (selection && selection.rangeCount > 0) {
                                          const range = selection.getRangeAt(0);
                                          range.deleteContents();
                                          range.insertNode(img);
                                          range.setStartAfter(img);
                                          range.collapse(true);
                                          selection.removeAllRanges();
                                          selection.addRange(range);
                                        }
                                        // Sync state after image insert
                                        if (notesEditorRef.current) setCompilerNotes(notesEditorRef.current.innerHTML);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                    return;
                                  }
                                }
                              }
                            }}
                            suppressContentEditableWarning
                          />
                        </div>
                      ) : (
                      <div id="compiler-io-container" className="flex-1 flex flex-col overflow-hidden min-h-0">
                        {/* TESTCASE SECTION - Top */}
                        <div 
                          className="flex flex-col overflow-hidden"
                          style={{ flexBasis: `${compilerIOSplit}%`, flexShrink: 0, minHeight: 0 }}
                        >
                          <div className={`px-3 py-2 flex items-center justify-between shrink-0 ${compilerLightMode ? "bg-[#fafafa] border-b border-gray-200" : "bg-[#161b22] border-b border-[#30363d]"}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-green-500 text-xs">◉</span>
                              <span className={`text-xs font-bold ${compilerLightMode ? "text-gray-900" : "text-white"}`}>Testcase</span>
                              <span className={`text-[9px] ${compilerLightMode ? "text-gray-400" : "text-gray-600"}`}>{Math.round(compilerIOSplit)}%</span>
                            </div>
                            <button 
                              onClick={() => setCompilerInput("")}
                              className={`text-[9px] px-2 py-0.5 rounded transition ${compilerLightMode ? "hover:bg-gray-200 text-gray-500" : "hover:bg-white/10 text-white/50"}`}
                              title="Clear input"
                            >Clear</button>
                          </div>
                          <textarea
                            value={compilerInput}
                            onChange={e => setCompilerInput(e.target.value)}
                            placeholder="Enter your test input here...&#10;Example:&#10;5&#10;1 2 3 4 5"
                            className={`w-full flex-1 p-3 font-mono outline-none resize-none border-none ${compilerLightMode ? "bg-white text-gray-800 placeholder:text-gray-400" : "bg-[#0d1117] text-gray-200 placeholder:text-gray-600"}`}
                            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: `${compilerFontSize - 1}px` }}
                          />
                        </div>

                        {/* HORIZONTAL DRAG HANDLE - Between Testcase & Result */}
                        <div
                          className={`drag-handle cursor-row-resize group relative shrink-0 flex items-center justify-center ${compilerLightMode ? "bg-gray-100" : "bg-[#161b22]"}`}
                          style={{ height: "6px" }}
                          onMouseDown={(e) => { e.preventDefault(); setIsDraggingIO(true); }}
                          title="Drag to resize"
                        >
                          <div 
                            className={`w-full transition-all rounded-full ${
                              isDraggingIO 
                                ? "bg-blue-500 h-1" 
                                : "bg-transparent group-hover:bg-blue-400 h-0.5"
                            }`}
                          />
                          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${compilerLightMode ? "text-blue-400" : "text-blue-500"}`}>
                            <svg width="24" height="8" viewBox="0 0 24 8" fill="currentColor"><circle cx="6" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="18" cy="4" r="1.5"/></svg>
                          </div>
                        </div>

                        {/* TEST RESULT SECTION - Bottom */}
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                          <div className={`px-3 py-2 flex items-center justify-between shrink-0 ${compilerLightMode ? "bg-[#fafafa] border-b border-gray-200" : "bg-[#161b22] border-b border-[#30363d]"}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${
                                compilerRunning ? "text-yellow-500" :
                                compilerError && !compilerOutput ? "text-red-500" : 
                                compilerOutput ? "text-green-500" : "text-blue-500"
                              }`}>▶</span>
                              <span className={`text-xs font-bold ${compilerLightMode ? "text-gray-900" : "text-white"}`}>Test Result</span>
                              {compilerRunning && <span className="text-[9px] text-yellow-500 animate-pulse">Running...</span>}
                              {!compilerRunning && compilerOutput && !compilerError && <span className="text-[9px] text-green-500">✓ Accepted</span>}
                              {!compilerRunning && compilerError && <span className="text-[9px] text-red-500">✕ Error</span>}
                            </div>
                            {compilerOutput && (
                              <button 
                                onClick={() => navigator.clipboard.writeText(compilerOutput)}
                                className={`text-[9px] px-2 py-0.5 rounded transition ${compilerLightMode ? "hover:bg-gray-200 text-gray-600" : "hover:bg-white/10 text-white/60"}`}
                              >Copy</button>
                            )}
                          </div>
                          <div className={`flex-1 overflow-y-auto p-3 ${compilerLightMode ? "bg-white" : "bg-[#0d1117]"}`}>
                            {compilerRunning ? (
                              <div className="flex items-center justify-center h-full gap-2">
                                <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full" />
                                <span className="text-[12px] text-green-500 font-medium">Compiling & Running...</span>
                              </div>
                            ) : compilerError ? (
                              <div>
                                <div className={`text-[10px] font-semibold mb-2 ${compilerLightMode ? "text-red-600" : "text-red-400"}`}>Compilation / Runtime Error:</div>
                                <pre className="font-mono text-red-500 whitespace-pre-wrap" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: `${compilerFontSize - 1}px` }}>{compilerError}</pre>
                              </div>
                            ) : compilerOutput ? (
                              <div>
                                <div className={`text-[10px] font-semibold mb-2 ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}>Output:</div>
                                <pre className={`font-mono whitespace-pre-wrap ${compilerLightMode ? "text-gray-800" : "text-green-300"}`} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: `${compilerFontSize - 1}px` }}>{compilerOutput}</pre>
                              </div>
                            ) : (
                              <div className={`flex flex-col items-center justify-center h-full ${compilerLightMode ? "text-gray-400" : "text-gray-600"}`}>
                                <span className="text-4xl mb-2">▶️</span>
                                <span className="text-[12px] font-medium mb-1">You must run your code first</span>
                                <span className="text-[10px] opacity-70">Press Ctrl+Enter or click Run</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      )}

                      {/* OLD Input/Output resizable container - HIDDEN */}
                      <div className="hidden flex-1 flex-col overflow-hidden">
                        {/* Input Section - resizable */}
                        <div 
                          className={`flex flex-col overflow-hidden ${compilerLightMode ? "border-b border-gray-200" : "border-b border-[#30363d]"}`}
                          style={{ height: `${compilerIOSplit}%` }}
                        >
                          <div className={`px-3 py-2 flex items-center justify-between shrink-0 ${compilerLightMode ? "bg-white" : "bg-[#0d1117]"}`}>
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${compilerLightMode ? "text-gray-600" : "text-gray-400"}`}>📥 Custom Input</span>
                            <span className={`text-[9px] ${compilerLightMode ? "text-gray-400" : "text-gray-600"}`}>{Math.round(compilerIOSplit)}%</span>
                          </div>
                          <textarea
                            value={compilerInput}
                            onChange={e => setCompilerInput(e.target.value)}
                            placeholder="5&#10;1 2 3 4 5"
                            className={`w-full flex-1 p-3 font-mono outline-none resize-none border-none ${compilerLightMode ? "bg-gray-50 text-gray-800 placeholder:text-gray-400" : "bg-[#0d1117] text-gray-200 placeholder:text-gray-600"}`}
                            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: `${compilerFontSize - 1}px` }}
                          />
                        </div>

                        {/* IO Drag Handle */}
                        <div
                          className={`drag-handle cursor-row-resize transition-colors group relative shrink-0 ${
                            isDraggingIO 
                              ? "bg-blue-500" 
                              : compilerLightMode 
                                ? "bg-gray-300 hover:bg-blue-400" 
                                : "bg-[#30363d] hover:bg-blue-500"
                          }`}
                          style={{ height: isDraggingIO ? "3px" : "2px" }}
                          onMouseDown={(e) => { e.preventDefault(); setIsDraggingIO(true); }}
                          title="Drag to resize"
                        >
                          <div className="absolute inset-x-0 -top-2 -bottom-2 cursor-row-resize" />
                          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${compilerLightMode ? "text-gray-500" : "text-gray-400"}`}>
                            <svg width="24" height="8" viewBox="0 0 24 8" fill="currentColor"><circle cx="6" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="18" cy="4" r="1.5"/></svg>
                          </div>
                        </div>

                        {/* Output Section - resizable */}
                        <div 
                          className="flex flex-col overflow-hidden"
                          style={{ height: `${100 - compilerIOSplit}%` }}
                        >
                          <div className={`px-3 py-2 flex items-center gap-2 shrink-0 ${compilerLightMode ? "bg-white" : "bg-[#0d1117]"}`}>
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${
                              compilerRunning ? "text-yellow-500" :
                              compilerError && !compilerOutput ? "text-red-500" : 
                              compilerOutput ? "text-green-500" : compilerLightMode ? "text-gray-600" : "text-gray-400"
                            }`}>
                              {compilerRunning ? "⏳ Running..." : 
                               compilerError && !compilerOutput ? "❌ Error" : 
                               compilerOutput ? "✅ Output" : "📤 Output"}
                            </span>
                            {compilerOutput && (
                              <button 
                                onClick={() => navigator.clipboard.writeText(compilerOutput)}
                                className={`ml-auto text-[10px] px-2 py-1 rounded-md transition font-medium ${compilerLightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-600" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
                              >📋 Copy</button>
                            )}
                          </div>
                          <div className={`flex-1 overflow-y-auto p-3 ${compilerLightMode ? "bg-gray-50" : "bg-[#0d1117]"}`}>
                            {compilerRunning ? (
                              <div className="flex items-center justify-center h-full gap-2">
                                <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full" />
                                <span className="text-[12px] text-green-500 font-medium">Compiling...</span>
                              </div>
                            ) : compilerError ? (
                              <pre className={`font-mono text-red-500 whitespace-pre-wrap`} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: `${compilerFontSize - 1}px` }}>{compilerError}</pre>
                            ) : compilerOutput ? (
                              <pre className={`font-mono whitespace-pre-wrap ${compilerLightMode ? "text-gray-800" : "text-green-300"}`} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: `${compilerFontSize - 1}px` }}>{compilerOutput}</pre>
                            ) : (
                              <div className={`flex flex-col items-center justify-center h-full ${compilerLightMode ? "text-gray-400" : "text-gray-600"}`}>
                                <span className="text-3xl mb-2">▶️</span>
                                <span className="text-[11px] font-medium">Run to see output</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
