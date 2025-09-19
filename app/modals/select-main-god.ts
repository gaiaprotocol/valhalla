import { el } from '@webtaku/el';

type GodItem = {
  id: string;
  name?: string;
  image?: string; // 이미지 URL
};

type SelectMainGodOptions = {
  title?: string;
  description?: string;
  loadGods: () => Promise<GodItem[]>;
  onSelected: (godId: string) => Promise<void> | void;
};

export function createSelectMainGodModal(options: SelectMainGodOptions) {
  const {
    title = 'Select your Main God',
    description = 'Choose a God to use as your profile image.',
    loadGods,
    onSelected,
  } = options;

  const modal = el('ion-modal');

  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-title', title),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { onclick: () => modal.dismiss() }, 'Close'),
      ),
    ),
  );

  const content = el('ion-content.ion-padding', {
    style: `
      --padding-bottom: 88px; /* 푸터 높이만큼 여유를 둬서 겹침 방지 */
    `
  });

  const desc = el('p', { style: 'margin-bottom:12px;color:var(--ion-color-medium)' }, description);

  const grid = el('div', {
    className: 'grid grid-cols-2 gap-3',
    style: `
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap:12px;
      margin-bottom: 16px;
    `,
  });

  const footer = el('div', {
    slot: 'fixed', // ✨ 핵심: 고정 푸터
    style: `
      display:flex;
      gap:8px;
      justify-content:flex-end;
      padding: 12px;
      border-top: 1px solid var(--ion-color-step-150, rgba(0,0,0,.08));
      background: var(--ion-background-color, #fff);
      box-shadow: 0 -4px 12px rgba(0,0,0,.08);
      padding-bottom: calc(12px + env(safe-area-inset-bottom));
    `
  });
  const cancelBtn = el('ion-button', { fill: 'outline', onclick: () => modal.dismiss() }, 'Cancel');
  const confirmBtn = el('ion-button', { disabled: true }, 'Confirm');
  footer.append(cancelBtn, confirmBtn);

  content.append(desc, grid);
  modal.append(header, content, footer);

  // 내부 상태
  let selectedId: string | null = null;

  function renderGodItem(item: GodItem) {
    const card = el('ion-card', {
      style: `
        cursor:pointer;
        transition: box-shadow .2s, transform .05s, border-color .2s;
        border:2px solid transparent;
      `,
      onclick: () => {
        // 선택 표시 업데이트
        selectedId = item.id;
        confirmBtn.disabled = false;
        Array.from(grid.children).forEach((c: any) => {
          c.style.border = '2px solid transparent';
          c.style.boxShadow = '';
        });
        (card as any).style.border = '2px solid var(--ion-color-primary)';
        (card as any).style.boxShadow = '0 0 0 2px rgba(0,0,0,0.04) inset';
      },
    },
      el('ion-img', {
        src: item.image || '',
        style: 'width:100%;height:140px;object-fit:cover;background:#111;border-bottom:1px solid rgba(255,255,255,.06)',
        alt: item.name || item.id,
      }),
      el('ion-card-content',
        el('div', {
          style: 'display:flex;align-items:center;justify-content:space-between;gap:8px'
        },
          el('strong', item.name || 'Unnamed God'),
          el('ion-badge', item.id.length > 10 ? `${item.id.slice(0, 6)}…${item.id.slice(-4)}` : item.id),
        ),
      ),
    );

    return card;
  }

  // 데이터 로드
  (async () => {
    try {
      const gods = await loadGods();
      if (!gods || gods.length === 0) {
        grid.append(
          el('div', {
            style: 'grid-column:1/-1;text-align:center;color:var(--ion-color-medium)'
          }, 'No Gods found.')
        );
        return;
      }
      for (const g of gods) grid.append(renderGodItem(g));
    } catch (e) {
      console.error('Failed to load gods', e);
      grid.append(
        el('div', {
          style: 'grid-column:1/-1;text-align:center;color:var(--ion-color-danger)'
        }, 'Failed to load Gods.')
      );
    }
  })();

  // Confirm 동작
  confirmBtn.onclick = async () => {
    if (!selectedId) return;
    (confirmBtn as any).disabled = true;
    try {
      await onSelected(selectedId);
      await (modal as any).dismiss?.();
    } catch (e) {
      console.error('Failed to set main god', e);
      (confirmBtn as any).disabled = false;
      // 간단한 에러 표기
      content.append(
        el('p', { style: 'color:var(--ion-color-danger)' }, 'Failed to set Main God. Please try again.')
      );
    }
  };

  return modal;
}
