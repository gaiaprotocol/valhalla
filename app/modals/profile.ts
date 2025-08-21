import { chatProfileService } from "@gaiaprotocol/chat-client";
import {
  createAddressAvatar,
  logout,
  shortenAddress,
  tokenManager,
} from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import Navigo from "navigo";
import { getAddress } from "viem";

function createInfoModal(title: string, message: string) {
  const modal = el("ion-modal");

  const header = el(
    "ion-header",
    el(
      "ion-toolbar",
      el("ion-title", title),
      el(
        "ion-buttons",
        { slot: "end" },
        el("ion-button", { onclick: () => modal.dismiss() }, "Close")
      )
    )
  );

  const content = el(
    "ion-content.ion-padding",
    el("div", { style: `text-align: center;` }, message)
  );

  modal.append(header, content);
  return modal;
}

function ensureHiddenNameTrigger() {
  let btn = document.getElementById("open-name-settings");
  if (!btn) {
    btn = el("ion-button", { id: "open-name-settings", style: "display:none" });
    document.body.appendChild(btn);
  }
  return btn;
}

// 표시명 규칙: nickname이 있으면 사용, .gaia가 없으면 덧붙임 / 없으면 축약주소
function formatDisplayName(nickname: string | null | undefined, addr: string) {
  if (nickname && nickname.trim()) {
    const n = nickname.trim();
    return n.endsWith('.gaia') ? n : `${n}.gaia`;
  }
  return shortenAddress(addr);
}

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
            width:64px;
            height:64px;
            margin:auto;
            background-size: cover;
            background-position: center;
            border-radius: 50%;
          `,
        },
        makeFallbackAvatar()
      )),
      el("ion-card-title", nameSpan),
      el("ion-card-subtitle", addressSpan)
    ),
    el(
      "ion-button",
      {
        slot: "end",
        style: "position:absolute;right:16px;top:16px",
        fill: "clear",
      },
      el("ion-icon", { name: "camera" })
    )
  );

  const menuItem = (
    icon: string,
    title: string,
    subtitle = "",
    onClick?: () => void,
    rightEl?: HTMLElement
  ) =>
    el(
      "ion-item",
      { button: !!onClick, onclick: onClick },
      el("ion-icon", { name: icon, slot: "start" }),
      el(
        "ion-label",
        el("h2", title),
        subtitle ? el("p", subtitle) : undefined
      ),
      rightEl
        ? rightEl
        : el("ion-icon", { name: "chevron-forward", slot: "end" })
    );

  // 현재 Gaia Name 동적 subtitle
  const cachedProfile = chatProfileService.getCached(myAddress);
  const initialDisplay = formatDisplayName(cachedProfile?.nickname, myAddress);
  let gaiaSubtitle = el("p", initialDisplay);

  const modalContent = el(
    "ion-content.ion-padding",
    profileCard,
    el(
      "ion-list",
      // Gaia Name
      menuItem("sparkles", "Gaia Name", initialDisplay, async () => {
        // 1) 최신 프로필 강제 로드
        await chatProfileService.preload([myAddress]);
        const latest = await chatProfileService.resolve(myAddress);
        const rawNick = latest?.nickname?.trim() || '';

        // 2) 닉네임이 있을 때만 핸들로 전달 ('.gaia' 제거). 없으면 '' → 모달에서 Not set.
        const handle = rawNick ? rawNick.replace(/\.gaia$/, '') : '';

        // 3) 트리거 클릭
        const btn = ensureHiddenNameTrigger();
        btn.dataset.initialName = handle;
        btn.click();
      }),
      // Persona
      menuItem("person-circle", "Persona", "Edit your persona details", () => {
        const infoModal = createInfoModal("Persona", "🚧 Persona setting is under construction. 🚀");
        document.body.appendChild(infoModal);
        (infoModal as any).present();
      }),
      // Logout
      menuItem("log-out", "Sign Out", "", async () => {
        await logout();
        router.navigate("/login");
      })
    )
  );

  const modalHeader = el(
    "ion-header",
    el(
      "ion-toolbar",
      el(
        "ion-buttons",
        { slot: "start" },
        el(
          "ion-button",
          { onclick: () => modal.dismiss() },
          el("ion-icon", { slot: "icon-only", name: "chevron-back" })
        )
      ),
      el("ion-title", { style: "text-align: center;" }, "Profile Settings"),
      el(
        "ion-buttons",
        { slot: "end" },
        el(
          "ion-button",
          { style: "visibility: hidden" },
          el("ion-icon", { slot: "icon-only", name: "ellipsis-vertical" })
        )
      )
    )
  );

  modal.append(modalHeader, modalContent);

  // 초기 이름/아바타
  nameSpan.textContent = initialDisplay;
  updateAvatar(cachedProfile?.profileImage);

  // 프리로드
  chatProfileService.preload([myAddress]);

  // 채팅 프로필 변경 → 표시명/아바타 갱신
  chatProfileService.addEventListener("chatprofilechange", (e) => {
    const { account, profile } = (e as CustomEvent<any>).detail;
    if (getAddress(account) === myAddress) {
      const display = formatDisplayName(profile?.nickname, myAddress);
      nameSpan.textContent = display;
      gaiaSubtitle.textContent = display;
      updateAvatar(profile?.profileImage);
    }
  });

  // Gaia Name 변경 → 표시명 갱신(.gaia, @없음)캐시 동기화
  window.addEventListener("gaiaName:updated", (e: any) => {
    const newName = e?.detail?.name as string | undefined;
    if (!newName) return;
    const display = `${newName}.gaia`;
    nameSpan.textContent = display;
    gaiaSubtitle.textContent = display;

    // 내 캐시 즉시 업데이트 (닉네임만)
    const prev = chatProfileService.getCached(myAddress);
    chatProfileService.setProfile(myAddress, display, prev?.profileImage ?? undefined);

    // 서버값으로 보정
    chatProfileService.preload([myAddress]);
  });

  ensureHiddenNameTrigger();
  return modal;
}

export { createProfileModal };
