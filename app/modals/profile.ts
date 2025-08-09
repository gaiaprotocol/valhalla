import {
  createAddressAvatar,
  logout,
  shortenAddress,
  tokenManager,
} from "@gaiaprotocol/client-common";
import { el } from "@webtaku/el";
import Navigo from "navigo";
import { getAddress } from "viem";
import { chatProfileService } from "@gaiaprotocol/chat-client";

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
    el(
      "div",
      {
        style: `
        text-align: center;
      `,
      },
      message
    )
  );

  modal.append(header, content);
  return modal;
}

function createProfileModal(router: Navigo): HTMLElement {
  const myAddress = getAddress(tokenManager.getAddress() || "");

  let avatarContainer: HTMLElement;

  // 기본 아바타 생성
  const makeFallbackAvatar = () => {
    const avatar = createAddressAvatar(myAddress);
    avatar.style.width = "64px";
    avatar.style.height = "64px";
    avatar.style.margin = "auto";
    avatar.classList.add("avatar");
    return avatar;
  };

  // 아바타 갱신 헬퍼
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

  const modalContent = el(
    "ion-content.ion-padding",
    profileCard,
    el(
      "ion-list",
      // Gaia Name
      menuItem("sparkles", "Gaia Name", "Manage your Gaia Name", () => {
        const infoModal = createInfoModal(
          "Gaia Name",
          "🚧 Gaia Name setting is under construction. 🚀"
        );
        document.body.appendChild(infoModal);
        (infoModal as any).present();
      }),
      // Persona
      menuItem("person-circle", "Persona", "Edit your persona details", () => {
        const infoModal = createInfoModal(
          "Persona",
          "🚧 Persona setting is under construction. 🚀"
        );
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
      el("ion-title", "Profile Settings"),
      el(
        "ion-buttons",
        { slot: "end" },
        el("ion-button", { onclick: () => modal.dismiss() }, "Close")
      )
    )
  );

  modal.append(modalHeader, modalContent);

  // 초기 이름/아바타
  const cachedProfile = chatProfileService.getCached(myAddress);
  nameSpan.textContent = cachedProfile?.nickname || shortenAddress(myAddress);
  updateAvatar(cachedProfile?.profileImage);

  // 프로필 프리로드
  chatProfileService.preload([myAddress]);

  // 변경 이벤트 반영
  chatProfileService.addEventListener("chatprofilechange", (e) => {
    const { account, profile } = (e as CustomEvent<any>).detail;
    if (getAddress(account) === myAddress) {
      nameSpan.textContent = profile?.nickname || shortenAddress(myAddress);
      updateAvatar(profile?.profileImage);
    }
  });

  return modal;
}

export { createProfileModal };
