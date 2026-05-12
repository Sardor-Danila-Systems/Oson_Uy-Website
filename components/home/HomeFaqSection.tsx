"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export function HomeFaqSection() {
  const t = useTranslations("Faq");

  return (
    <section id="faq" className="border-t border-slate-200 bg-slate-50/80 py-16 md:py-24">
      <div className="container mx-auto max-w-3xl px-4 md:px-8">
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#1E3A8A] md:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">{t("subtitle")}</p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-2">
          {FAQ_KEYS.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>{t(`items.${key}.question`)}</AccordionTrigger>
              <AccordionContent>
                <p className="leading-relaxed font-medium">{t(`items.${key}.answer`)}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
