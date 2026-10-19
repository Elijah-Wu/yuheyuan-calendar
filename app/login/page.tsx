"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage("登入失敗：" + error.message);
      return;
    }

    setMessage("登入成功！");
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-stone-800">
            宇的行事曆
          </h1>

          <p className="mt-2 text-stone-500">
            請登入您的帳號
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500"
              placeholder="請輸入 Email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              密碼
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-500"
              placeholder="請輸入密碼"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-stone-800 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        {message && (
          <p className="mt-5 text-center text-sm text-stone-600">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}