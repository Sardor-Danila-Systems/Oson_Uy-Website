"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { formatUzs } from "@/lib/currency";
import { CABINET_TOKEN_KEY } from "@/lib/cabinet-token";

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002").replace(
    /\/$/,
    "",
  );
}

type CabinetMe = {
  customer: { name: string; phone: string; verificationToken?: string | null };
  project: { name: string; location: string; developerName?: string | null };
  apartment: {
    number: string;
    floor: number;
    rooms: number;
    areaSqm: number;
    layoutImageUrl?: string | null;
  } | null;
  finances: {
    totalPriceUzs: number;
    paidUzs: number;
    remainingUzs: number;
    debtUzs: number;
  };
  payments: Array<{
    id: number;
    amountUzs: number;
    paidAt: string;
    comment: string | null;
    type: string;
  }>;
  documents: Array<{ id: number; title: string; fileUrl: string }>;
  progress: {
    milestones: Array<{
      id: number;
      title: string;
      done: boolean;
      photoUrls: string[];
    }>;
  };
};

export default function CabinetDashboardPage() {
  const t = useTranslations("Cabinet");
  const router = useRouter();
  const [data, setData] = useState<CabinetMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem(CABINET_TOKEN_KEY)
        : null;
    if (!token) {
      router.replace("/cabinet/login");
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${apiBase()}/customer-cabinet/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.status === 401) {
          window.localStorage.removeItem(CABINET_TOKEN_KEY);
          router.replace("/cabinet/login");
          return;
        }
        if (!res.ok) throw new Error("fail");
        setData((await res.json()) as CabinetMe);
      } catch {
        router.replace("/cabinet/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const logout = () => {
    window.localStorage.removeItem(CABINET_TOKEN_KEY);
    router.push("/cabinet/login");
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        {t("loading")}
      </div>
    );
  }

  const verifyUrl = data.customer.verificationToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cabinet/verify/${data.customer.verificationToken}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-primary">{t("dashboardTitle")}</h1>
          <p className="text-sm font-medium text-slate-500">
            {data.customer.name} · {data.project.name}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
        >
          {t("logout")}
        </button>
      </div>

      <section className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {t("project")}
          </p>
          <p className="font-bold text-slate-900">{data.project.name}</p>
          <p className="text-xs text-slate-500">{data.project.location}</p>
        </div>
        {data.apartment ? (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t("apartment")}
            </p>
            <p className="font-bold text-slate-900">№{data.apartment.number}</p>
            <p className="text-xs text-slate-500">
              {t("floor")} {data.apartment.floor} · {data.apartment.rooms}{" "}
              {t("rooms")} · {data.apartment.areaSqm} м²
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">{t("payments")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase text-slate-400">{t("total")}</p>
            <p className="text-lg font-black">{formatUzs(data.finances.totalPriceUzs)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase text-emerald-700">{t("paid")}</p>
            <p className="text-lg font-black text-emerald-900">
              {formatUzs(data.finances.paidUzs)}
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-[10px] font-black uppercase text-amber-800">{t("remaining")}</p>
            <p className="text-lg font-black text-amber-950">
              {formatUzs(data.finances.remainingUzs)}
            </p>
          </div>
        </div>
        <ul className="mt-6 space-y-2 border-t border-slate-100 pt-4">
          {data.payments.length === 0 ? (
            <li className="text-sm text-slate-400">—</li>
          ) : (
            data.payments.map((p) => (
              <li
                key={p.id}
                className="flex justify-between text-sm font-medium text-slate-700"
              >
                <span>{formatUzs(p.amountUzs)}</span>
                <span className="text-slate-400">
                  {new Date(p.paidAt).toLocaleDateString()} · {p.type}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">{t("progress")}</h2>
        <ul className="mt-4 space-y-2">
          {data.progress.milestones.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
            >
              <span>{m.done ? "✓" : "○"}</span>
              <span className="font-medium text-slate-800">{m.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">{t("documents")}</h2>
        <ul className="mt-3 space-y-2">
          {data.documents.length === 0 ? (
            <li className="text-sm text-slate-400">—</li>
          ) : (
            data.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-primary underline"
                >
                  {d.title}
                </a>
              </li>
            ))
          )}
        </ul>
        {verifyUrl ? (
          <Link
            href={`/cabinet/verify/${data.customer.verificationToken}`}
            className="mt-4 inline-block text-xs font-black uppercase tracking-widest text-accent"
          >
            {t("verifyOpen")}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
