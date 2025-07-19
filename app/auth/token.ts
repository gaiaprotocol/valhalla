class TokenManager {
  static readonly KEY = 'token';

  static set(token: string) {
    localStorage.setItem(this.KEY, token);
  }

  static get(): string | undefined {
    const token = localStorage.getItem(this.KEY);
    if (!token) return undefined;
    return token;
  }

  static clear() {
    localStorage.removeItem(this.KEY);
  }

  static has(): boolean {
    return !!this.get();
  }
}

export { TokenManager };
