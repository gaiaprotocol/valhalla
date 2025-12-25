import { chatProfileService, createChatComponent } from '@gaiaprotocol/chat-client';
import { tokenManager } from '@gaiaprotocol/client-common';
import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { fetchMainGod, setMainGod } from '../../api/main-god';
import { fetchHeldNfts, HeldNft } from '../../api/nfts';
import { openUserProfileModal } from '../../modals/profile';
import { createSelectMainGodModal } from '../../modals/select-main-god';
import { View } from '../view';

const roomId = 'test';

function getMyAccount(): string {
  const token = tokenManager.getToken();
  if (!token) return 'unknown';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload.sub || 'unknown';
  } catch {
    return 'unknown';
  }
}

function toImageUrl(img?: string | null) {
  if (!img) return '';
  try {
    return new URL(img).href;
  } catch {
    return `https://god-images.gaia.cc/${img}`;
  }
}

function createChatView(router: Navigo): View & { scrollToBottom: () => void } {
  const wrapper = el('div', {
    className: 'chat-page',
    style: { display: 'contents' }
  });

  // 헤더
  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', {
          onclick: () => router.navigate('/main-menu')
        },
          el('ion-icon', { slot: 'icon-only', name: 'arrow-back' })
        )
      ),
      el('ion-title', { style: { textAlign: 'center' } }, 'Chat Room'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: { visibility: 'hidden' } },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        )
      )
    )
  );

  /* ---------- ChatComponent ---------- */
  const myAccount = getMyAccount();
  const chat = createChatComponent({
    roomId,
    myAccount,
    useAddressAvatar: true,
    onProfileClick: (account, profile) => {
      openUserProfileModal(account, profile);
    },
  });

  // Make chat.el fill the available space
  (chat.el as HTMLElement).style.height = '100%';
  (chat.el as HTMLElement).style.display = 'flex';
  (chat.el as HTMLElement).style.flexDirection = 'column';

  const content = el('ion-content');
  content.append(chat.el);

  wrapper.append(header, content);

  /* ---------- 내 프로필 프리로드 ---------- */
  if (myAccount && myAccount !== 'unknown') {
    chatProfileService.preload([myAccount]);
  }

  /* ---------- Main God 선택 ---------- */
  fetchMainGod().then(data => {
    if (data.god_id === undefined) {
      const modal = createSelectMainGodModal({
        loadGods: async () => {
          const account = getMyAccount();
          if (!account || account === 'unknown') return [];
          const nfts: HeldNft[] = await fetchHeldNfts(account, {});
          return nfts.map(n => ({
            id: String(n.id),
            name: `${n.type ?? 'NFT'} #${n.id}`,
            image: toImageUrl(n.image),
            raw: n,
          }));
        },
        onSelected: async (godId: string, selected?: { image?: string }) => {
          await setMainGod(godId);
          if (selected?.image && myAccount && myAccount !== 'unknown') {
            const prev = chatProfileService.getCached(myAccount);
            chatProfileService.setProfile(myAccount, prev?.nickname ?? undefined, selected.image);
          }
          if (myAccount && myAccount !== 'unknown') {
            chatProfileService.preload([myAccount]);
          }
        }
      });
      document.body.appendChild(modal);
      modal.present();
    }
  });

  /* ---------- 이름 변경 시 ---------- */
  const onGaiaNameUpdated = (e: any) => {
    const newName = e?.detail?.name as string | undefined;
    if (!newName) return;
    if (!myAccount || myAccount === 'unknown') return;
    const prev = chatProfileService.getCached(myAccount);
    chatProfileService.setProfile(myAccount, `${newName}.gaia`, prev?.profileImage ?? undefined);
    chatProfileService.preload([myAccount]);
  };
  window.addEventListener('gaiaName:updated', onGaiaNameUpdated as EventListener);

  return {
    el: wrapper,
    scrollToBottom: chat.scrollToBottom,
    remove() {
      window.removeEventListener('gaiaName:updated', onGaiaNameUpdated as EventListener);
      chat.remove();
      wrapper.remove();
    },
  };
}

export { createChatView };
