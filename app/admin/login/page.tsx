"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      // Set a cookie that expires in 1 day
      document.cookie = `osonuy_admin_key=${key.trim()}; path=/; max-age=86400; SameSite=Strict`;
      router.push("/admin");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl shadow-blue-900/5 border border-slate-100 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1E3A8A] to-[#F97316]"></div>
        
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1E3A8A]">
            <Lock className="h-8 w-8" />
          </div>
        </div>

        <h2 className="mb-2 text-center text-2xl font-black text-slate-800">
          Вход в Админку
        </h2>
        <p className="mb-8 text-center text-sm text-slate-500">
          Управление биллингом платформы OsonUy
        </p>

        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Секретный ключ администратора
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Введите ADMIN_SECRET"
                autoComplete="current-password"
                required
                className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 py-0 pl-4 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#1E3A8A] focus:bg-white focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={showKey ? "Скрыть ключ" : "Показать ключ"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-6 text-sm font-bold text-white transition hover:bg-blue-800 active:scale-[0.98]"
          >
            Войти <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
