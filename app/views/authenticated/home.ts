import { chatProfileService, createChatComponent } from '@gaiaprotocol/chat-client';
import { tokenManager } from '@gaiaprotocol/client-common';
import { el } from '@webtaku/el';
import { fetchMainGod, setMainGod } from '../../api/main-god';
import { fetchHeldNfts, HeldNft } from '../../api/nfts';
import { createNoticeDetailModal, createNoticeModal } from '../../modals/notice';
import { openUserProfileModal } from '../../modals/profile';
import { createSelectMainGodModal } from '../../modals/select-main-god';
import { loadLocalizedNotices } from '../../services/notice';
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

// 상대 경로 이미지 보정
function toImageUrl(img?: string | null) {
  if (!img) return '';
  try {
    return new URL(img).href;
  } catch {
    return `https://god-images.gaia.cc/${img}`;
  }
}

function createHomeView(): View & { scrollToBottom: () => void } {
  const page = el('div', { className: 'page flex flex-col h-screen p-4 gap-2' }, { style: { height: '100%' } });

  loadLocalizedNotices().then(notices => {
    const latestNotice = notices[0];
    if (!latestNotice) return;

    const noticeBar = el(
      'div',
      {
        className: 'notice-bar',
        style: { cursor: 'pointer' },
        onclick: () => {
          const detailModal = createNoticeDetailModal(latestNotice);
          document.body.appendChild(detailModal);
          (detailModal as any).present?.() || (detailModal as any).showModal?.();
        }
      },
      el(
        'span',
        { className: 'title truncate', style: { maxWidth: '80%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } },
        `📢 ${latestNotice.title}`
      ),
      el(
        'button',
        {
          className: 'text-blue-600 text-xs underline',
          onclick: (e: Event) => {
            e.stopPropagation();
            document.getElementById('open-notice')?.click();
          }
        },
        'All Notices'
      )
    );
    page.prepend(noticeBar);
    chat.scrollToBottom();
  });

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

  page.append(chat.el);

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

          // (선택) 메인 God 이미지로 아바타 즉시 갱신
          if (selected?.image && myAccount && myAccount !== 'unknown') {
            const prev = chatProfileService.getCached(myAccount);
            chatProfileService.setProfile(myAccount, prev?.nickname ?? undefined, selected.image);
          }

          // 서버값 동기화
          if (myAccount && myAccount !== 'unknown') {
            chatProfileService.preload([myAccount]);
          }
        }
      });
      document.body.appendChild(modal);
      modal.present();
    }
  });

  /* ---------- 이름 변경 시: 채팅 닉네임 즉시 갱신(.gaia, @없음) ---------- */
  const onGaiaNameUpdated = (e: any) => {
    const newName = e?.detail?.name as string | undefined;
    if (!newName) return;
    if (!myAccount || myAccount === 'unknown') return;

    const prev = chatProfileService.getCached(myAccount);
    // 닉네임을 항상 "<name>.gaia" 형태로 저장
    chatProfileService.setProfile(myAccount, `${newName}.gaia`, prev?.profileImage ?? undefined);

    // (선택) 서버값으로 최종 보정
    chatProfileService.preload([myAccount]);
  };
  window.addEventListener('gaiaName:updated', onGaiaNameUpdated as EventListener);

  return {
    el: page,
    scrollToBottom: chat.scrollToBottom,
    remove() {
      window.removeEventListener('gaiaName:updated', onGaiaNameUpdated as EventListener);
      chat.remove();
      page.remove();
    },
  };
}

export { createHomeView };
