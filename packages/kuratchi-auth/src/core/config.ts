let _authDbBinding = 'DB';

export function setAuthDbBinding(binding: string | undefined): void {
  const next = (binding ?? '').trim();
  _authDbBinding = next || 'DB';
}

export function getAuthDbBinding(): string {
  return _authDbBinding;
}
