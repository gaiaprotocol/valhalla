import { el } from "@webtaku/el";
import Navigo from "navigo";
import { getAddress } from "viem";
import { logout } from "../auth/logout";
import { TokenManager } from "../auth/token-mananger";
import { createAddressAvatar } from "../components/address-avatar";
import { nameService } from "../services/name";
import { shortenAddress } from "../utils/address";

function createInfoModal(title: string, message: string) {
  const modal = el('ion-modal');

  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-title', title),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { onclick: () => modal.dismiss() }, 'Close')
      )
    )
  );

  const content = el('ion-content.ion-padding',
    el('div', {
      style: `
        text-align: center;
      `
    }, message)
  );

  modal.append(header, content);
  return modal;
}

function createProfileModal(router: Navigo): HTMLElement {
  const myAddress = getAddress(TokenManager.getAddress() || '');

  const avatar = createAddressAvatar(myAddress);
  avatar.style.width = '64px';
  avatar.style.height = '64px';
  avatar.style.margin = 'auto';

  const nameSpan = el("span", "Loading…");
  const addressSpan = el("span", myAddress);

  const modal = el('ion-modal', { trigger: 'open-profile' }); // 트리거는 레이아웃의 버튼 id

  const profileCard = el('ion-card',
    el('ion-card-header', {
      style: `
        text-align: center;
      `
    },
      el('ion-avatar', { style: 'width:64px;height:64px;margin:auto' },
        avatar
      ),
      el('ion-card-title', nameSpan),
      el('ion-card-subtitle', addressSpan),
    ),
    el('ion-button',
      { slot: 'end', style: 'position:absolute;right:16px;top:16px', fill: 'clear' },
      el('ion-icon', { name: 'camera' })
    )
  );

  const menuItem = (icon: string, title: string, subtitle = '', onClick?: () => void, rightEl?: HTMLElement) =>
    el('ion-item',
      { button: !!onClick, onclick: onClick },
      el('ion-icon', { name: icon, slot: 'start' }),
      el('ion-label',
        el('h2', title),
        subtitle ? el('p', subtitle) : undefined
      ),
      rightEl ? rightEl : el('ion-icon', { name: 'chevron-forward', slot: 'end' }),
    );

  const modalContent = el('ion-content.ion-padding',
    profileCard,

    /*el('ion-list',
      el('ion-list-header', 'Account'),
      menuItem('pencil', 'Personal Information', 'Name, email, phone', () => console.log('Personal Info')),
    ),

    el('ion-list',
      el('ion-list-header', 'Preferences'),
      menuItem('notifications', 'Notifications', 'Push notifications, email', () => console.log('Notifications')),
      //menuItem('globe', 'Language & Region', 'English, Pacific Time')
    ),

    el('ion-list',
      el('ion-list-header', 'Support'),
      //menuItem('help-circle', 'Help & Support', 'FAQ, contact us'),
      menuItem('log-out', 'Sign Out', '', async () => {
        await logout();
        router.navigate('/login');
      }),
    )*/

    el('ion-list',

      // Gaia Name 메뉴
      menuItem('sparkles', 'Gaia Name', 'Manage your Gaia Name', () => {
        const modal = createInfoModal(
          'Gaia Name',
          '🚧 Gaia Name setting is under construction. 🚀'
        );
        document.body.appendChild(modal);
        modal.present();
      }),

      // Persona 메뉴
      menuItem('person-circle', 'Persona', 'Edit your persona details', () => {
        const modal = createInfoModal(
          'Persona',
          '🚧 Persona setting is under construction. 🚀'
        );
        document.body.appendChild(modal);
        modal.present();
      }),

      //menuItem('notifications', 'Notifications', 'Push notifications, email', () => console.log('Notifications')),
      menuItem('log-out', 'Sign Out', '', async () => {
        await logout();
        router.navigate('/login');
      }),
    ),
  );

  const modalHeader = el('ion-header',
    el('ion-toolbar',
      el('ion-title', 'Profile Settings'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { onclick: () => modal.dismiss() }, 'Close')
      ),
    )
  );

  modal.append(modalHeader, modalContent);

  // 이름 초기화
  const cachedName = nameService.getCached(myAddress);
  nameSpan.textContent = cachedName || shortenAddress(myAddress);

  // 이름 가져오기 요청
  nameService.preload([myAddress]);

  // 이름이 바뀌면 DOM 갱신
  nameService.addEventListener("namechange", (e) => {
    const { account, name } = (e as CustomEvent<any>).detail;
    if (getAddress(account) === myAddress) {
      nameSpan.textContent = name || myAddress;
    }
  });

  return modal;
}

export { createProfileModal };
