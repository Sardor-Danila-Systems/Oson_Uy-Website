"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CABINET_TOKEN_KEY } from "@/lib/cabinet-token";

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002").replace(
    /\/$/,
    "",
  );
}

export default function CabinetLoginPage() {
  const t = useTranslations("Cabinet");
  const router = useRouter();
  const [phone, setPhone] = useState("+998");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/customer-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\s/g, ""),
          accessCode: code.trim(),
        }),
      });
      if (!res.ok) {
        setErr(t("error"));
        return;
      }
      const data = (await res.json()) as { token: string };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CABINET_TOKEN_KEY, data.token);
      }
      router.push("/cabinet");
    } catch {
      setErr(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
        <h1 className="text-2xl font-black tracking-tight text-primary">
          {t("loginTitle")}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {t("loginSubtitle")}
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t("phone")}
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t("code")}
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold tracking-widest outline-none focus:ring-2 focus:ring-primary/20"
              autoComplete="one-time-code"
            />
          </div>
          {err ? (
            <p className="text-sm font-bold text-red-600">{err}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-primary text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-primary/25 disabled:opacity-60"
          >
            {loading ? t("loading") : t("submit")}
          </button>
        </form>
        <Link
          href="/"
          className="mt-6 block text-center text-xs font-bold text-slate-400 hover:text-primary"
        >
          ←
        </Link>
      </div>
    </div>
  );
}
