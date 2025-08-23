import { useState, useEffect } from 'react';
import './App.css';

interface User {
  id: number;
  name: string;
}

function App() {
  const [message, setMessage] = useState('Loading...');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch message from backend
    fetch('/api')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.text();
      })
      .then((data) => {
        setMessage(data);
      })
      .catch((err) => {
        console.error('Backend API Error:', err);
        setMessage('❌ Failed to connect to backend');
        setError(err.message);
      });

    // Fetch users from backend
    fetch('/api/users')
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            setUsers([]);
            return;
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: User[]) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Users API Error:', err);
        setUsers([{ id: 0, name: '❌ Failed to load users' }]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    window.location.reload();
  };

  return (
    <div className="app">
      <header style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
        <h1>🥚 NestEgg - React Frontend</h1>
        <p>Household Budget Management System</p>
      </header>
      
      <main style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <section style={{ marginBottom: '30px' }}>
          <h2>📡 Backend Connection Status</h2>
          <div style={{ 
            padding: '15px', 
            borderRadius: '8px', 
            backgroundColor: message.includes('❌') ? '#ffe6e6' : '#e6ffe6',
            border: `1px solid ${message.includes('❌') ? '#ffcccc' : '#ccffcc'}`
          }}>
            <strong>API Response:</strong> {message}
            {error && (
              <div style={{ marginTop: '10px', color: '#d00', fontSize: '14px' }}>
                Error details: {error}
              </div>
            )}
          </div>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>👥 Users from Database</h2>
          {isLoading ? (
            <div>Loading users...</div>
          ) : (
            <div style={{ 
              padding: '15px', 
              borderRadius: '8px', 
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6'
            }}>
              {users.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {users.map((user) => (
                    <li key={user.id} style={{ marginBottom: '5px' }}>
                      ID: {user.id} - {user.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                  No users found (endpoint may not exist yet)
                </div>
              )}
            </div>
          )}
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2>⚙️ Actions</h2>
          <button 
            onClick={handleRefresh}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🔄 Refresh Connection
          </button>
        </section>

        <section>
          <h2>ℹ️ System Information</h2>
          <div style={{ 
            padding: '15px', 
            borderRadius: '8px', 
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6'
          }}>
            <p><strong>Environment:</strong> {process.env.NODE_ENV || 'development'}</p>
            <p><strong>React Version:</strong> 18.x</p>
            <p><strong>Frontend Status:</strong> ✅ Running</p>
            <p><strong>API Endpoint:</strong> /api</p>
            <p><strong>Expected Backend:</strong> NestJS API</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;