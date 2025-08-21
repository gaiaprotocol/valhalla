import { chatProfileService } from '@gaiaprotocol/chat-client';
import { tokenManager } from '@gaiaprotocol/client-common';
import '@shoelace-style/shoelace';
import { el } from '@webtaku/el';
import { fetchGaiaName, saveGaiaName } from '../api/gaia-name';
import { checkGodMode } from '../services/god-mode';

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

const qs = <T extends Element = Element>(sel: string, root: ParentNode | Document = document) =>
  root.querySelector(sel) as T | null;
const show = (el: Element | null, on = true) => { if (el) el.classList.toggle('hidden', !on); };
const setText = (el: Element | null, text: string) => { if (el) el.textContent = text; };

function isNotFoundError(e: unknown) {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return m.includes('failed to fetch gaia name') && m.includes(': 404');
}
function validateName(raw: string) {
  const name = raw.trim().toLowerCase();
  if (name.length < 2) return { ok: false, reason: 'Too short (min 2).' };
  if (name.length > 30) return { ok: false, reason: 'Too long (max 30).' };
  if (!NAME_RE.test(name)) return { ok: false, reason: 'Only a–z, 0–9, hyphen; cannot start/end with hyphen.' };
  return { ok: true, name };
}
function getAuthToken(): string | null {
  // @ts-ignore
  if (typeof tokenManager.getToken === 'function') return tokenManager.getToken();
  // @ts-ignore
  if (typeof tokenManager.get === 'function') { const rec = tokenManager.get(); if (rec?.token) return rec.token; }
  try { const raw = localStorage.getItem('gaia_auth_token'); if (raw) { const j = JSON.parse(raw); return j?.token ?? null; } } catch { }
  return null;
}

