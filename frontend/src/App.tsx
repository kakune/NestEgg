import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    fetch('/api')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.text();
      })
      .then((data) => setMessage(data))
      .catch(() => setMessage('Failed to fetch message from backend.'));
  }, []);

  return (
    <>
      <h1>NestEgg</h1>
      <h2>Monorepo setup with NestJS, React, and Docker</h2>
      <div className="card">
        <p>Message from Backend: <strong>{message}</strong></p>
      </div>
    </>
  )
}

export default App