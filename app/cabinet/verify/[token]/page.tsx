import { getTranslations } from "next-intl/server";

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002").replace(
    /\/$/,
    "",
  );
}

export default async function CabinetVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("Cabinet");

  let valid = false;
  let projectName = "";
  let buyerName = "";
  try {
    const res = await fetch(`${apiBase()}/customer-auth/verify/${token}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as {
        valid: boolean;
        projectName?: string;
        buyerName?: string;
      };
      valid = body.valid;
      projectName = body.projectName ?? "";
      buyerName = body.buyerName ?? "";
    }
  } catch {
    valid = false;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-black text-primary">{t("verify")}</h1>
      {valid ? (
        <div className="mt-6 space-y-2 rounded-3xl border border-emerald-100 bg-emerald-50 p-8">
          <p className="font-bold text-emerald-900">{projectName}</p>
          <p className="text-sm text-emerald-800">{buyerName}</p>
          <p className="text-xs font-medium text-emerald-700/80">
            Регистрация в системе Oson Uy подтверждена.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-slate-500">Запись не найдена.</p>
      )}
    </div>
  );
}
