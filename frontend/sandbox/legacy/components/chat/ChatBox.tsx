import React, { useState } from 'react';

export const ChatBox: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ sender: string; text: string }>>([
    { sender: 'AI', text: 'Xin chào bác! Bác đang cần tư vấn về chế độ ăn uống hay đơn thuốc nào ạ?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { sender: 'User', text: userMsg }]);

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          sender: 'AI',
          text: `[Trích dẫn: Bộ Y tế] Đối với câu hỏi "${userMsg}", bác nên duy trì ăn nhạt và uống đủ 2 lít nước mỗi ngày nhé.`
        }
      ]);
    }, 500);
  };

  return (
    <div className="chatbox" style={{ maxWidth: 500, margin: '0 auto', border: '1px solid #ccc', borderRadius: 8, padding: 16 }}>
      <div className="messages" style={{ height: 250, overflowY: 'auto', marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', textAlign: m.sender === 'User' ? 'right' : 'left' }}>
            <strong>{m.sender}: </strong> {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nhập câu hỏi sức khỏe..."
          style={{ flex: 1, padding: 8 }}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} style={{ padding: '8px 16px' }}>Gửi</button>
      </div>
    </div>
  );
};

export default ChatBox;
