// profile-modal.ts
import { ChatProfile, chatProfileService } from "@gaiaprotocol/chat-client";
import {
  createAddressAvatar,
  logout,
  shortenAddress,
  tokenManager,
} from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import Navigo from "navigo";
import { getAddress } from "viem";
import { fetchMyGaiaName } from "../api/gaia-name";
import { fetchGoogleMeByWallet, GOOGLE_LOGIN_PATH, linkGoogleWeb3Wallet, logoutGoogle, unlinkGoogleWeb3Wallet } from "../api/google";
import { fetchMyProfile, fetchProfileByAccount, saveMyProfile } from "../api/profile";

function ensureHiddenNameTrigger() {
  let btn = document.getElementById("open-name-settings");
  if (!btn) {
    btn = el("ion-button", { id: "open-name-settings", style: "display:none" });
    document.body.appendChild(btn);
  }
  return btn as HTMLButtonElement;
}

// 표시명 규칙: nickname이 있으면 사용, .gaia가 없으면 덧붙임 / 없으면 축약주소
function formatDisplayName(nickname: string | null | undefined, addr: string) {
  if (nickname && nickname.trim()) {
    const n = nickname.trim();
    return n.endsWith(".gaia") ? n : `${n}.gaia`;
  }
  return shortenAddress(addr);
}

// ===== Persona(bio) 편집 모달 =====
function openPersonaModal(currentBio: string, onSaved: (newBio: string) => void) {
  const modal = el("ion-modal");

  const title = "Persona";
  const header = el(
    "ion-header",
    el(
      "ion-toolbar",
      el(
        "ion-buttons",
        { slot: "start" },
        el(
          "ion-button",
          { onclick: () => (modal as any).dismiss() },
          el("ion-icon", { slot: "icon-only", name: "chevron-back" }),
        ),
      ),
      el("ion-title", title),
      el(
        "ion-buttons",
        { slot: "end" },
        el("ion-button", { id: "persona-save-btn", strong: true }, "Save"),
      ),
    ),
  );

  const info = el(
    "p",
    {
      style: `
        margin: 0 0 8px 0;
        color: var(--ion-color-medium);
        font-size: 14px;
      `,
    },
    "Tell others about yourself. This shows up in your profile.",
  );

  const textarea = el("ion-textarea", {
    autoGrow: true,
    rows: 6,
    placeholder: "Write your bio…",
    style: "width:100%;",
    value: (currentBio ?? "").toString(),
  }) as HTMLIonTextareaElement;

  const counter = el(
    "div",
    {
      style: `
        display:flex;justify-content: space-between;align-items:center;
        margin-top: 6px;font-size: 12px;color: var(--ion-color-medium);
      `,
    },
    el("span", "Bio"),
    el("span", { id: "persona-counter" }, "0 / 1000"),
  );

  const errorBox = el(
    "div",
    { id: "persona-error", style: "color: var(--ion-color-danger); margin-top:8px; display:none;" },
  );

  const content = el("ion-content.ion-padding", info, textarea, counter, errorBox);
  modal.append(header, content);
  document.body.appendChild(modal);

  const MAX_BIO_LEN = 1000;
  const setCounter = (len: number) => {
    const c = modal.querySelector("#persona-counter");
    if (c) c.textContent = `${len} / ${MAX_BIO_LEN}`;
  };
  const setError = (msg?: string) => {
    const box = modal.querySelector("#persona-error") as HTMLElement;
    if (!box) return;
    box.textContent = msg ?? "";
    box.style.display = msg ? "block" : "none";
  };

  const getVal = () => ((textarea as any).value ?? "").toString();
  const validate = (bio: string) => {
    if (bio.length > MAX_BIO_LEN) return `Bio exceeds maximum length of ${MAX_BIO_LEN}.`;
    if (bio !== bio.normalize("NFC")) return "Bio must be NFC-normalized.";
    return null;
  };

  const refresh = () => {
    const v = getVal();
    setCounter(v.length);
    setError(validate(v) ?? "");
  };

  (textarea as any).addEventListener("ionInput", refresh);
  refresh();

  (modal.querySelector("#persona-save-btn") as HTMLIonButtonElement)?.addEventListener(
    "click",
    async () => {
      const bio = getVal().trim().normalize("NFC");
      const err = validate(bio);
      if (err) return setError(err);
      try {
        const token = tokenManager.getToken(); if (!token) throw new Error('Missing authorization token.');
        await saveMyProfile({ bio }, token);
        (modal as any).dismiss();
        onSaved(bio);

        const toast = document.createElement("ion-toast");
        toast.message = "Bio saved.";
        toast.duration = 1600;
        toast.position = "bottom";
        document.body.appendChild(toast);
        (toast as any).present();
      } catch (e: any) {
        setError(e?.message ?? "Failed to save bio.");
      }
    },
  );

  (modal as any).present();
}

