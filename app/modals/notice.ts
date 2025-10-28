import { el } from "@webtaku/el";
import { marked } from "marked";
import { Notice } from "../types/notice";

/* ---------- marked 설정 ---------- */
const renderer = new marked.Renderer();
renderer.link = ({ href = "#", title, text }) => {
  const t = title ? ` title="${title}"` : "";
  return `<a href="${href}" target="_blank" rel="noopener noreferrer"${t}>${text}</a>`;
};
marked.setOptions({ renderer });

function typeMeta(t?: string) {
  const v = (t || '').toLowerCase();
  if (v === 'update') return { label: 'Update', color: 'success' as const };
  if (v === 'news') return { label: 'News', color: 'primary' as const };
  const pretty = v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Notice';
  return { label: pretty, color: 'medium' as const };
}

function formatDate(date: string | number) {
  try {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

/* ---------- 타입: 배열 또는 로더 ---------- */
type NoticeModalInput =
  | Notice[]
  | {
    load: () => Promise<Notice[]>;
  };

/**
 * createNoticeModal가 배열 또는 { load }를 받아서,
 * 모달 **최초 표시 시 1회만** 데이터를 로드/렌더합니다.
 * 이후 열림에선 캐시된 데이터를 즉시 사용합니다.
 */
function createNoticeModal(input?: NoticeModalInput): HTMLIonModalElement {
  const modal = el("ion-modal", { trigger: "open-notice" }) as HTMLIonModalElement;

  const modalHeader = el(
    "ion-header",
    el(
      "ion-toolbar",
      el("ion-title", "Notices"),
      el("ion-buttons", { slot: "end" },
        el("ion-button", { onclick: () => modal.dismiss() }, "Close")
      )
    )
  );

  // 비어있는 콘텐츠 컨테이너 + 로딩 표시
  const listContainer = el("ion-list");
  const loading = el("ion-item", el("ion-label", "Loading..."));

  const modalContent = el(
    "ion-content.ion-padding",
    el("div", { style: { minHeight: "80px" } }, loading, listContainer)
  );

  modal.append(modalHeader, modalContent);

  // ---- 캐시 & 로딩 상태 ----
  let cache: Notice[] | null = null;
  let inflight: Promise<Notice[]> | null = null;
  let hasRendered = false;

  async function resolveNoticesOnce(): Promise<Notice[]> {
    if (cache) return cache;
    if (inflight) return inflight;

    if (!input) {
      cache = [];
      return cache;
    }
    if (Array.isArray(input)) {
      cache = input;
      return cache;
    }

    inflight = input.load();
    try {
      cache = await inflight;
      return cache;
    } finally {
      inflight = null;
    }
  }

  function renderList(notices: Notice[]) {
    if (loading.isConnected) loading.remove();

    if (!notices.length) {
      // 중복 방지: replaceChildren로 완전 교체
      (listContainer as HTMLElement).replaceChildren(
        el("ion-item", el("ion-label", "No notices found"))
      );
      hasRendered = true;
      return;
    }

    const items = notices.map((notice) => {
      const tm = typeMeta((notice as any).type);
      return el(
        "ion-item",
        {
          button: true,
          onclick: () => {
            const detailModal = createNoticeDetailModal(notice);
            document.body.appendChild(detailModal);
            detailModal.present();
          },
        },
        // ⬇️ 오른쪽 끝에 타입 배지
        el("ion-badge", { slot: "end", color: tm.color }, tm.label),
        el(
          "ion-label",
          el("h2", notice.title),
          el("p", `${formatDate(notice.createdAt as any)}`)
        )
      );
    });

    // 중복 방지: 기존 자식 전부 교체
    (listContainer as HTMLElement).replaceChildren(...items);
    hasRendered = true;
  }

  // 모달이 열릴 때: 최초 1회만 로드, 이후엔 캐시로 즉시 렌더
  modal.addEventListener("willPresent", async () => {
    if (hasRendered) return;

    if (!loading.isConnected) {
      (modalContent.firstChild as HTMLElement)?.prepend(loading);
    }
    try {
      const notices = await resolveNoticesOnce();
      renderList(notices);
    } catch (e) {
      if (loading.isConnected) loading.remove();
      (listContainer as HTMLElement).replaceChildren(
        el("ion-item", el("ion-label", "Failed to load notices"))
      );
      console.error(e);
    }
  });

  return modal;
}

/* ---------- 상세 모달 ---------- */
function createNoticeDetailModal(notice: Notice): HTMLIonModalElement {
  const detailModal = el("ion-modal") as HTMLIonModalElement;

  const header = el(
    "ion-header",
    el(
      "ion-toolbar",
      el("ion-title", notice.title),
      el("ion-buttons", { slot: "end" },
        el("ion-button", { onclick: () => detailModal.dismiss() }, "Close")
      )
    )
  );

  const content = el("ion-content.ion-padding");
  const mdContainer = el("div");

  // ⬇️ 타입/날짜 메타
  const tm = typeMeta((notice as any).type);
  const metaRow = el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
        opacity: "0.9",
      }
    },
    el("ion-badge", { color: tm.color }, tm.label),
    el("span", { className: "notice-date" }, formatDate(notice.createdAt as any))
  );

  const result = marked.parse(notice.content);
  if (result instanceof Promise) {
    result.then((html) => {
      mdContainer.innerHTML = html;
    });
  } else {
    mdContainer.innerHTML = result;
  }

  // 기존의 date <p>는 제거하고 metaRow로 대체
  content.append(metaRow, mdContainer);
  detailModal.append(header, content);

  return detailModal;
}

export { createNoticeDetailModal, createNoticeModal };