export function createNameSettingsModal(): HTMLElement {
  // 트리거 버튼
  const triggerBtn = el('ion-button', { id: 'open-name-settings', style: 'display:none' });

  // 모달
  const modal = el('ion-modal', { trigger: 'open-name-settings', id: 'name-settings-modal' });

  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', { onclick: () => (modal as any).dismiss?.() },
          el('ion-icon', { slot: 'icon-only', name: 'chevron-back' })
        ),
      ),
      el('ion-title', { style: 'text-align:center;' }, 'Gaia Name'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: 'visibility:hidden' },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        ),
      )
    )
  );

  const content = el('ion-content');
  const root = el('div', { style: 'padding:16px; display:flex; flex-direction:column; gap:12px;' });

  // 현재 이름 표시
  const currentRow = el('div', { style: 'display:flex; align-items:center; gap:8px;' },
    el('span', 'Current:', { style: 'font-weight:600;' }),
    el('sl-badge', 'Not set', { variant: 'neutral', pill: true, id: 'current-gaia-name' })
  );

  const hint = el('div',
    'Pick your Gaia Name. 2–30 chars, a–z, 0–9, hyphen (no leading/trailing hyphen).',
    { style: 'color:#9CA3AF; font-size:13px;' }
  );

  const field = el('div', { style: 'display:flex; gap:8px; align-items:center;' },
    el('span', '', { style: 'opacity:.85;' }) // (좌측 프리픽스 없음, @ 제거)
  ) as HTMLDivElement;

  const input = el('sl-input', {
    placeholder: 'your-name',
    clearable: true,
    pill: true,
    size: 'large',
    style: 'flex:1;'
  }) as any;

  const suffix = el('span', '.gaia', { style: 'opacity:.85;' });
  field.append(input, suffix);

  const statusRow = el('div', { style: 'display:flex; align-items:center; gap:8px; min-height:22px;' });
  const statusBadge = el('sl-badge', 'Type a name', { variant: 'neutral', pill: true }) as HTMLElement;
  const statusMsg = el('span', '', { style: 'font-size:12px; color:#9CA3AF;' });
  statusRow.append(statusBadge, statusMsg);

  const errorAlert = el('sl-alert',
    { variant: 'danger', closable: true, class: 'hidden' },
    el('sl-icon', { slot: 'icon', name: 'exclamation-octagon' }),
    el('span', { id: 'name-error-msg' }, '')
  ) as HTMLElement;

  const btnRow = el('div', { style: 'display:flex; gap:8px; justify-content:flex-end;' });
  const cancelBtn = el('sl-button', 'Cancel', { variant: 'default' }) as HTMLElement;
  const saveBtn = el('sl-button', 'Save', { variant: 'primary', disabled: true as unknown as boolean }) as HTMLElement;
  btnRow.append(cancelBtn, saveBtn);

  root.append(currentRow, hint, field, statusRow, errorAlert, btnRow);
  content.append(root);
  modal.append(header, content);

  // 상태
  let available = false;
  let valid = false;
  let latestQueried = '';
  const setError = (msg?: string) => { show(errorAlert, !!msg); setText(qs('#name-error-msg', errorAlert), msg ?? ''); };
  const setStatus = (kind: 'idle' | 'checking' | 'available' | 'taken' | 'invalid', text?: string) => {
    const map = {
      idle: { label: 'Type a name', variant: 'neutral' },
      checking: { label: 'Checking…', variant: 'primary' },
      available: { label: 'Available', variant: 'success' },
      taken: { label: 'Unavailable', variant: 'warning' },
      invalid: { label: 'Invalid', variant: 'danger' },
    } as const;
    statusBadge.textContent = map[kind].label;
    (statusBadge as any).variant = map[kind].variant;
    statusMsg.textContent = text ?? '';
  };
  const debounce = (fn: Function, ms: number) => { let t: any; return (...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  async function checkAvailability(name: string) {
    latestQueried = name;
    setStatus('checking'); setError(); available = false;
    try {
      await fetchGaiaName(name); // 존재 → 사용불가
      if (latestQueried === name) { available = false; setStatus('taken', `${name}.gaia is already taken.`); }
    } catch (e) {
      if (isNotFoundError(e)) {
        if (latestQueried === name) { available = true; setStatus('available', `${name}.gaia is available.`); }
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('idle');
      }
    }
    (saveBtn as any).disabled = !(valid && available);
  }

  const onInput = debounce(async () => {
    const raw = (input as any).value || '';
    const v = validateName(raw);
    valid = false; available = false; (saveBtn as any).disabled = true;

    if (!raw) { setError(); setStatus('idle'); return; }
    if (!v.ok) { setError(v.reason); setStatus('invalid'); return; }

    setError(); valid = true; await checkAvailability(v.name!);
  }, 250);

  (input as HTMLElement).addEventListener('sl-input', onInput as any);
  cancelBtn.addEventListener('click', () => (modal as any).dismiss?.());

  // Save
  saveBtn.addEventListener('click', async () => {
    try {
      (saveBtn as any).loading = true; (saveBtn as any).disabled = true;
      if (!tokenManager.has()) throw new Error('Please sign in first.');
      const token = getAuthToken(); if (!token) throw new Error('Missing authorization token.');

      const raw = (input as any).value || '';
      const v = validateName(raw); if (!v.ok) throw new Error(v.reason);
      if (!available) throw new Error('This name is not available.');

      const addr = tokenManager.getAddress?.() as `0x${string}` | undefined;
      const eligible = addr ? await checkGodMode(addr) : false;
      if (!eligible) throw new Error('You are not eligible for God Mode.');

      await saveGaiaName(v.name!, token);

      // 외부 UI 갱신
      window.dispatchEvent(new CustomEvent('gaiaName:updated', { detail: { name: v.name } }));
      (modal as any).dismiss?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      (saveBtn as any).loading = false;
      (saveBtn as any).disabled = !(valid && available);
    }
  });

  // 트리거로부터 초기값/현재값 수신
  modal.addEventListener('ionModalWillPresent', () => {
    const t = (modal as any).triggeringElement as HTMLElement | undefined;
    let initialName = (t?.dataset?.initialName ?? '').trim();   // ex) 'satoshi' 또는 ''

    // ★ 트리거가 비었으면 캐시 폴백 (닉네임이 있으면 '.gaia' 제거)
    if (!initialName) {
      try {
        const addr = tokenManager.getAddress?.();
        if (addr) {
          const cached = (window as any).chatProfileService?.getCached?.(addr)
            || chatProfileService.getCached(addr);
          const nick = cached?.nickname?.trim();
          if (nick) initialName = nick.replace(/\.gaia$/, '');
        }
      } catch { }
    }

    (input as any).value = initialName;
    // 상단 Current 갱신
    const currentBadge = qs<HTMLElement>('#current-gaia-name', root);
    if (currentBadge) {
      currentBadge.textContent = initialName ? `${initialName}.gaia` : 'Not set';
      (currentBadge as any).variant = initialName ? 'primary' : 'neutral';
    }
    // 최초 검증
    (input as any).dispatchEvent(new CustomEvent('sl-input', { bubbles: true }));
  });

  const host = el('div', null);
  host.append(triggerBtn, modal);
  return host;
}
