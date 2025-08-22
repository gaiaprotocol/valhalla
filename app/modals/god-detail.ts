import { createAddressAvatar, shortenAddress, tokenManager } from '@gaiaprotocol/client-common';
import { ElementType, GenderType } from '@gaiaprotocol/god-mode-shared';
import { createNftAttributeEditor } from '@gaiaprotocol/nft-attribute-editor';
import { el } from '@webtaku/el';
import { saveNftAttributes } from '../api/god-metadata';
import { fetchNftDetail, NftDetail } from '../api/nfts';
import { showErrorAlert } from '../components/alert';
import { createGodViewer } from '../components/god-viewer';
import fireManParts from '../data/fire-man-parts.json' with { type: 'json' };
import fireWomanParts from '../data/fire-woman-parts.json' with { type: 'json' };
import keyToFrame from '../data/key-to-frame.json' with { type: 'json' };
import spritesheet from '../data/spritesheet.json' with { type: 'json' };
import stoneManParts from '../data/stone-man-parts.json' with { type: 'json' };
import stoneWomanParts from '../data/stone-woman-parts.json' with { type: 'json' };
import waterManParts from '../data/water-man-parts.json' with { type: 'json' };
import waterWomanParts from '../data/water-woman-parts.json' with { type: 'json' };
import { getMyAddress } from './shared';

// ---- Toast util (Shoelace) --------------------------------------------------
let toastStack = document.getElementById('toast-stack') as HTMLDivElement | null;
function notify(variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger', message: string) {
  if (!toastStack) {
    toastStack = el('div', {
      id: 'toast-stack',
      style: 'position:fixed; right:16px; bottom:16px; z-index:9999; display:flex; flex-direction:column; gap:8px;'
    }) as HTMLDivElement;
    document.body.append(toastStack);
  }
  const a = document.createElement('sl-alert') as any;
  a.variant = variant; a.closable = true; a.duration = 2500; a.toast = true;
  a.innerHTML = `<sl-icon slot="icon" name="${variant === 'success' ? 'check2-circle' : variant === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></sl-icon>${message}`;
  toastStack!.append(a);
  (a.show?.() ?? (a.open = true));
}

// ---- Auth-required view -----------------------------------------------------
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
  const desc = el('p', 'Connect your wallet and complete the signature to view this God.', { style: 'color:#9CA3AF; margin:0;' });
  const hint = el('p', 'Use the Connect button at the top-right, then complete the signature.', { style: 'color:#9CA3AF; margin:0;' });
  box.append(title, desc, hint);
  container.append(box);
}

// ---- Small UI helpers -------------------------------------------------------
function kvGrid(title: string, entries: [string, string | number][]) {
  if (!entries.length) return el('div');
  return el(
    'div',
    el('h3', title, { style: { fontSize: '14px', fontWeight: '600', margin: '0 0 6px 0' } }),
    el(
      'div',
      { style: 'display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px;' },
      ...entries.map(([k, v]) =>
        el(
          'div',
          el('div', String(k), { style: { fontSize: '11px', color: '#9CA3AF' } }),
          el('div', String(v ?? '-'), { style: { fontWeight: '600' } }),
          { style: 'border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); border-radius:12px; padding:10px;' }
        )
      )
    ),
    { style: 'display:flex; flex-direction:column; gap:8px;' }
  );
}

function imagePanel(detail: NftDetail) {
  const card = el('div', {
    style: 'border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); border-radius:16px; padding:10px;'
  });
  const viewer = createGodViewer({
    type: detail.traits!.Type as ElementType,
    gender: detail.traits!.Gender as GenderType,
    parts: detail.parts as { [category: string]: string },
  });
  viewer.style.borderRadius = '12px';
  card.append(viewer);
  return { card, viewerEl: viewer as unknown as HTMLElement };
}

