"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

/* ─── Theme ──────────────────────────────────────────────────────────────── */
// Clean, professional theme inspired by VedaAI with light gray/blue background
function getTheme(light: boolean) {
  return {
    // Page - Light gray/blue background like VedaAI
    pageBg:      light ? "bg-[#f0f4f8]" : "bg-[#0d1117]",
    // Navbar - White with subtle shadow
    navBg:       light ? "bg-white border-gray-200 shadow-sm" : "bg-[#161b22] border-[#30363d] shadow-lg",
    navText:     light ? "text-gray-900"          : "text-[#e6edf3]",
    navMuted:    light ? "text-gray-600"          : "text-[#7d8590]",
    navBtn:      light ? "border-gray-300 text-gray-900 hover:bg-gray-50 hover:border-gray-400 font-semibold" : "border-[#30363d] text-[#e6edf3] hover:border-[#1f6feb] hover:bg-[#21262d] font-semibold",
    tabActive:   light ? "bg-gray-900 text-white font-bold shadow-md" : "bg-[#1f6feb] text-white font-bold shadow-lg",
    tabInactive: light ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-semibold" : "text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] font-semibold",
    tabWrap:     light ? "bg-gray-100"            : "bg-[#161b22]",
    // Cards - Pure white with subtle shadow
    card:        light ? "bg-white border-gray-200 shadow-sm" : "bg-[#161b22] border-[#30363d] shadow-xl",
    cardDark:    light ? "bg-gray-900 text-white shadow-md"           : "bg-[#0d1117] text-[#e6edf3] border-[#30363d] shadow-xl",
    // Text - Clean, readable
    textPrimary: light ? "text-gray-900 font-semibold"          : "text-[#e6edf3] font-semibold",
    textMuted:   light ? "text-gray-600 font-medium"          : "text-[#7d8590] font-medium",
    textFaint:   light ? "text-gray-500"          : "text-[#7d8590]",
    textVfaint:  light ? "text-gray-400"          : "text-[#6e7681]",
    // Inputs - Clean white
    input:       light ? "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 font-medium" : "border-[#30363d] bg-[#0d1117] text-[#e6edf3] placeholder-[#7d8590] focus:border-[#1f6feb] focus:ring-2 focus:ring-[#1f6feb]/20 font-medium",
    select:      light ? "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 font-medium" : "border-[#30363d] bg-[#0d1117] text-[#e6edf3] focus:border-[#1f6feb] focus:ring-2 focus:ring-[#1f6feb]/20 font-medium",
    // Rows / items
    row:         light ? "border-gray-200 hover:bg-gray-50" : "border-[#30363d] hover:bg-[#161b22]",
    rowBg:       light ? "bg-gray-50 border-gray-200"       : "bg-[#161b22] border-[#30363d]",
    // Tags - Subtle gray
    tag:         light ? "bg-gray-100 text-gray-700 border-gray-200 font-semibold"        : "bg-[#1f6feb]/15 text-[#58a6ff] border-[#1f6feb]/30 font-semibold",
    // Divider
    divider:     light ? "bg-gray-200"            : "bg-[#30363d]",
    // Table
    tableHead:   light ? "bg-gray-50 border-gray-200 text-gray-900 font-bold" : "bg-[#161b22] border-[#30363d] text-[#e6edf3] font-bold",
    tableRow:    light ? "border-gray-200 hover:bg-gray-50" : "border-[#30363d] hover:bg-[#161b22]",
    // Dashed empty state
    dashed:      light ? "border-gray-300 text-gray-500 font-medium"    : "border-[#30363d] text-[#7d8590] font-medium",
    // Revision card - Clean white with shadow
    revisionCard: light ? "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md shadow-sm" : "border-[#30363d] bg-[#161b22] hover:border-[#1f6feb] hover:shadow-2xl shadow-lg",
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

  /* ── Auth ── */
  useEffect(() => {
    try {
      const sb = getSupabaseBrowser();
      sb.auth.getSession().then(({ data }) => {
        setToken(data.session?.access_token ?? null);
        setUserEmail(data.session?.user?.email ?? null);
        setAuthStatus(data.session ? "in" : "out");
      });
      const { data: l } = sb.auth.onAuthStateChange((_e, s) => {
        setToken(s?.access_token ?? null);
        setUserEmail(s?.user?.email ?? null);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
      if (error) throw error;
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Sign-in failed"); }
    finally { setSigningIn(false); }
  };
  const signOut = async () => {
    try {
      await getSupabaseBrowser().auth.signOut();
      setSolves([]); setTodayRevisions([]); setUpcomingRevisions([]); setHistory([]); setStats(null);
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-6">
            <motion.div 
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${lightMode ? "bg-[#0969da]" : "bg-[#1f6feb]"}`}>
                <span className="text-lg font-bold text-white">D</span>
              </div>
              <div>
                <span className={`text-base font-semibold ${t.navText}`}>DSA Tracker</span>
                <p className={`text-[10px] ${t.navMuted}`}>Spaced Repetition System</p>
              </div>
            </motion.div>
            <div className={`flex gap-1 rounded-lg p-1 ${t.tabWrap}`}>
              {(["dashboard", "questions", "analysis", "learn"] as Tab[]).map((tab2, idx) => (
                <motion.button 
                  key={tab2} 
                  onClick={() => setTab(tab2)}
                  className={`rounded-md px-4 py-2 text-xs font-semibold transition-all ${tab === tab2 ? t.tabActive : t.tabInactive}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {tab2 === "questions" ? "Questions" : tab2 === "analysis" ? "AI Analysis" : tab2 === "learn" ? "🎓 Learn" : "Dashboard"}
                </motion.button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button 
              onClick={() => setLightMode(p => !p)}
              className={`rounded-lg border px-3 py-2 text-base transition-all ${t.navBtn}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Toggle light/dark mode"
            >
              {lightMode ? "🌙" : "☀️"}
            </motion.button>
            {authStatus === "loading" ? <span className={`text-xs ${t.navMuted}`}>Loading…</span>
              : authStatus === "in" ? (
                <>
                  <span className={`hidden text-xs font-medium sm:block ${t.navMuted}`}>{userEmail}</span>
                  <motion.button 
                    onClick={signOut} 
                    className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${t.navBtn}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign out
                  </motion.button>
                </>
              ) : (
                <motion.button 
                  onClick={signIn} 
                  disabled={signingIn}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-all ${lightMode ? "bg-[#0969da] hover:bg-[#0860ca]" : "bg-[#1f6feb] hover:bg-[#1a5edb]"}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {signingIn ? "Signing in…" : "Sign in with Google"}
                </motion.button>
              )}
          </div>
        </div>
      </motion.nav>
      {authError && <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-2 text-center text-xs text-red-400">{authError}</div>}

      <div className="mx-auto max-w-[1600px] px-12 py-7">

        {/* ════════════════════════════════════════════════════════════════
            DASHBOARD TAB
        ════════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="flex flex-col gap-6">

            {/* Stats */}
            {stats ? (
              <motion.div 
                className="grid grid-cols-2 gap-4 sm:grid-cols-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {[
                  { label: "Total Solved", value: stats.totalSolved, color: lightMode ? "#0969da" : "#58a6ff", borderGradient: "from-[#0969da] to-[#1f6feb]", icon: "📊" },
                  { label: "Easy", value: stats.easySolved, color: lightMode ? "#1a7f37" : "#3fb950", borderGradient: "from-[#1a7f37] to-[#3fb950]", icon: "✅" },
                  { label: "Medium", value: stats.mediumSolved, color: lightMode ? "#bf8700" : "#d29922", borderGradient: "from-[#bf8700] to-[#d29922]", icon: "⚡" },
                  { label: "Hard", value: stats.hardSolved, color: lightMode ? "#cf222e" : "#f85149", borderGradient: "from-[#cf222e] to-[#f85149]", icon: "🔥" },
                ].map((s, idx) => (
                  <motion.div 
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.1 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    className={`group relative overflow-hidden rounded-2xl p-6 transition-all cursor-pointer ${lightMode ? "bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl" : "bg-[#161b22]/50 backdrop-blur-md shadow-xl hover:shadow-2xl"}`}
                  >
                    {/* Gradient border */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${s.borderGradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
                    <div className={`absolute inset-[1px] rounded-2xl ${lightMode ? "bg-white" : "bg-[#0d1117]"}`} />
                    
                    {/* Content */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <p className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>{s.label}</p>
                        <span className="text-3xl">{s.icon}</span>
                      </div>
                      <p className="text-5xl font-black mb-4" style={{ color: s.color }}>{s.value}</p>
                      <div className={`h-2.5 rounded-full overflow-hidden ${lightMode ? "bg-[#eaeef2]" : "bg-[#21262d]"}`}>
                        <motion.div 
                          className={`h-full rounded-full bg-gradient-to-r ${s.borderGradient}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((s.value / (stats.totalSolved || 1)) * 100, 100)}%` }}
                          transition={{ duration: 1, delay: idx * 0.1 + 0.3 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  className={`group relative overflow-hidden rounded-2xl p-6 transition-all cursor-pointer ${lightMode ? "bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl" : "bg-[#161b22]/50 backdrop-blur-md shadow-xl hover:shadow-2xl"}`}
                >
                  {/* Gradient border */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#bc4c00] to-[#f0883e] opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className={`absolute inset-[1px] rounded-2xl ${lightMode ? "bg-white" : "bg-[#0d1117]"}`} />
                  
                  {/* Content */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <p className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Streak</p>
                      <motion.span 
                        className="text-3xl"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        🔥
                      </motion.span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <p className="text-5xl font-black" style={{ color: lightMode ? "#bc4c00" : "#f0883e" }}>{streak}</p>
                      <span className={`text-base font-bold ${t.textMuted}`}>days</span>
                    </div>
                    <p className={`text-sm font-bold ${t.textMuted}`}>
                      {streak === 0 ? "Start today! 🚀" : streak >= 7 ? "On fire! 🔥" : "Keep going! 💪"}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-2xl px-6 py-12 text-center ${lightMode ? "bg-white/80 backdrop-blur-sm shadow-lg" : "bg-[#161b22]/50 backdrop-blur-md shadow-xl"}`}
              >
                {/* Gradient border */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0969da] to-[#1f6feb] opacity-20" />
                <div className={`absolute inset-[1px] rounded-2xl ${lightMode ? "bg-white" : "bg-[#0d1117]"}`} />
                
                {/* Content */}
                <div className="relative">
                  <motion.div 
                    className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl ${lightMode ? "bg-[#ddf4ff]" : "bg-[#0969da]/10"}`}
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <span className="text-4xl">📊</span>
                  </motion.div>
                  <p className={`text-xl font-bold mb-3 ${t.textPrimary}`}>
                    {authStatus !== "in" ? "Welcome to DSA Tracker!" : "Ready to Start?"}
                  </p>
                  <p className={`text-base font-medium ${t.textMuted}`}>
                    {authStatus !== "in" ? "Sign in with Google to start tracking your progress." : "Enter your LeetCode username and sync to load stats."}
                  </p>
                </div>
              </motion.div>
            )}

            {/* 3-col layout */}
            <div className="grid gap-5 lg:grid-cols-[340px_1fr_320px]">

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
                <div className={`rounded-xl border p-5 ${t.card}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-sm font-semibold ${t.textPrimary}`}>Today&apos;s Revision Queue</p>
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-white/40">{todayKey}</span>
                  </div>
                  <p className={`text-xs mb-4 ${t.textFaint}`}>
                    {pending.length === 0 && done.length === 0
                      ? authStatus !== "in" ? "Sign in to see your queue." : "Nothing due today — great work!"
                      : `${pending.length} pending · ${done.length} completed`}
                  </p>

                  {/* Progress bar */}
                  {todayRevisions.length > 0 && (
                    <div className="mb-4">
                      <div className={`flex justify-between text-[11px] mb-1.5 ${t.textFaint}`}>
                        <span>Progress</span>
                        <span>{done.length}/{todayRevisions.length}</span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${lightMode ? "bg-zinc-200" : "bg-white/10"}`}>
                        <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${todayRevisions.length > 0 ? (done.length / todayRevisions.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5">
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
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`h-2 w-2 shrink-0 rounded-full ${dc.dot}`} />
                                <p className={`truncate text-base font-semibold leading-tight ${t.textPrimary}`}>{item.title}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-wrap">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lightMode ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"}`}>
                                  {item.label}
                                </span>
                                {item.difficulty && <span className={`text-xs font-semibold ${dc.text}`}>{item.difficulty}</span>}
                                {item.tags && item.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className={`rounded-full px-2 py-0.5 text-[10px] ${t.tag}`}>{tag}</span>
                                ))}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`block rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "overdue" ? lightMode ? "bg-yellow-100 text-yellow-700 border border-yellow-300" : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" : lightMode ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white/5 text-white/40"}`}>
                                {item.status === "overdue" ? "⚠️ Overdue" : "📅 Due Today"}
                              </span>
                              <span className={`block mt-1 text-[10px] ${t.textFaint}`}>{formatDate(item.dueOn)}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.sourceUrl && (
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer"
                                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${lightMode ? "border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"}`}>
                                Attempt on LeetCode ↗
                              </a>
                            )}
                            <button onClick={() => markRevision(item.id, "done")}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${lightMode ? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200" : "bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20"}`}>
                              ✓ Mark Done
                            </button>
                            <button onClick={() => markRevision(item.id, "failed")}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${lightMode ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"}`}>
                              ✗ Failed
                            </button>
                            {/* AI buttons */}
                            <button onClick={() => getCardHint(item)}
                              disabled={cardAI[item.id]?.loading}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${lightMode ? "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100" : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"}`}>
                              {cardAI[item.id]?.loading ? "…" : "💡 Hint"}
                            </button>
                            <button onClick={() => getCardSummary(item)}
                              disabled={cardAI[item.id]?.loading}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${lightMode ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"}`}>
                              {cardAI[item.id]?.loading ? "…" : "📖 Summary"}
                            </button>
                          </div>
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
          </div>
        )}


        {/* ════════════════════════════════════════════════════════════════
            QUESTION LIST TAB - LeetCode Style
        ════════════════════════════════════════════════════════════════ */}
        {tab === "questions" && (
          <div className="flex flex-col gap-5">

            {/* Toolbar */}
            <div className={`rounded-xl border p-4 ${lightMode ? "bg-white border-zinc-200" : "bg-[#1c1c1c] border-white/[0.08]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <input value={fSearch} onChange={e => setFSearch(e.target.value)}
                    placeholder="🔍 Search problems…"
                    className={`w-52 rounded-lg border px-3 py-2 text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400" : "bg-[#282828] border-white/10 text-white placeholder:text-white/40"}`} />
                  <select value={fDiff} onChange={e => setFDiff(e.target.value as typeof fDiff)}
                    className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900" : "bg-[#282828] border-white/10 text-white"}`}>
                    <option value="All">All Difficulties</option>
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                  <select value={fTag} onChange={e => setFTag(e.target.value)}
                    className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900" : "bg-[#282828] border-white/10 text-white"}`}>
                    <option value="">All Topics</option>
                    {allTags.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value as typeof fStatus)}
                    className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${lightMode ? "bg-white border-zinc-300 text-zinc-900" : "bg-[#282828] border-white/10 text-white"}`}>
                    <option value="All">All Status</option>
                    <option value="complete">✓ All Stages Done</option>
                    <option value="in-progress">⏳ In Progress</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg px-3 py-2 text-sm font-semibold ${lightMode ? "bg-zinc-100 text-zinc-700" : "bg-white/5 text-white/60"}`}>
                    {filtered.length} problems
                  </span>
                  <button onClick={() => exportCSV(filtered)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${lightMode ? "border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "border-white/10 text-white/70 hover:bg-white/5"}`}>
                    ↓ Export
                  </button>
                  <button onClick={handleSync} disabled={syncing}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${lightMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-500 text-white hover:bg-indigo-400"}`}>
                    {syncing ? "Syncing…" : "↻ Sync"}
                  </button>
                </div>
              </div>
            </div>

            {/* LeetCode-style List */}
            <div className={`rounded-xl border overflow-hidden ${lightMode ? "border-zinc-200" : "border-white/[0.08]"}`}>
              {filtered.length === 0 ? (
                <div className={`p-12 text-center ${lightMode ? "bg-white" : "bg-[#1c1c1c]"}`}>
                  <p className={`text-sm font-medium ${lightMode ? "text-zinc-500" : "text-white/40"}`}>
                    {solves.length === 0 ? "No problems yet. Sync LeetCode or add manually." : "No problems match your filters."}
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
                  <div key={solve.id} className={`group flex items-center border-b px-5 py-3 transition-colors ${lightMode ? "border-zinc-200 hover:bg-zinc-100" : "border-white/[0.08] hover:bg-[#2d2d2d]"} ${isEven ? (lightMode ? "bg-zinc-100/60" : "bg-[#262626]") : (lightMode ? "bg-white" : "bg-[#1a1a1a]")} ${allDone ? "opacity-50" : ""}`}>
                    
                    {/* Serial Number */}
                    <div className={`w-12 shrink-0 text-sm ${lightMode ? "text-zinc-500" : "text-white/40"}`}>
                      {idx + 1}
                    </div>

                    {/* Status Icon */}
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      {allDone && <span className={`text-base ${lightMode ? "text-green-600" : "text-green-500"}`} title="All revisions complete">✓</span>}
                      {inProgress && <span className="text-base text-yellow-500" title="Revisions in progress">⏳</span>}
                    </div>
                    
                    {/* Problem Title */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        {solve.sourceUrl ? (
                          <a href={solve.sourceUrl} target="_blank" rel="noreferrer"
                            className={`font-medium hover:text-indigo-500 transition ${lightMode ? "text-zinc-900" : "text-white"}`}>
                            {solve.title}
                          </a>
                        ) : (
                          <span className={`font-medium ${lightMode ? "text-zinc-900" : "text-white"}`}>{solve.title}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Tags */}
                    <div className="w-80 shrink-0 flex items-center gap-1.5 pr-4">
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
                    
                    {/* Difficulty */}
                    <div className="w-24 shrink-0 text-center">
                      <span className={`text-sm font-medium ${dc.text}`}>
                        {solve.difficulty}
                      </span>
                    </div>

                    {/* Last Solved - Beautiful Badge Format */}
                    <div className="w-28 shrink-0 flex justify-center">
                      {(() => {
                        // Try lastSolvedAt first, fallback to solvedOn
                        const dateToShow = solve.lastSolvedAt || solve.solvedOn;
                        if (dateToShow) {
                          const d = new Date(dateToShow);
                          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                          const formattedDate = `${months[d.getMonth()]} ${d.getDate()}`;
                          return (
                            <span className={`inline-block rounded px-2.5 py-1 text-xs font-medium ${lightMode ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>
                              {formattedDate}
                            </span>
                          );
                        }
                        return <span className={`text-sm ${lightMode ? "text-zinc-400" : "text-white/20"}`}>—</span>;
                      })()}
                    </div>
                    
                    {/* Revision Stages */}
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {[1,2,3].map(n => {
                        const stage = solve.revisionStages.find(r => r.stage === n);
                        return (
                          <div key={n} className="flex flex-col items-center gap-1">
                            {stage ? (
                              <>
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${stageStyle(stage.status)}`}
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
          <div className={`flex h-[calc(100vh-120px)] gap-0 rounded-xl overflow-hidden border ${t.card}`}>

            {/* ════ LEFT SIDEBAR ════ */}
            <div className={`flex w-64 shrink-0 flex-col border-r ${lightMode ? "border-gray-200 bg-[#f6f8fa]" : "border-[#30363d] bg-[#0d1117]"}`}>
              {/* Sidebar header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${t.textFaint}`}>Topics</span>
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
              <div className={`px-3 py-2 border-b ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
                <input
                  value={learnSearch}
                  onChange={e => setLearnSearch(e.target.value)}
                  placeholder="Search..."
                  className={`w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition ${t.input}`}
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
                        className={`flex w-full items-center gap-1.5 px-4 py-1.5 text-left transition ${lightMode ? "hover:bg-gray-100" : "hover:bg-white/5"}`}
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
                            className={`flex w-full items-start gap-2 px-4 py-2 text-left transition-colors ${
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
              <div className={`border-t px-3 py-2 ${lightMode ? "border-gray-200" : "border-[#30363d]"}`}>
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
            <div className="flex flex-1 flex-col overflow-hidden">
              {selectedEntry ? (
                <>
                  {/* Entry header bar */}
                  <div className={`flex items-center justify-between gap-3 border-b px-6 py-3 shrink-0 ${lightMode ? "border-gray-200 bg-white" : "border-[#30363d] bg-[#161b22]"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${lightMode ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/20 text-indigo-300"}`}>
                        {selectedEntry.topic}
                      </span>
                      {selectedEntry.sub_topic && <span className={`text-xs shrink-0 ${t.textFaint}`}>› {selectedEntry.sub_topic}</span>}
                      <h2 className={`text-sm font-bold truncate ${t.textPrimary}`}>{selectedEntry.title}</h2>
                      {selectedEntry.difficulty && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${diffColor(selectedEntry.difficulty as Difficulty).badge}`}>
                          {selectedEntry.difficulty}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleFavorite(selectedEntry)}
                        className={`text-base transition hover:scale-110 ${selectedEntry.is_favorite ? "" : "opacity-30 hover:opacity-70"}`}
                      >{selectedEntry.is_favorite ? "⭐" : "☆"}</button>
                      <button
                        onClick={() => { handleEditLearnEntry(selectedEntry); }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${lightMode ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200" : "bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/20"}`}
                      >✏️ Edit</button>
                      <button
                        onClick={() => handleDeleteLearnEntry(selectedEntry.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${lightMode ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200" : "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20"}`}
                      >🗑 Delete</button>
                    </div>
                  </div>

                  {/* Entry body */}
                  <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-5 ${lightMode ? "bg-white" : "bg-[#0d1117]"}`}>

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
                      <div className={`rounded-lg border p-4 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161b22] border-[#30363d]"}`}>
                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${t.textFaint}`}>📋 Problem Statement</p>
                        <p className={`text-sm leading-relaxed whitespace-pre-line ${t.textPrimary}`}>{selectedEntry.question_text}</p>
                      </div>
                    )}

                    {/* Intuition */}
                    {selectedEntry.intuition && (
                      <div className={`rounded-lg border p-4 ${lightMode ? "bg-amber-50 border-amber-200" : "bg-yellow-500/10 border-yellow-500/20"}`}>
                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${lightMode ? "text-amber-600" : "text-yellow-400"}`}>💡 Key Insight</p>
                        <p className={`text-sm leading-relaxed whitespace-pre-line ${lightMode ? "text-amber-900" : "text-yellow-100"}`}>{selectedEntry.intuition}</p>
                      </div>
                    )}

                    {/* Explanation */}
                    {selectedEntry.explanation && (
                      <div>
                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${t.textFaint}`}>📝 Approach</p>
                        <p className={`text-sm leading-relaxed whitespace-pre-line ${t.textPrimary}`}>{selectedEntry.explanation}</p>
                      </div>
                    )}

                    {/* Code */}
                    <div>
                      <div className={`flex items-center justify-between rounded-t-lg px-4 py-2 ${lightMode ? "bg-gray-800" : "bg-[#161b22] border border-b-0 border-[#30363d]"}`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          💻 {selectedEntry.language.toUpperCase()} Solution
                        </span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(selectedEntry.code_solution); }}
                          className="text-[11px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition"
                        >📋 Copy</button>
                      </div>
                      <pre className={`text-xs font-mono leading-relaxed rounded-b-lg p-4 overflow-x-auto ${lightMode ? "bg-gray-900 text-green-300" : "bg-[#0d1117] text-green-300 border border-t-0 border-[#30363d]"}`}>
                        {selectedEntry.code_solution}
                      </pre>
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

                    {/* Row 1: topic + sub-topic */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Topic *</label>
                        <input value={learnForm.topic} onChange={e => setLearnForm(p => ({...p, topic: e.target.value}))}
                          placeholder="Arrays, Trees, DP…"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Sub-Topic</label>
                        <input value={learnForm.subTopic} onChange={e => setLearnForm(p => ({...p, subTopic: e.target.value}))}
                          placeholder="Sliding Window, BFS…"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                    </div>

                    {/* Row 2: title */}
                    <div>
                      <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Title *</label>
                      <input value={learnForm.title} onChange={e => setLearnForm(p => ({...p, title: e.target.value}))}
                        placeholder="Two Sum, LCA of BST…"
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                    </div>

                    {/* Row 3: difficulty + language + tags */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Difficulty</label>
                        <select value={learnForm.difficulty} onChange={e => setLearnForm(p => ({...p, difficulty: e.target.value}))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.select}`}>
                          <option>Easy</option><option>Medium</option><option>Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Language</label>
                        <select value={learnForm.language} onChange={e => setLearnForm(p => ({...p, language: e.target.value}))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.select}`}>
                          <option value="cpp">C++</option>
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                          <option value="javascript">JS</option>
                        </select>
                      </div>
                      <div>
                        <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Tags</label>
                        <input value={learnForm.tags} onChange={e => setLearnForm(p => ({...p, tags: e.target.value}))}
                          placeholder="dp, hash, bfs"
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${t.input}`} />
                      </div>
                    </div>

                    {/* Code — most important field */}
                    <div>
                      <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>Code Solution *</label>
                      <textarea value={learnForm.codeSolution} onChange={e => setLearnForm(p => ({...p, codeSolution: e.target.value}))}
                        placeholder="Paste your solution here…"
                        rows={9} className={`w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none resize-y ${t.input}`} />
                    </div>

                    {/* Intuition */}
                    <div>
                      <label className={`text-[11px] font-bold mb-1 block ${t.textMuted}`}>💡 Key Insight (optional)</label>
                      <textarea value={learnForm.intuition} onChange={e => setLearnForm(p => ({...p, intuition: e.target.value}))}
                        placeholder="The aha moment — e.g. use a hash map to get O(1) lookup"
                        rows={2} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${t.input}`} />
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

          </div>
        )}

      </div>
    </div>
  );
}
