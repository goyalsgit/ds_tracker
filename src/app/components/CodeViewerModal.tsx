"use client";

import { useState } from "react";

type CodeViewerModalProps = {
  title: string;
  code: string;
  language: string;
  onClose: () => void;
  onSave?: (code: string, language: string) => void;
};

export default function CodeViewerModal({
  title,
  code: initialCode,
  language: initialLanguage,
  onClose,
  onSave,
}: CodeViewerModalProps) {
  const [isEditing, setIsEditing] = useState(!initialCode);
  const [code, setCode] = useState(initialCode || "");
  const [language, setLanguage] = useState(initialLanguage || "cpp");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim()) return;
    setSaving(true);
    await onSave?.(code, language);
    setSaving(false);
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    alert("Code copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 bg-[#13151f] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-white/50 mt-1">
              {isEditing ? "Paste your solution code" : "Your solution"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none transition focus:border-indigo-500/50"
                >
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
                  Code
                </label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your solution code here..."
                  className="w-full h-96 rounded-lg border border-white/10 bg-[#0a0c10] px-4 py-3 text-sm text-white font-mono placeholder-white/30 outline-none transition focus:border-indigo-500/50 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!code.trim() || saving}
                  className="flex-1 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : "Save Code"}
                </button>
                {initialCode && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-3 text-sm font-semibold text-white/60 hover:text-white transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Language: {language.toUpperCase()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white border border-white/10 rounded-lg transition"
                  >
                    📋 Copy
                  </button>
                  {onSave && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white border border-white/10 rounded-lg transition"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>

              <pre className="rounded-lg border border-white/10 bg-[#0a0c10] p-4 overflow-x-auto">
                <code className="text-sm text-white font-mono whitespace-pre">
                  {code}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
