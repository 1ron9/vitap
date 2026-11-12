import React from 'react';
import ChatBox from '../components/chat/ChatBox';

export const ChatbotPage: React.FC = () => {
  return (
    <div className="chatbot-page">
      <h2>M3/F4 - Trợ Lý Sức Khỏe & Dinh Dưỡng AI</h2>
      <p>Hỏi đáp chế độ ăn uống, sinh hoạt và tương tác thuốc chuẩn y khoa Bộ Y tế.</p>
      <ChatBox />
    </div>
  );
};

export default ChatbotPage;
