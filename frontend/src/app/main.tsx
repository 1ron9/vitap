import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { api, mockMode, setCredentials, type Identity, type TokenPair } from '../shared/api';
import './style.css';

function App() {
  const [user, setUser] = useState<Identity | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState<TokenPair | null>(null);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      if (mockMode) {
        setUser({id:'00000000-0000-4000-8000-000000000001',email:String(data.get('email')),role:'USER',status:'ACTIVE',created_at:new Date().toISOString()});
      } else {
        const pair = await api<TokenPair>('/auth/login', {method:'POST',body:JSON.stringify({email:data.get('email'),password:data.get('password')})});
        setCredentials({access:pair.access_token}); setTokens(pair);
        setUser(await api<Identity>('/auth/me'));
      }
    } catch (e) { setCredentials({}); setTokens(null); setError(String(e)); } finally { setBusy(false); }
  }
  async function logout() {
    setError('');
    try { if (tokens) await api('/auth/logout',{method:'POST',body:JSON.stringify({refresh_token:tokens.refresh_token})}); }
    catch(e) { setError(String(e)); }
    finally { setCredentials({}); setUser(null); setTokens(null); }
  }
  return <><header><strong>VitaP</strong><span>{mockMode ? 'Môi trường thử nghiệm · dữ liệu mẫu' : 'Môi trường phát triển'}</span></header>
    <nav><Link to="/">Tổng quan</Link><Link to="/health">Sức khỏe</Link><Link to="/medication">Thuốc & đơn thuốc</Link><Link to="/assistant">Trợ lý AI</Link></nav>
    <main>{error && <p role="alert">{error}</p>}<Routes>
      <Route path="/" element={<><h1>Nền tảng VitaP</h1><p>Không gian tích hợp và kiểm thử của nhóm.</p>{user ? <section><h2>Xin chào, {user.email}</h2><button onClick={logout}>Đăng xuất</button></section> : <form onSubmit={login}><h2>Đăng nhập</h2><label>Email<input name="email" type="email" required autoComplete="username"/></label><label>Mật khẩu<input name="password" type="password" required autoComplete="current-password"/></label><button disabled={busy}>{busy?'Đang đăng nhập…':'Đăng nhập'}</button></form>}</>}/>
      {['health','medication','assistant'].map(path => <Route key={path} path={`/${path}`} element={<section><h1>{{health:'Hồ sơ sức khỏe',medication:'Thuốc và đơn thuốc',assistant:'Trợ lý sức khỏe'}[path]}</h1><p>Chức năng đang được nhóm phát triển.</p>{!user && path!=='medication' && <Link to="/">Đăng nhập để tiếp tục</Link>}</section>}/>)}
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes></main><footer>Thông tin từ VitaP chỉ mang tính tham khảo, không thay thế chẩn đoán hoặc chỉ định của bác sĩ.</footer></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
