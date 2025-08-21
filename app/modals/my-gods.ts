import { createAddressAvatar, shortenAddress, tokenManager } from '@gaiaprotocol/client-common';
import { el } from '@webtaku/el';
import { fetchHeldNfts, HeldNft } from '../api/nfts';
import { showErrorAlert } from '../components/alert';
import { getMyAddress } from './shared';

// (페이지용과 동일 포맷 유지)
function toImageUrl(img?: string | null) {
  if (!img) return '';
  try { return new URL(img).href; }
  catch { return `https://god-images.gaia.cc/${img}`; }
}

function createHeader(address: `0x${string}` | null, count: number) {
  const header = el('div', {
    style: `
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:12px; gap:12px; padding:12px 12px 0;
    `
  });

  const left = el('div', { style: 'display:flex; align-items:center; gap:10px;' });
  const title = el('h1', 'My Gods', { style: { fontSize: '18px', fontWeight: '700', margin: '0' } });
  left.append(title);

  if (address) {
    const addrWrap = el('div', { style: 'display:flex; align-items:center; gap:8px; opacity:.9;' });
    const avatar = createAddressAvatar(address);
    Object.assign(avatar.style, { width: '20px', height: '20px', borderRadius: '9999px' });
    addrWrap.append(avatar, el('span', shortenAddress(address)));
    left.append(addrWrap);
  }

  const right = el('div', { style: 'display:flex; align-items:center; gap:8px;' });
  const countBadge = el('sl-badge', String(count), { pill: true, variant: 'neutral' });
  const refreshBtn = el('sl-button', 'Refresh', { size: 'small' });
  right.append(countBadge, refreshBtn);

  header.append(left, right);
  return { header, refreshBtn, countBadge };
}

function createGrid() {
  const grid = el('div', {
    style: `
      display:grid; padding:0 12px 12px;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap:12px;
    `
  }) as HTMLDivElement;

  const mq = window.matchMedia('(min-width:640px)');
  const mq2 = window.matchMedia('(min-width:1024px)');
  const applyCols = () => {
    if (mq2.matches) grid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
    else if (mq.matches) grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    else grid.style.gridTemplateColumns = 'repeat(1, minmax(0, 1fr))';
  };
  applyCols();
  mq.addEventListener?.('change', applyCols);
  mq2.addEventListener?.('change', applyCols);

  return grid;
}

function renderEmpty(grid: HTMLElement, message = "You don't own any Gods yet.") {
  grid.append(
    el('div', message, {
      style: `
        grid-column:1/-1; text-align:center; color:var(--sl-color-neutral-500);
        padding:24px; border:1px dashed rgba(255,255,255,0.12); border-radius:12px;
      `
    })
  );
}

function renderCard(n: HeldNft, onOpen: (n: HeldNft) => void) {
  const card = el('div', {
    style: `
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:14px; overflow:hidden; cursor:pointer;
      transition: transform .06s ease, box-shadow .2s ease, border-color .2s ease;
    `,
    onmouseenter: (e: any) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'),
    onmouseleave: (e: any) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'),
    onclick: () => onOpen(n)
  });

  const img = el('img', '', {
    src: toImageUrl(n.image),
    alt: `${n.type ?? 'NFT'} #${n.id}`,
    style: 'width:100%; height:180px; object-fit:cover; background:#111; display:block;'
  });

  const body = el('div', {
    style: 'padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px;'
  });

  const name = el(
    'div',
    el('div', `${n.type ?? 'NFT'} #${n.id}`, { style: 'font-weight:600;' }),
    el('div', n.collection, { style: 'font-size:12px; color:#9CA3AF;' })
  );

  const more = el('sl-badge', 'View', { pill: true, variant: 'primary' });

  body.append(name, more);
  card.append(img, body);
  return card;
}

