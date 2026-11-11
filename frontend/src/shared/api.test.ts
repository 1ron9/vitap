import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, setCredentials } from './api';
afterEach(() => { vi.unstubAllGlobals(); setCredentials({}); });
describe('principal transport', () => {
  it('rejects ambiguous credentials', () => expect(() => setCredentials({access:'a',guest:'b'})).toThrow('AMBIGUOUS_PRINCIPAL'));
  it('replaces user with guest without leaking old authorization', async () => {
    setCredentials({access:'a'}); setCredentials({guest:'b'});
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch',fetcher); await api('/example');
    const headers = fetcher.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBeNull(); expect(headers.get('X-Guest-Token')).toBe('b');
  });
  it('reads the backend error envelope', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'Cần đăng nhập'}}),{status:401})));
    await expect(api('/auth/me')).rejects.toThrow('Cần đăng nhập');
  });
});
