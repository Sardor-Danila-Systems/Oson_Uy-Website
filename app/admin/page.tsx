"use client";

import { useEffect, useState } from "react";
import { formatUzs } from "@/lib/currency";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_URL = rawApiUrl.replace(/\/$/, "");

type Invoice = {
  id: number;
  projectId: number;
  plan: string;
  amountUzs: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  project: {
    name: string;
    developer: {
      name: string;
      email: string;
    };
  };
};

type Subscription = {
  id: number;
  projectId: number;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  project: {
    name: string;
    developer: {
      name: string;
      email?: string;
    };
  };
};

type PromoCode = {
  id: number;
  code: string;
  description: string | null;
  benefitType: string;
  freeDays: number | null;
  percentOff: number | null;
  plan: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return null;
}

export default function AdminBillingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminKey, setAdminKey] = useState<string | null>(null);

  const [subActionProjectId, setSubActionProjectId] = useState<number | null>(null);
  const [promoTogglingId, setPromoTogglingId] = useState<number | null>(null);
  const [promoCreating, setPromoCreating] = useState(false);

  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoDescription, setNewPromoDescription] = useState("");
  const [newPromoFreeDays, setNewPromoFreeDays] = useState("30");
  const [newPromoPlan, setNewPromoPlan] = useState<string>("");
  const [newPromoMax, setNewPromoMax] = useState("");
  const [newPromoStarts, setNewPromoStarts] = useState("");
  const [newPromoExpires, setNewPromoExpires] = useState("");

  useEffect(() => {
    const key = getCookie("osonuy_admin_key");
    if (!key) {
      router.push("/admin/login");
      return;
    }
    setAdminKey(key);
    fetchData(key);
  }, [router]);

  const adminHeaders = (key: string) => ({
    "Content-Type": "application/json",
    "x-admin-key": key,
  });

  const fetchData = async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [invRes, subRes, promoRes] = await Promise.all([
        fetch(`${API_URL}/billing/admin/invoices`, { headers: { "x-admin-key": key } }),
        fetch(`${API_URL}/billing/admin/subscriptions`, { headers: { "x-admin-key": key } }),
        fetch(`${API_URL}/promo/admin/codes`, { headers: { "x-admin-key": key } }),
      ]);

      if (!invRes.ok || !subRes.ok) {
        throw new Error("Неверный Admin Key или ошибка сервера");
      }
      if (!promoRes.ok) {
        throw new Error("Не удалось загрузить промокоды (проверьте версию API)");
      }

      const invData = await invRes.json();
      const subData = await subRes.json();
      const promoData = await promoRes.json();

      setInvoices(invData);
      setSubscriptions(subData);
      setPromoCodes(Array.isArray(promoData) ? promoData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      if (err instanceof Error && err.message.includes("Неверный Admin Key")) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    document.cookie = "osonuy_admin_key=; path=/; max-age=0";
    router.push("/admin/login");
  };

  const handleConfirmPayment = async (invoiceId: number) => {
    if (!confirm(`Подтвердить оплату по инвойсу #${invoiceId}?`)) return;
    if (!adminKey) return;

    try {
      const res = await fetch(`${API_URL}/billing/admin/confirm-payment`, {
        method: "POST",
        headers: adminHeaders(adminKey),
        body: JSON.stringify({ invoiceId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка подтверждения");
      }

      alert("Оплата успешно подтверждена!");
      fetchData(adminKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const patchSubscription = async (projectId: number, patch: Record<string, unknown>) => {
    if (!adminKey) return;
    setSubActionProjectId(projectId);
    try {
      const res = await fetch(`${API_URL}/billing/admin/subscription`, {
        method: "PATCH",
        headers: adminHeaders(adminKey),
        body: JSON.stringify({ projectId, ...patch }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Ошибка ${res.status}`);
      }
      await fetchData(adminKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubActionProjectId(null);
    }
  };

  const togglePromoActive = async (id: number, active: boolean) => {
    if (!adminKey) return;
    setPromoTogglingId(id);
    try {
      const res = await fetch(`${API_URL}/promo/admin/codes/${id}/active`, {
        method: "PATCH",
        headers: adminHeaders(adminKey),
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Ошибка ${res.status}`);
      }
      await fetchData(adminKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPromoTogglingId(null);
    }
  };

  const createPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey) return;
    const code = newPromoCode.trim().toUpperCase();
    const freeDays = Number(newPromoFreeDays);
    if (!code) {
      alert("Укажите код промокода");
      return;
    }
    if (!Number.isFinite(freeDays) || freeDays < 1) {
      alert("Укажите количество дней (от 1)");
      return;
    }

    setPromoCreating(true);
    try {
      const body: Record<string, unknown> = {
        code,
        benefitType: "FREE_DAYS",
        freeDays,
        active: true,
      };
      if (newPromoDescription.trim()) body.description = newPromoDescription.trim();
      if (newPromoPlan) body.plan = newPromoPlan;
      const maxR = newPromoMax.trim() ? Number(newPromoMax) : null;
      if (maxR != null && Number.isFinite(maxR) && maxR > 0) body.maxRedemptions = maxR;
      if (newPromoStarts) body.startsAt = new Date(newPromoStarts).toISOString();
      if (newPromoExpires) body.expiresAt = new Date(newPromoExpires).toISOString();

      const res = await fetch(`${API_URL}/promo/admin/codes`, {
        method: "POST",
        headers: adminHeaders(adminKey),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Ошибка ${res.status}`);
      }
      setNewPromoCode("");
      setNewPromoDescription("");
      setNewPromoFreeDays("30");
      setNewPromoPlan("");
      setNewPromoMax("");
      setNewPromoStarts("");
      setNewPromoExpires("");
      await fetchData(adminKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPromoCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-500 font-medium">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Админ: биллинг и промокоды</h1>
            <p className="text-sm text-slate-500">OsonUy — счета, подписки, промокоды</p>
          </div>
          <div className="flex items-center gap-2">
            {adminKey ? (
              <button
                type="button"
                onClick={() => fetchData(adminKey)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                Обновить
              </button>
            ) : null}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10 space-y-12">
        {error && (
          <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-red-700 font-medium">
            {error}
          </div>
        )}

        <section>
          <h2 className="mb-6 text-xl font-bold text-slate-800 flex items-center gap-3">
            Счета на оплату
            <span className="bg-orange-100 text-orange-700 text-xs py-1 px-2.5 rounded-full font-black">
              {invoices.length}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold">ID</th>
                  <th className="px-6 py-4 font-bold">Застройщик / Проект</th>
                  <th className="px-6 py-4 font-bold">Тариф</th>
                  <th className="px-6 py-4 font-bold">Сумма (UZS)</th>
                  <th className="px-6 py-4 font-bold">Статус</th>
                  <th className="px-6 py-4 font-bold">Дата</th>
                  <th className="px-6 py-4 font-bold text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Нет счетов
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-black text-slate-400">#{inv.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{inv.project?.developer?.name || "Неизвестно"}</div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">{inv.project?.name || "Без названия"}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-[#F97316]">{inv.plan || "-"}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {inv.amountUzs ? formatUzs(inv.amountUzs) : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : inv.status === "PENDING"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">
                        {new Date(inv.createdAt).toLocaleString("ru-RU")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {inv.status === "PENDING" && (
                          <button
                            onClick={() => handleConfirmPayment(inv.id)}
                            className="rounded-lg bg-[#00C48C] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#00a877] active:scale-95"
                          >
                            Подтвердить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-6 text-xl font-bold text-slate-800 flex items-center gap-3">
            Подписки
            <span className="bg-blue-100 text-blue-700 text-xs py-1 px-2.5 rounded-full font-black">
              {subscriptions.length}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Проект / Застройщик</th>
                  <th className="px-6 py-4 font-bold">Тариф</th>
                  <th className="px-6 py-4 font-bold">Статус</th>
                  <th className="px-6 py-4 font-bold">Начало</th>
                  <th className="px-6 py-4 font-bold">Конец</th>
                  <th className="px-6 py-4 font-bold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      Нет подписок
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{sub.project?.name || "Без названия"}</div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">
                          {sub.project?.developer?.name || "Неизвестно"}
                          {sub.project?.developer?.email ? ` · ${sub.project.developer.email}` : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-[#1E3A8A]">{sub.plan}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${
                            sub.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : sub.status === "TRIAL"
                                ? "bg-blue-100 text-blue-700"
                                : sub.status === "PAST_DUE"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">
                        {sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString("ru-RU") : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">
                        {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("ru-RU") : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={subActionProjectId === sub.projectId}
                            onClick={() => patchSubscription(sub.projectId, { status: "ACTIVE" })}
                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            disabled={subActionProjectId === sub.projectId}
                            onClick={() => patchSubscription(sub.projectId, { status: "CANCELED" })}
                            className="rounded-lg bg-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={subActionProjectId === sub.projectId}
                            onClick={() =>
                              patchSubscription(sub.projectId, {
                                plan: "PRO",
                                status: "ACTIVE",
                                extendDays: 30,
                              })
                            }
                            className="rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                          >
                            +30d Pro
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-bold text-slate-800 flex items-center gap-3">
            Промокоды
            <span className="bg-violet-100 text-violet-700 text-xs py-1 px-2.5 rounded-full font-black">
              {promoCodes.length}
            </span>
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Создавайте коды с бесплатными днями — застройщик активирует их в кабинете в разделе тарифов. Скидка в процентах в API
            пока не применяется при активации.
          </p>

          <form
            onSubmit={createPromo}
            className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Код</label>
              <input
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                placeholder="Например FREE30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Дней бесплатно</label>
              <input
                type="number"
                min={1}
                value={newPromoFreeDays}
                onChange={(e) => setNewPromoFreeDays(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Тариф (опц.)</label>
              <select
                value={newPromoPlan}
                onChange={(e) => setNewPromoPlan(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              >
                <option value="">По умолчанию у проекта</option>
                <option value="START">START</option>
                <option value="PRO">PRO</option>
                <option value="ULTIMATE">ULTIMATE</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Описание (опц.)</label>
              <input
                value={newPromoDescription}
                onChange={(e) => setNewPromoDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                placeholder="Для внутренних заметок"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Лимит активаций</label>
              <input
                type="number"
                min={1}
                value={newPromoMax}
                onChange={(e) => setNewPromoMax(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                placeholder="Без лимита"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Старт (опц.)</label>
              <input
                type="datetime-local"
                value={newPromoStarts}
                onChange={(e) => setNewPromoStarts(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Окончание (опц.)</label>
              <input
                type="datetime-local"
                value={newPromoExpires}
                onChange={(e) => setNewPromoExpires(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={promoCreating}
                className="rounded-xl bg-[#1E3A8A] px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/15 disabled:opacity-60"
              >
                {promoCreating ? "Создание…" : "Создать промокод"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Код</th>
                  <th className="px-6 py-4 font-bold">Тип / дни</th>
                  <th className="px-6 py-4 font-bold">Тариф</th>
                  <th className="px-6 py-4 font-bold">Использовано</th>
                  <th className="px-6 py-4 font-bold">Период</th>
                  <th className="px-6 py-4 font-bold">Статус</th>
                  <th className="px-6 py-4 font-bold text-right">Вкл/выкл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Промокодов пока нет
                    </td>
                  </tr>
                ) : (
                  promoCodes.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900">{p.code}</div>
                        {p.description ? (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{p.description}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold">
                        {p.benefitType}
                        {p.freeDays != null ? ` · ${p.freeDays} дн.` : ""}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#1E3A8A]">{p.plan ?? "—"}</td>
                      <td className="px-6 py-4 text-xs">
                        {p.redeemedCount}
                        {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ""}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {p.startsAt ? new Date(p.startsAt).toLocaleDateString("ru-RU") : "—"} —{" "}
                        {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black uppercase ${
                            p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.active ? "Активен" : "Выкл"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          disabled={promoTogglingId === p.id}
                          onClick={() => togglePromoActive(p.id, !p.active)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {promoTogglingId === p.id ? "…" : p.active ? "Отключить" : "Включить"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