function ensureAuthUI(container: HTMLElement) {
  container.innerHTML = '';
  const box = el('div', {
    style: `
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:12px; padding:48px 16px; text-align:center; border:1px dashed rgba(255,255,255,0.12);
      border-radius:16px; background:rgba(255,255,255,0.02);
    `
  });
  const title = el('h2', 'Sign-in required', { style: 'font-size:18px; font-weight:600; margin:0;' });
  const desc = el('p', 'Connect your wallet and complete the signature to view your Gods.', { style: 'color:#9CA3AF; margin:0;' });
  const hint = el('p', 'Use the Connect button at the top-right, then complete the signature.', { style: 'color:#9CA3AF; margin:0;' });
  box.append(title, desc, hint);
  container.append(box);
}

function createMyGodsModal(): HTMLElement {
  const modal = el('ion-modal', { trigger: 'open-my-gods' });

  // 헤더(닫기 버튼 포함)
  const modalHeader = el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', { onclick: () => (modal as any).dismiss?.() },
          el('ion-icon', { slot: 'icon-only', name: 'chevron-back' })
        ),
      ),
      el('ion-title', { style: 'text-align: center;' }, 'My Gods'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: 'visibility: hidden' },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        ),
      )
    )
  );

  // 컨텐츠 루트
  const content = el('ion-content');
  const root = el('div', { style: 'display:flex; flex-direction:column; gap:8px; padding-bottom:12px;' });
  content.append(root);

  modal.append(modalHeader, content);

  // ---- 데이터 로드 & 렌더 ----
  let detachFns: Array<() => void> = [];

  const loadAndRender = async () => {
    const address = getMyAddress();
    root.innerHTML = '';

    // 인증 체크
    if (!tokenManager.has() || !address) {
      ensureAuthUI(root);
      return;
    }

    // 헤더 + 그리드 구성
    const { header, refreshBtn, countBadge } = createHeader(address, 0);
    const grid = createGrid();
    const section = el('section', header, grid, { style: 'display:flex; flex-direction:column; gap:8px;' });
    root.append(section);

    // 로딩 표시
    grid.innerHTML = '';
    grid.append(
      el('div', 'Loading Gods…', {
        style: `grid-column:1/-1; text-align:center; color:#9CA3AF; padding:16px;`
      })
    );

    try {
      const items = await fetchHeldNfts(address, {});
      countBadge.textContent = String(items.length);

      grid.innerHTML = '';
      if (!items.length) {
        renderEmpty(grid);
      } else {
        const onOpen = (n: HeldNft) => {
          window.dispatchEvent(new CustomEvent('open:god-detail', { detail: { id: n.id } }));
        };
        for (const n of items) grid.append(renderCard(n, onOpen));
      }

      // 새로고침
      const onRefresh = () => loadAndRender();
      refreshBtn.addEventListener('click', onRefresh);
      detachFns.push(() => refreshBtn.removeEventListener('click', onRefresh));
    } catch (err) {
      console.error(err);
      grid.innerHTML = '';
      grid.append(
        el('div', 'Failed to load your Gods. Please try again.', {
          style: `
            grid-column:1/-1; text-align:center; color:var(--sl-color-danger-600);
            padding:24px; border:1px dashed rgba(255,0,0,0.25); border-radius:12px;
          `
        })
      );
      showErrorAlert('Error', err instanceof Error ? err.message : String(err));
    }
  };

  const onPresented = () => {
    // 모달이 열릴 때 로드
    loadAndRender();

    // 로그인 상태 변화 시 갱신
    const reloadOnIn = () => loadAndRender();
    const reloadOnOut = () => loadAndRender();
    tokenManager.on('signedIn', reloadOnIn);
    tokenManager.on('signedOut', reloadOnOut);

    detachFns.push(() => tokenManager.off?.('signedIn', reloadOnIn));
    detachFns.push(() => tokenManager.off?.('signedOut', reloadOnOut));
  };

  const onDismissed = () => {
    // 이벤트 해제
    detachFns.forEach(fn => fn());
    detachFns = [];
    // 컨텐츠 리셋(선택)
    // root.innerHTML = '';
  };

  // Ionic 이벤트
  modal.addEventListener('ionModalDidPresent', onPresented as any);
  modal.addEventListener('ionModalDidDismiss', onDismissed as any);

  return modal;
}

export { createMyGodsModal };
