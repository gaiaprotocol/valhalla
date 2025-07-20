import { el } from "@webtaku/el";
import Navigo from "navigo";
import { logout } from "../auth/logout";

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
  const profileData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    location: 'San Francisco, CA',
  };

  const modal = el('ion-modal', { trigger: 'open-profile' }); // 트리거는 레이아웃의 버튼 id

  const profileCard = el('ion-card',
    el('ion-card-header',
      el('ion-avatar', { style: 'width:64px;height:64px;margin:auto' },
        el('img', { src: '/placeholder.svg?height=64&width=64', alt: 'Profile' })
      ),
      el('ion-card-title', `${profileData.firstName} ${profileData.lastName}`),
      el('ion-card-subtitle', profileData.email),
      el('ion-card-subtitle', profileData.location)
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

  return modal;
}

export { createProfileModal };
