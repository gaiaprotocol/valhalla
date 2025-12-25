import { fetchNotices } from '../api/notice';
import type { Notice } from '../types/notice';

// 읽은 공지사항 관리
const STORAGE_KEY = 'valhalla_read_notices';
const INITIALIZED_KEY = 'valhalla_notices_initialized';

function getReadNotices(): Set<number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markAllAsRead(noticeIds: number[]): void {
  try {
    const readNotices = getReadNotices();
    noticeIds.forEach(id => readNotices.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readNotices)));
  } catch (e) {
    console.error('Failed to mark notices as read:', e);
  }
}

// 앱 첫 실행 시 모든 공지사항을 읽음 처리
export async function initializeNoticesIfFirstRun(): Promise<void> {
  const isInitialized = localStorage.getItem(INITIALIZED_KEY);
  if (isInitialized) return;

  try {
    const notices = await loadLocalizedNotices();
    const noticeIds = notices.map(n => n.id);
    markAllAsRead(noticeIds);
    localStorage.setItem(INITIALIZED_KEY, 'true');
  } catch (e) {
    console.error('Failed to initialize notices:', e);
  }
}

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
