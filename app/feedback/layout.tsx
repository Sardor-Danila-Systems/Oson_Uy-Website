import type { Metadata } from "next";

/** Страницы отзыва по секретной ссылке не должны попадать в индекс. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
