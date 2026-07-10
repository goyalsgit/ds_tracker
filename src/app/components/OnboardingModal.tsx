"use client";

import { useState } from "react";

type OnboardingModalProps = {
  onComplete: (username: string) => void;
  onSignOut: () => void;
  userEmail: string;
};

export default function OnboardingModal({ onComplete, onSignOut, userEmail }: OnboardingModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter your LeetCode username");
      return;
    }

    setLoading(true);
    onComplete(trimmed);
  };

  const handleSignOut = () => {
    if (loading) return;
    onSignOut();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13151f] shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-bold text-white">
              D
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Welcome to DSA Tracker!</h2>
              <p className="text-xs text-white/50">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <p className="text-sm text-white/70 mb-4 leading-relaxed">
              To get started, we need your LeetCode username to sync your solved problems and create a revision schedule.
            </p>
            <p className="text-xs text-white/50 mb-4">
              💡 This is a <strong className="text-white/70">one-time setup</strong>. Your username will be saved permanently with your profile.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
              LeetCode Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/30 outline-none transition focus:border-indigo-500/50 focus:bg-white/[0.07]"
            />
            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}
          </div>

          <div className="mb-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-xs text-blue-300 leading-relaxed">
              <strong className="font-semibold">What happens next:</strong>
              <br />
              1. We'll sync your LeetCode submissions
              <br />
              2. Create a spaced repetition schedule
              <br />
              3. Auto-sync on every login (no manual clicking!)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
          >
            {loading ? "Setting up your profile..." : "Continue →"}
          </button>

          <div className="mt-4 flex items-center justify-between text-xs">
            <p className="text-white/40">
              You can change this later in settings
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="text-red-400 hover:text-red-300 font-medium disabled:opacity-50 transition"
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
