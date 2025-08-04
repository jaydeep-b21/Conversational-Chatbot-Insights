import { useRef, useState, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import Signup from './components/Signup';

function App() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('loggedIn') === 'true');
  const [isSignup, setIsSignup] = useState(() => window.location.pathname === '/signup');
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const refreshSidebarRef = useRef(null);

  // Handle browser back button (to return from Signup to Login)
  useEffect(() => {
    const onPopState = () => setIsSignup(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!loggedIn) {
  return isSignup ? (
    <Signup
      onSignupSuccess={() => {
        setIsSignup(false);
        window.history.back();
      }}
      onSwitchToLogin={() => {
        setIsSignup(false);
        window.history.pushState({}, '', '/');
      }}
    />
  ) : (
    <Login
      onLoginSuccess={(name) => {
        setUsername(name);
        localStorage.setItem('username', name);
        localStorage.setItem('loggedIn', 'true');
        setLoggedIn(true);
      }}
      onSwitchToSignup={() => {
        setIsSignup(true);
        window.history.pushState({}, '', '/signup');
      }}
    />
  );
}

  return (
    <div style={styles.app}>
      <Sidebar
        onSelect={setSessionId}
        activeSession={sessionId}
        username={username}
        refreshRef={refreshSidebarRef}
        handleLogout={() => {
          localStorage.removeItem('loggedIn');
          localStorage.removeItem('username');
          setLoggedIn(false);
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChatWindow
          sessionId={sessionId}
          setSessionId={setSessionId}
          username={username}
          refreshSessions={() => refreshSidebarRef.current?.()}
        />
      </div>
    </div>
  );
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'sans-serif',
  },
};

export default App;