function metaPanel(detail: NftDetail) {
  const wrap = el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });

  const name = el('h2', detail.name ?? `God #${detail.id}`, { style: { fontSize: '18px', fontWeight: '600', margin: '0' } });

  const ownerRow = (() => {
    const owner = detail.holder as `0x${string}` | null | undefined;
    if (!owner) return null;
    const row = el('div', { style: 'display:flex; align-items:center; gap:8px; color:#9CA3AF;' });
    const avatar = createAddressAvatar(owner);
    Object.assign(avatar.style, { width: '18px', height: '18px', borderRadius: '9999px' });
    const you = getMyAddress();
    const youBadge = you && owner && you.toLowerCase() === owner.toLowerCase()
      ? el('sl-badge', 'You', { pill: true, variant: 'success' })
      : null;
    row.append(el('span', 'Owner:'), avatar, el('span', shortenAddress(owner)));
    if (youBadge) row.append(youBadge);
    return row;
  })();

  const desc = detail.description
    ? el('p', detail.description, { style: { color: '#d1d5db', margin: '6px 0 0 0' } })
    : null;

  const traitsGrid = kvGrid('Traits', Object.entries(detail.traits ?? {}));
  const partsGrid = kvGrid('Parts', Object.entries(detail.parts ?? {}));

  const share = el('sl-button', 'Share', {
    variant: 'default',
    onclick: async () => {
      try { await navigator.clipboard.writeText(`${location.origin}/god/${detail.id}`); notify('success', 'Link copied'); }
      catch { notify('danger', 'Failed to copy link'); }
    }
  });

  wrap.append(name);
  if (ownerRow) wrap.append(ownerRow);
  if (desc) wrap.append(desc);
  if (traitsGrid) wrap.append(traitsGrid);
  if (partsGrid) wrap.append(partsGrid);
  wrap.append(el('div', share, { style: 'display:flex; gap:8px; margin-top:2px;' }));

  return wrap;
}