// ===== 메인: 프로필 모달 =====
function createProfileModal(router: Navigo): HTMLElement {
  const myAddress = getAddress(tokenManager.getAddress() || "");
  let avatarContainer: HTMLElement;

  const makeFallbackAvatar = () => {
    const avatar = createAddressAvatar(myAddress);
    avatar.style.width = "64px";
    avatar.style.height = "64px";
    avatar.style.margin = "auto";
    avatar.classList.add("avatar");
    return avatar;
  };

  const updateAvatar = (imageUrl?: string | null) => {
    avatarContainer.style.backgroundImage = "";
    avatarContainer.innerHTML = "";
    if (!imageUrl) {
      avatarContainer.append(makeFallbackAvatar());
      return;
    }
    const img = new Image();
    img.onload = () => {
      avatarContainer.style.backgroundImage = `url("${imageUrl}")`;
      avatarContainer.innerHTML = "";
    };
    img.onerror = () => {
      avatarContainer.append(makeFallbackAvatar());
    };
    img.src = imageUrl;
  };

  const nameSpan = el("span", "Loading…");
  const addressSpan = el("span", myAddress);
  const bioSpan = el(
    "p",
    {
      style: `
        white-space: pre-wrap;
        margin-top: 8px;
        color: var(--ion-color-medium);
        font-size: 14px;
      `,
    },
    "No bio yet",
  );

  const modal = el("ion-modal", { trigger: "open-profile" });

  const profileCard = el(
    "ion-card",
    el(
      "ion-card-header",
      { style: `text-align: center;` },
      (avatarContainer = el(
        "ion-avatar",
        {
          style: `
            width:64px;height:64px;margin:auto;
            background-size: cover;background-position: center;border-radius: 50%;
          `,
        },
        makeFallbackAvatar(),
      )),
      el("ion-card-title", nameSpan),
      el("ion-card-subtitle", addressSpan),
    ),
    el("ion-card-content", el("ion-label", el("h3", "Bio")), bioSpan),
    el(
      "ion-button",
      {
        slot: "end",
        style: "position:absolute;right:16px;top:16px",
        fill: "clear",
        title: "Change avatar (UI TBD)",
      },
      el("ion-icon", { name: "camera" }),
    ),
  );

  const menuItem = (
    icon: string,
    title: string,
    subtitle = "",
    onClick?: () => void,
    rightEl?: HTMLElement,
  ) =>
    el(
      "ion-item",
      { button: !!onClick, onclick: onClick },
      el("ion-icon", { name: icon, slot: "start" }),
      el("ion-label", el("h2", title), subtitle ? el("p", subtitle) : undefined),
      rightEl ? rightEl : el("ion-icon", { name: "chevron-forward", slot: "end" }),
    );

  let gaiaSubtitle = el("p", ""); // 실제 텍스트는 로드 후 세팅

  // 간단 토스트 헬퍼
  const showToast = async (message: string) => {
    const t = document.createElement("ion-toast");
    t.message = message;
    t.duration = 1600;
    t.position = "bottom";
    document.body.appendChild(t);
    await (t as any).present?.();
  };

  let linkItemEl: HTMLElement;
  let unlinkItemEl: HTMLElement;

  const modalContent = el(
    "ion-content.ion-padding",
    profileCard,
    el(
      "ion-list",
      // Gaia Name
      menuItem("sparkles", "Gaia Name", "", async () => {
        const token = tokenManager.getToken(); if (!token) throw new Error('Missing authorization token.');
        const { name } = await fetchMyGaiaName(token);
        const handle = name ? name.replace(/\.gaia$/, "") : "";
        const btn = ensureHiddenNameTrigger();
        if (handle) btn.dataset.initialName = handle;
        btn.click();
      }),

      // Persona (bio만 편집)
      menuItem("person-circle", "Persona", "Edit your bio", () => {
        const current = (bioSpan.textContent ?? "").trim();
        openPersonaModal(current === "No bio yet" ? "" : current, (newBio) => {
          bioSpan.textContent = newBio || "No bio yet";
        });
      }),

      // ─────────────────────────────────────────────────────────────
      // Google 연동 관리 — 상태에 따라 Link/Unlink 토글
      (linkItemEl = menuItem(
        "logo-google",
        "Link Google Account",
        "Connect your Google account",
        () => location.href = GOOGLE_LOGIN_PATH
      )),

      (unlinkItemEl = menuItem(
        "logo-google",
        "Unlink Google Account",
        "Disconnect your Google account from this wallet",
        async () => {
          try {
            const token = tokenManager.getToken(); if (!token) throw new Error('Missing authorization token.');
            await unlinkGoogleWeb3Wallet(token);
            await logoutGoogle()
            await refreshGoogleLinkState();
            await showToast("Google account unlinked.");
          } catch (e: any) {
            await showToast(e?.message ?? "Failed to unlink Google account.");
          }
        },
      )),

      // Logout (앱 로그아웃)
      menuItem("log-out", "Sign Out", "", async () => {
        await logout();
        await logoutGoogle()
        router.navigate("/login");
      }),
    ),
  );

  // 연동 상태 갱신 함수
  const refreshGoogleLinkState = async () => {
    // 기본값: 미연동 → Link 표시, Unlink 숨김
    const showLinked = (linked: boolean) => {
      if (linkItemEl) linkItemEl.style.display = linked ? "none" : "";
      if (unlinkItemEl) unlinkItemEl.style.display = linked ? "" : "none";
    };

    try {
      const token = tokenManager.getToken();
      if (!token) {
        showLinked(false);
        return;
      }
      // Authorization: Bearer <token> 필요
      const result = await fetchGoogleMeByWallet(token);
      // ok=true && google_sub 존재 시 연동으로 판단
      const linked = !!(result?.ok && result?.google_sub);
      showLinked(linked);

      // (선택) Unlink subtitle에 어느 계정인지 힌트 주기
      if (unlinkItemEl) {
        const label = unlinkItemEl.querySelector("ion-label > p");
        if (label) {
          const sub = result?.google_sub
            ? `Linked as ${result.profile?.email}`
            : "Disconnect your Google account from this wallet";
          (label as HTMLElement).textContent = sub;
        }
      }
    } catch {
      // 401/404 등 조회 실패는 미연동으로 간주
      showLinked(false);
    }
  };

  const modalHeader = el(
    "ion-header",
    el(
      "ion-toolbar",
      el(
        "ion-buttons",
        { slot: "start" },
        el(
          "ion-button",
          { onclick: () => (modal as any).dismiss() },
          el("ion-icon", { slot: "icon-only", name: "chevron-back" }),
        ),
      ),
      el("ion-title", { style: "text-align: center;" }, "Profile Settings"),
      el(
        "ion-buttons",
        { slot: "end" },
        el(
          "ion-button",
          { style: "visibility: hidden" },
          el("ion-icon", { slot: "icon-only", name: "ellipsis-vertical" }),
        ),
      ),
    ),
  );

  modal.append(modalHeader, modalContent);

  // ===== 초기 데이터 로드 (/my-profile & /my-name) =====
  (async () => {
    try {
      const token = tokenManager.getToken(); if (!token) throw new Error('Missing authorization token.');
      const [profile, myName] = await Promise.all([fetchMyProfile(token), fetchMyGaiaName(token)]);
      const display = formatDisplayName(profile.nickname ?? (myName?.name ?? ""), myAddress);
      nameSpan.textContent = display;
      gaiaSubtitle.textContent = display;
      updateAvatar(profile.profile_image);
      bioSpan.textContent = (profile.bio ?? "").trim() || "No bio yet";
    } catch {
      nameSpan.textContent = shortenAddress(myAddress);
      bioSpan.textContent = "No bio yet";
    } finally {
      // 프로필 초기 로드 후, Google 연동 상태 갱신
      refreshGoogleLinkState();
    }
  })();

  // 외부 Gaia Name 모달에서 이름 변경 시 표시명만 즉시 갱신 (프로필 닉네임과는 별개)
  window.addEventListener("gaiaName:updated", (e: any) => {
    const newName = e?.detail?.name as string | undefined;
    if (!newName) return;
    const display = `${newName}.gaia`;
    nameSpan.textContent = display;
    gaiaSubtitle.textContent = display;
  });

  // 히든 트리거 보장
  ensureHiddenNameTrigger();

  return modal;
}

