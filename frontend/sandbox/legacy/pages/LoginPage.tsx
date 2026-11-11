import React, { useState } from 'react';

export const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Đăng nhập với số điện thoại: ${phone}`);
  };

  return (
    <div className="login-container">
      <h2>Đăng Nhập MediCare</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label>Số điện thoại:</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required />
        </div>
        <div>
          <label>Mật khẩu:</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit">Đăng nhập</button>
      </form>
    </div>
  );
};

export default LoginPage;