// ---- Main: modal with editor when owned ------------------------------------
function createGodDetailModal(): HTMLElement {
  const modal = el('ion-modal', { id: 'god-detail-modal' });

  const modalHeader = el('ion-header',
    el('ion-toolbar',
      el('ion-title', { style: 'text-align:center;' }, 'God Detail')
    )
  );

  const content = el('ion-content');
  const root = el('div', { style: 'display:flex; flex-direction:column; gap:12px; padding:12px;' });
  content.append(root);

  modal.append(modalHeader, content);

  let currentId: string | number | null = null;

  async function render(id: string | number) {
    root.innerHTML = '';

    if (!tokenManager.has() || !getMyAddress()) {
      ensureAuthUI(root);
      return;
    }

    // Skeleton grid
    const grid = el('div', { style: 'display:grid; grid-template-columns:1fr; gap:12px;' }) as HTMLDivElement;
    const mq = window.matchMedia('(min-width:900px)');
    const apply = () => { grid.style.gridTemplateColumns = mq.matches ? '3fr 2fr' : '1fr'; };
    apply(); mq.addEventListener?.('change', apply);
    grid.append(
      el('div', el('div', { class: 'aspect-square rounded-xl border border-white/10 bg-white/5 animate-pulse' })),
      el('div',
        el('div', { class: 'h-6 w-56 rounded-md bg-white/10 animate-pulse' }),
        el('div', { class: 'h-4 w-72 rounded-md bg-white/10 animate-pulse' }),
        el('div', { class: 'h-4 w-64 rounded-md bg-white/10 animate-pulse' }),
        { style: 'display:flex; flex-direction:column; gap:8px;' }
      )
    );
    root.append(grid);

    try {
      const detail = await fetchNftDetail(String(id));

      // Header
      (modalHeader as HTMLElement).replaceWith(
        el('ion-header',
          el('ion-toolbar',
            el('ion-buttons', { slot: 'start' },
              el('ion-button', { onclick: () => (modal as any).dismiss?.() },
                el('ion-icon', { slot: 'icon-only', name: 'chevron-back' })
              ),
            ),
            el('ion-title', { style: 'text-align:center;' }, `God #${detail.id}`),
            el('ion-buttons', { slot: 'end' },
              el('ion-button', { onclick: () => window.open(`https://etherscan.io/nft/0x134590acb661da2b318bcde6b39ef5cf8208e372/${detail.id}`, '_blank', 'noopener') },
                el('ion-icon', { slot: 'icon-only', name: 'open' })
              )
            )
          )
        )
      );

      // Viewer + Meta
      grid.innerHTML = '';
      const { card: leftCard, viewerEl } = imagePanel(detail);
      const rightCol = metaPanel(detail);
      grid.append(leftCard, rightCol);

      // ----- Editor (only if owner) -----
      const you = getMyAddress();
      const own = you && detail.holder && you.toLowerCase() === detail.holder.toLowerCase();

      if (own) {
        const editorWrap = el('div', {
          style: `
            border:1px solid rgba(255,255,255,0.1);
            background:rgba(255,255,255,0.04);
            border-radius:16px; padding:12px;
            display:flex; flex-direction:column; gap:12px;
            grid-column: 1 / -1; width:100%;
          `
        });

        editorWrap.append(
          el('div', 'Edit Attributes', { style: 'font-size:14px; font-weight:600; opacity:.9;' })
        );

        const editorMount = el('div', { style: 'min-height:420px; height:600px; width:100%;' });
        editorWrap.append(editorMount);

        const footerRow = el('div', { style: 'display:flex; justify-content:flex-end; gap:8px;' });
        const resetBtn = el('sl-button', 'Reset', { variant: 'default', disabled: true as unknown as boolean });
        const saveBtn = el('sl-button', 'Save', { variant: 'primary', disabled: true as unknown as boolean });
        footerRow.append(resetBtn, saveBtn);
        editorWrap.append(footerRow);

        grid.append(editorWrap);

        // Build editor
        const traitOptions = { Type: ['Stone', 'Fire', 'Water'], Gender: ['Man', 'Woman'] };
        const partOptions = {
          Stone: { Man: stoneManParts, Woman: stoneWomanParts },
          Fire: { Man: fireManParts, Woman: fireWomanParts },
          Water: { Man: waterManParts, Woman: waterWomanParts },
        } as const;

        const initialData = structuredClone(detail);
        let lastData: any = null;

        const buildEditor = async (baseData: any) => {
          const comp = await createNftAttributeEditor({
            traitOptions,
            partOptions,
            baseData,
            keyToFrame,
            spritesheet,
            spritesheetImagePath: '/spritesheet.png',
          });
          Object.assign(comp.el.style, { width: '100%', height: '100%' });
          return comp;
        };

        let editorComp = await buildEditor(initialData);
        editorMount.append(editorComp.el);

        // Live preview update
        const updatePreview = (data: any) => {
          const api = (viewerEl as any)?.__api;
          if (api?.setProps) {
            api.setProps({
              type: data?.traits?.Type as ElementType,
              gender: data?.traits?.Gender as GenderType,
              parts: data?.parts,
            });
          } else {
            // fallback: rebuild viewer
            leftCard.innerHTML = '';
            const viewer = createGodViewer({
              type: data?.traits?.Type as ElementType,
              gender: data?.traits?.Gender as GenderType,
              parts: data?.parts,
            });
            viewer.style.borderRadius = '12px';
            leftCard.append(viewer);
          }
        };

        const onChanged = (data: any) => {
          lastData = data;
          (saveBtn as any).disabled = false;
          (resetBtn as any).disabled = false;

          // preview
          try { updatePreview(data); } catch (e) { console.error(e); }

          // broadcast (optional)
          window.dispatchEvent(new CustomEvent('god:attributesChanged', { detail: { id: detail.id, data } }));
        };
        editorComp.on?.('dataChanged', onChanged);

        // Reset
        resetBtn.addEventListener('click', async () => {
          try {
            editorMount.innerHTML = '';
            editorComp?.off?.('dataChanged', onChanged);
            editorComp = await buildEditor(initialData);
            editorComp.on?.('dataChanged', onChanged);
            editorMount.append(editorComp.el);

            lastData = null;
            (saveBtn as any).disabled = true;
            (resetBtn as any).disabled = true;

            // preview reset
            updatePreview(initialData);
            notify('neutral', 'Changes have been reset.');
          } catch (e) {
            console.error(e);
            notify('danger', 'Failed to reset.');
          }
        });

        // Save
        saveBtn.addEventListener('click', async () => {
          try {
            (saveBtn as any).disabled = true;
            (saveBtn as any).loading = true;
            await saveNftAttributes(detail.id, lastData);
            lastData = null;
            (resetBtn as any).disabled = true;
            notify('success', 'Attributes saved.');
          } catch (e) {
            console.error(e);
            notify('danger', e instanceof Error ? e.message : 'Failed to save. Please try again.');
            (saveBtn as any).disabled = false;
          } finally {
            (saveBtn as any).loading = false;
          }
        });
      }

    } catch (err) {
      console.error(err);
      root.innerHTML = '';
      root.append(
        el('div', 'Failed to load this God. Please try again.', {
          style: `
            padding:24px; border:1px dashed rgba(255,0,0,0.25);
            color: var(--sl-color-danger-600); border-radius:12px; text-align:center;
          `
        })
      );
      showErrorAlert('Error', err instanceof Error ? err.message : String(err));
    }
  }

  // Open trigger
  const onOpen = (e: Event) => {
    const { id } = (e as CustomEvent<{ id: string | number }>).detail || {};
    if (id == null) return;
    currentId = id;
    (modal as any).present?.() ?? ((modal as any).open = true);
    render(id);
  };

  const onDismissed = () => {
    currentId = null;
    root.innerHTML = '';
  };

  modal.addEventListener('ionModalDidDismiss', onDismissed as any);
  window.addEventListener('open:god-detail', onOpen as any);

  // destroy hook (optional)
  (modal as any).__destroy = () => {
    window.removeEventListener('open:god-detail', onOpen as any);
    modal.removeEventListener('ionModalDidDismiss', onDismissed as any);
    modal.remove();
  };

  return modal;
}

export { createGodDetailModal };