export { createProfileModal };

type CreateUserProfileModalOptions = {
  /** personas 서비스에서 bio만 가져오는 함수(반드시 bio만!) */
  loadPersonaBio: (account: string) => Promise<string | null | undefined>;
  /** 추가 액션들(차단/신고 등) */
  extraActions?: Array<{ label: string; icon?: string; onClick: (account: string) => void }>;
  /** 모달 타이틀 */
  title?: string;
};

function createUserProfileModal(accountRaw: string, profile: ChatProfile): HTMLElement {
  const account = (() => {
    try { return getAddress(accountRaw); } catch { return accountRaw; }
  })();

  let avatarContainer!: HTMLElement;

  const makeFallbackAvatar = () => {
    const avatar = createAddressAvatar(account);
    avatar.style.width = "64px";
    avatar.style.height = "64px";
    avatar.style.margin = "auto";
    avatar.classList.add("avatar");
    return avatar;
  };

  const updateAvatar = (imageUrl?: string | null) => {
    avatarContainer.style.backgroundImage = "";
    avatarContainer.innerHTML = "";
    if (!imageUrl) {
      avatarContainer.append(makeFallbackAvatar());
      return;
    }
    const img = new Image();
    img.onload = () => {
      avatarContainer.style.backgroundImage = `url("${imageUrl}")`;
      avatarContainer.innerHTML = "";
    };
    img.onerror = () => {
      avatarContainer.append(makeFallbackAvatar());
    };
    img.src = imageUrl;
  };

  const nameSpan = el("span", "Loading…");
  const addressSpan = el("span", account);
  const bioSpan = el(
    "p",
    {
      style: `
        white-space: pre-wrap;
        margin-top: 8px;
        color: var(--ion-color-medium);
        font-size: 14px;
      `,
    },
    "No bio yet",
  );

  const modal = el("ion-modal") as HTMLElement;

  const profileCard = el(
    "ion-card",
    el(
      "ion-card-header",
      { style: `text-align: center;` },
      (avatarContainer = el(
        "ion-avatar",
        {
          style: `
            width:64px;height:64px;margin:auto;
            background-size: cover;background-position: center;border-radius: 50%;
          `,
        },
        makeFallbackAvatar(),
      )),
      el("ion-card-title", nameSpan),
      el("ion-card-subtitle", addressSpan),
    ),
    el("ion-card-content", el("ion-label", el("h3", "Bio")), bioSpan),
  );

  const modalContent = el("ion-content.ion-padding", profileCard);

  const modalHeader = el(
    "ion-header",
    el(
      "ion-toolbar",
      el(
        "ion-buttons",
        { slot: "start" },
        el(
          "ion-button",
          { onclick: () => (modal as any).dismiss?.() },
          el("ion-icon", { slot: "icon-only", name: "chevron-back" }),
        ),
      ),
      el("ion-title", { style: "text-align: center;" }, "Profile"),
      el(
        "ion-buttons",
        { slot: "end" },
        el(
          "ion-button",
          { style: "visibility: hidden" },
          el("ion-icon", { slot: "icon-only", name: "ellipsis-vertical" }),
        ),
      ),
    ),
  );

  modal.append(modalHeader, modalContent);

  // ===== 1) 챗 프로필(닉네임/이미지) 로딩 — chat 서비스만 사용
  (async () => {
    try {
      await chatProfileService.preload([account]);
      const cached = chatProfileService.getCached(account);
      const display = formatDisplayName(cached?.nickname ?? "", account);
      nameSpan.textContent = display;
      updateAvatar(cached?.profileImage ?? null);
    } catch {
      // 실패해도 최소 표시는 유지
      nameSpan.textContent = shortenAddress(account);
      updateAvatar(null);
    }
  })();

  // ===== 2) bio 로딩 — personas 서비스만 사용
  (async () => {
    try {
      const bio = (await fetchProfileByAccount(account))?.bio;
      bioSpan.textContent = (bio ?? "").trim() || "No bio yet";
    } catch {
      bioSpan.textContent = "No bio yet";
    }
  })();

  // (선택) 이름 변경 브로드캐스트에 반응해 즉시 갱신
  const onGaiaNameUpdated = (e: any) => {
    const { account: accFromEvent, name } = (e?.detail ?? {}) as { account?: string; name?: string };
    if (!accFromEvent || accFromEvent.toLowerCase() !== account.toLowerCase()) return;
    if (!name) return;
    nameSpan.textContent = `${name}.gaia`;
  };
  window.addEventListener("gaiaName:updated", onGaiaNameUpdated as EventListener);

  // 모달 제거 시 정리
  (modal as any).addEventListener?.("ionModalDidDismiss", () => {
    window.removeEventListener("gaiaName:updated", onGaiaNameUpdated as EventListener);
  });

  return modal;
}

/** 바로 띄우기 헬퍼 */
function openUserProfileModal(account: string, profile: ChatProfile) {
  const modal = createUserProfileModal(account, profile);
  document.body.appendChild(modal);
  (modal as any).present?.() || (modal as any).showModal?.();
  return modal;
}

export { createUserProfileModal, openUserProfileModal };
