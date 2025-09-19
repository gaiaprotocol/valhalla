import { chatProfileService } from '@gaiaprotocol/chat-client';
import { tokenManager } from '@gaiaprotocol/client-common';
import '@shoelace-style/shoelace';
import { el } from '@webtaku/el';
import { fetchGaiaName, saveGaiaName } from '../api/gaia-name';
import { checkGodMode } from '../services/god-mode';

/**
 * Rules
 * - 2–30 chars
 * - a–z, 0–9, hyphen
 * - cannot start/end with hyphen
 */
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

type StatusKind = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'current';

const qs = <T extends Element = Element>(sel: string, root: ParentNode | Document = document) =>
  root.querySelector(sel) as T | null;

const show = (node: Element | null, on = true) => { if (node) node.classList.toggle('hidden', !on); };
const setText = (node: Element | null, text: string) => { if (node) node.textContent = text; };

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

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    // @ts-ignore
    t = setTimeout(() => fn(...args), ms);
  };
}

export function createNameSettingsModal(): HTMLElement {
  // ---------- Trigger & Modal ----------
  const triggerBtn = el('ion-button', { id: 'open-name-settings', style: 'display:none' });
  const modal = el('ion-modal', { trigger: 'open-name-settings', id: 'name-settings-modal' });

  // ---------- Header ----------
  const header = el(
    'ion-header',
    el(
      'ion-toolbar',
      el(
        'ion-buttons',
        { slot: 'start' },
        el(
          'ion-button',
          { onclick: () => (modal as any).dismiss?.(), 'aria-label': 'Close' },
          el('ion-icon', { slot: 'icon-only', name: 'chevron-back' })
        )
      ),
      el('ion-title', { style: 'text-align:center;' }, 'Gaia Name'),
      el(
        'ion-buttons',
        { slot: 'end' },
        el('ion-button', { style: 'visibility:hidden' }, el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' }))
      )
    )
  );

  // ---------- Content ----------
  const content = el('ion-content');
  const root = el('div', { style: 'padding:16px; display:flex; flex-direction:column; gap:12px;' });

  // Current name row
  const currentRow = el(
    'div',
    { style: 'display:flex; align-items:center; gap:8px;' },
    el('span', 'Current:', { style: 'font-weight:600;' }),
    el('sl-badge', 'Not set', { variant: 'neutral', pill: true, id: 'current-gaia-name' })
  );

  // Hint
  const hint = el(
    'div',
    'Pick your Gaia Name. 2–30 chars, a–z, 0–9, hyphen (no leading/trailing hyphen).',
    { style: 'color:#9CA3AF; font-size:13px;' }
  );

  // Field
  const field = el('div', { style: 'display:flex; gap:8px; align-items:center; width:100%;' }) as HTMLDivElement;
  const input = el('sl-input', {
    placeholder: 'your-name',
    clearable: true,
    pill: true,
    size: 'large',
    'aria-label': 'Gaia name',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    inputmode: 'latin',
    style: 'flex:1 1 0%; min-width:0; width:0;'
  } as any) as any

  // suffix ".gaia"
  input.append(el('span', '.gaia', { slot: 'suffix', style: 'opacity:.85;' }));
  field.append(input);

  // Status row
  const statusRow = el('div', { style: 'display:flex; align-items:center; gap:8px; min-height:22px;' });
  const statusBadge = el('sl-badge', 'Type a name', { variant: 'neutral', pill: true }) as HTMLElement & { variant?: string };
  const statusMsg = el('span', '', { style: 'font-size:12px; color:#9CA3AF;' });
  statusRow.append(statusBadge, statusMsg);

  // Error alert
  const errorAlert = el(
    'sl-alert',
    { variant: 'danger', closable: true, class: 'hidden' },
    el('sl-icon', { slot: 'icon', name: 'exclamation-octagon' }),
    el('span', { id: 'name-error-msg' }, '')
  ) as HTMLElement;

  // Buttons
  const btnRow = el('div', { style: 'display:flex; gap:8px; justify-content:flex-end;' });
  const cancelBtn = el('sl-button', 'Cancel', { variant: 'default' }) as HTMLElement & { disabled?: boolean };
  const saveBtn = el('sl-button', 'Save', { variant: 'primary', disabled: true as unknown as boolean }) as
    HTMLElement & { disabled?: boolean; loading?: boolean };
  btnRow.append(cancelBtn, saveBtn);

  root.append(currentRow, hint, field, statusRow, errorAlert, btnRow);
  content.append(root);
  modal.append(header, content);

  // ---------- State ----------
  let available = false;             // result of availability check
  let valid = false;                 // result of validation
  let latestQueried = '';            // last name we asked server about
  let initialNameAtOpen = '';        // initial name at modal open (without .gaia)
  let lastValidatedName = '';        // last normalized valid value (for save)

  const setError = (msg?: string) => {
    show(errorAlert, !!msg);
    setText(qs('#name-error-msg', errorAlert), msg ?? '');
  };

  const setStatus = (kind: StatusKind, text?: string) => {
    const map = {
      idle: { label: 'Type a name', variant: 'neutral' },
      checking: { label: 'Checking…', variant: 'primary' },
      available: { label: 'Available', variant: 'success' },
      taken: { label: 'Unavailable', variant: 'warning' },
      invalid: { label: 'Invalid', variant: 'danger' },
      current: { label: 'Current', variant: 'neutral' }
    } as const;
    statusBadge.textContent = map[kind].label;
    (statusBadge as any).variant = map[kind].variant;
    statusMsg.textContent = text ?? '';
  };

  const updateSaveDisabled = () => {
    // 저장 가능 조건: valid && available (현재 이름과 동일할 땐 저장 비활성)
    (saveBtn as any).disabled = !(valid && available);
  };

  // ---------- Availability ----------
  async function checkAvailability(name: string) {
    latestQueried = name;
    setStatus('checking'); setError(); available = false; updateSaveDisabled();

    try {
      await fetchGaiaName(name); // 존재 → 사용불가
      if (latestQueried === name) {
        available = false;
        setStatus('taken', `${name}.gaia is already taken.`);
      }
    } catch (e) {
      if (isNotFoundError(e)) {
        if (latestQueried === name) {
          available = true;
          setStatus('available', `${name}.gaia is available.`);
        }
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('idle');
      }
    }
    updateSaveDisabled();
  }

  // ---------- Input handler ----------
  const onInput = debounce(async () => {
    const raw = (input as any).value || '';
    const v = validateName(raw);

    valid = false; available = false; lastValidatedName = ''; updateSaveDisabled();

    if (!raw) {
      setError(); setStatus('idle');
      return;
    }
    if (!v.ok) {
      setError(v.reason);
      setStatus('invalid');
      return;
    }

    // 정상화된 이름
    lastValidatedName = v.name!;

    // 초기 이름과 동일하면 조회하지 않고 "Current"
    if (initialNameAtOpen && v.name === initialNameAtOpen.toLowerCase()) {
      setError();
      valid = true;
      available = false; // 본인 소유라 새로 저장 불필요
      setStatus('current', 'This is your current Gaia Name.');
      updateSaveDisabled();
      return;
    }

    // 그 외엔 조회
    setError();
    valid = true;
    await checkAvailability(v.name!);
  }, 250);

  (input as HTMLElement).addEventListener('sl-input', onInput as any);

  // ---------- Buttons ----------
  cancelBtn.addEventListener('click', () => (modal as any).dismiss?.());

  saveBtn.addEventListener('click', async () => {
    try {
      (saveBtn as any).loading = true; (saveBtn as any).disabled = true;

      if (!tokenManager.has()) throw new Error('Please sign in first.');
      const token = tokenManager.getToken();
      if (!token) throw new Error('Missing authorization token.');

      const raw = (input as any).value || '';
      const v = validateName(raw);
      if (!v.ok) throw new Error(v.reason);
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
      updateSaveDisabled();
    }
  });

  // ---------- Modal lifecycle ----------
  modal.addEventListener('ionModalWillPresent', () => {
    const t = (modal as any).triggeringElement as HTMLElement | undefined;
    let initialName = (t?.dataset?.initialName ?? '').trim(); // e.g. 'satoshi' or ''

    // 캐시 폴백 (닉네임 있으면 .gaia 제거)
    if (!initialName) {
      try {
        const addr = tokenManager.getAddress?.();
        if (addr) {
          const cached =
            (window as any).chatProfileService?.getCached?.(addr) ||
            chatProfileService.getCached(addr);
          const nick = cached?.nickname?.trim();
          if (nick) initialName = nick.replace(/\.gaia$/, '');
        }
      } catch { /* ignore */ }
    }

    initialNameAtOpen = initialName;
    (input as any).value = initialName;

    // 상단 Current 갱신
    const currentBadge = qs<HTMLElement>('#current-gaia-name', root);
    if (currentBadge) {
      currentBadge.textContent = initialName ? `${initialName}.gaia` : 'Not set';
      (currentBadge as any).variant = initialName ? 'primary' : 'neutral';
    }

    // 최초 검증 트리거
    (input as any).dispatchEvent(new CustomEvent('sl-input', { bubbles: true }));
  });

  // ---------- Host ----------
  const host = el('div', null);
  host.append(triggerBtn, modal);
  return host;
}
