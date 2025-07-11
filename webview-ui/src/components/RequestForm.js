import React, { useState } from 'react';

function RequestForm({ onSendRequest }) {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url) onSendRequest(method, url);
  };

  return (
    <form className="request-form" onSubmit={handleSubmit}>
      <select 
        value={method} 
        onChange={(e) => setMethod(e.target.value)}
        className="method-select"
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
      </select>
      
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://api.example.com/resource"
        className="url-input"
        autoFocus
      />
      
      <button type="submit" className="send-button">
        Send
      </button>
    </form>
  );
}

export default RequestForm;