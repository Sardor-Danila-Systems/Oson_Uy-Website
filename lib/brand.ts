/**
 * Статические файлы бренда в `public/`.
 *
 * Полный знак (прозрачный) — шапка/подвал сайта, OG/Twitter, JSON-LD.
 * Мини (прозрачный) — только иконка вкладки браузера (`metadata.icons`) и нативное приложение (`BrandLogo`).
 *
 * JPG — непрозрачный белый фон, если понадобится на непредсказуемом фоне.
 */
export const BRAND_LOGO_WEB_REMOVEDBG = "/osonuy-logo-full-removedbg.png";
/** OG / Twitter / JSON-LD — тот же полный файл */
export const BRAND_IMAGE_OG_PATH = BRAND_LOGO_WEB_REMOVEDBG;
/** Только `metadata.icons` (вкладка) — на сайте в шапку/подвал не подключать */
export const BRAND_IMAGE_ICON_PATH = "/osonuy-logo-mini-removedbg.png";
export const BRAND_IMAGE_FULL_JPG_PATH = "/osonuy-logo-full.jpg";
export const BRAND_IMAGE_MINI_JPG_PATH = "/osonuy-logo-mini.jpg";
