import { getAddress } from 'viem';
import { fetchGaiaNames } from '../api/gaia-name';
import { TokenManager } from '../auth/token';

/** 캐시에 저장되는 구조 */
type NameEntry = {
  name: string;
  fetchedAt: number; // epoch ms
};

const TTL = 10 * 60 * 1000;      // 10분

/**
 * 전역에서 공유 가능한 싱글턴 NameService.
 * - 주소를 등록하면 자동으로 이름을 비동기로 가져옵니다.
 * - TTL이 지난 항목은 재요청합니다.
 * - `resolve()` 는 프라미스를 돌려주므로, 항상 최신값을 기다릴 수 있습니다.
 * - 값 변경 시 `namechange`, 내 이름 변경 시 `mynamechange` 이벤트 발생.
 */
class NameService extends EventTarget {
  #cache = new Map<string, NameEntry>();
  #inflight = new Set<string>();

  /* ---------- public API ---------- */

  /** 주소를 등록(=프리로드). 반환값 없음 */
  preload(accounts: string[]) {
    const toFetch = accounts
      .map(a => getAddress(a))
      .filter(a => this.#needsRefresh(a));
    if (toFetch.length) this.#fetchBatch(toFetch);
  }

  /**
   * 최신 이름을 비동기로 반환. 값이 없거나 만료되면 자동으로 fetch.
   */
  async resolve(account: string): Promise<string | undefined> {
    const addr = getAddress(account);
    if (this.#needsRefresh(addr)) await this.#fetchBatch([addr]);
    return this.#cache.get(addr)?.name;
  }

  /** 캐시된(혹은 오래된) 값 그대로 반환. 없으면 undefined */
  getCached(account: string) {
    return this.#cache.get(getAddress(account))?.name;
  }

  /**
   * 강제로 이름을 주입합니다.
   * 기존 이름과 다르면 이벤트를 발생시킵니다.
   */
  setName(account: string, name: string) {
    const addr = getAddress(account);
    const prev = this.#cache.get(addr)?.name;

    this.#cache.set(addr, {
      name,
      fetchedAt: Date.now()
    });

    if (name !== prev) {
      this.dispatchEvent(
        new CustomEvent('namechange', { detail: { account: addr, name } })
      );
      if (addr === TokenManager.getAddress()) {
        this.dispatchEvent(new Event('mynamechange'));
      }
    }
  }

  /* ---------- internals ---------- */

  /** 캐시가 없거나 TTL 초과 여부 */
  #needsRefresh(addr: string) {
    const entry = this.#cache.get(getAddress(addr));
    return !entry || Date.now() - entry.fetchedAt > TTL;
  }

  /** 중복방지 + 이벤트 발행 포함 다중 fetch */
  async #fetchBatch(addresses: string[], force = false) {
    const targets = addresses.filter(a => {
      if (this.#inflight.has(a)) return false;
      if (!force && !this.#needsRefresh(a)) return false;
      return true;
    });
    if (!targets.length) return;

    targets.forEach(a => this.#inflight.add(a));
    try {
      const result = await fetchGaiaNames(targets);
      targets.forEach(_addr => {
        const addr = getAddress(_addr);
        const prev = this.#cache.get(addr)?.name;
        const newName = result[addr];

        this.#cache.set(addr, { name: newName, fetchedAt: Date.now() });

        if (newName !== prev) {
          this.dispatchEvent(
            new CustomEvent('namechange', { detail: { account: addr, name: newName } })
          );
          if (addr === TokenManager.getAddress()) this.dispatchEvent(new Event('mynamechange'));
        }
      });
    } finally {
      targets.forEach(a => this.#inflight.delete(a));
    }
  }
}

const nameService = new NameService();

export { nameService };
