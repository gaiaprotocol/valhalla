import { fetchNotices } from '../api/notice';
import type { Notice } from '../types/notice';

function isKoreanLocale(): boolean {
  const navLang =
    (typeof navigator !== 'undefined' && navigator.language) ||
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    '';
  return /^ko(?:-|$)/i.test(navLang);
}

function localizeNotice<T extends Notice>(n: T): T {
  if (!isKoreanLocale()) return n;
  const t = n.translations?.ko;
  if (!t) return n;
  return {
    ...n,
    title: t.title ?? n.title,
    content: t.content ?? n.content,
  };
}

// 간단 메모이즈: 같은 세션에서 중복 fetch 방지
let cached: Notice[] | null = null;
export async function loadLocalizedNotices(): Promise<Notice[]> {
  if (cached) return cached;
  const notices = await fetchNotices();
  cached = notices.map(localizeNotice);
  return cached;
}
