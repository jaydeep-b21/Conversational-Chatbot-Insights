
import { useEffect, useState, useCallback } from 'react';
import { fetchSessions } from '../services/api';

function Sidebar({ onSelect, activeSession, username, refreshRef, handleLogout }) {
  const [sessions, setSessions] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [isProfileHovered, setIsProfileHovered] = useState(false);
  const [isLogoutHovered, setIsLogoutHovered] = useState(false);

  const fetchAndSetSessions = useCallback(async () => {
    if (username) {
      const data = await fetchSessions(username);
      setSessions(data);
    }
  }, [username]);

  useEffect(() => {
    fetchAndSetSessions();
  }, [fetchAndSetSessions]);

  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = fetchAndSetSessions;
    }
  }, [refreshRef, fetchAndSetSessions]);

  const handleLogoutClick = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (confirmLogout) {
      handleLogout();
    }
  };

  const getPrimaryHSLColor = (name) => {
    const hash = hashCode(name);
    const h = hash % 360;
    const s = 65 + (hash % 20);
    const l = 50 + (hash % 10);
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  // Generates a unique hash from a string
  const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  // Use the hash to generate 3 gradient colors with high entropy
  const getUniqueGradient = (name) => {
    const hash = hashCode(name);
    const h1 = hash % 360;
    const h2 = (hash * 3) % 360;
    const h3 = (hash * 7) % 360;

    const s1 = 65 + (hash % 20); // 65–85%
    const s2 = 60 + (hash % 25);
    const s3 = 70 + (hash % 15);

    const l1 = 50 + (hash % 10); // 50–60%
    const l2 = 45 + (hash % 10);
    const l3 = 55 + (hash % 10);

    return `linear-gradient(135deg, hsl(${h1}, ${s1}%, ${l1}%), hsl(${h2}, ${s2}%, ${l2}%), hsl(${h3}, ${s3}%, ${l3}%))`;
  };

  return (
    <div style={styles.sidebar}>
      {/* Profile Section */}
      <div style={styles.profileContainer}>
        <div style={styles.profileInfo}>
          <div
            onMouseEnter={() => setIsProfileHovered(true)}
            onMouseLeave={() => setIsProfileHovered(false)}
            onClick={() => setShowProfile(prev => !prev)}
            style={{
              ...styles.profileLogo,
              background: getUniqueGradient(username),
              boxShadow: isProfileHovered
              ? `0 0 10px 3px ${getPrimaryHSLColor(username)}`
              : 'none',
              transition: 'box-shadow 0.3s ease-in-out',
            }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          <span style={styles.username}>Hi {username}!</span>
        </div>

        {showProfile && (
          <div style={styles.profileDropdown}>
            <button
              onClick={handleLogoutClick}
              style={{
                ...styles.logoutBtn,
                boxShadow: isLogoutHovered
                  ? '0 0 10px rgba(220, 53, 69, 0.7)'
                  : 'none',
                transition: 'box-shadow 0.3s ease',
              }}
              onMouseEnter={() => setIsLogoutHovered(true)}
              onMouseLeave={() => setIsLogoutHovered(false)}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Separator Line */}
      <div style={styles.separator}></div>

      {/* Chat Sessions */}
      <h3 style={styles.sectionTitle}>Previous Chats</h3>
      {sessions.map((s) => (
        <div
          key={s.session_id}
          onClick={() => onSelect(s.session_id)}
          style={{
            ...styles.sessionItem,
            backgroundColor: s.session_id === activeSession ? '#e0f7fa' : 'transparent',
          }}
        >
          {s.preview.slice(0, 40)}...
        </div>
      ))}
    </div>
  );
}

const styles = {
  sidebar: {
    width: '250px',
    background: 'linear-gradient(to bottom, #d3e3d1, #f3f6f1, #d3e3d1)',
    padding: '1rem',
    overflowY: 'auto',
    borderRight: '1px solid #ddd',
    position: 'relative',
  },
  profileContainer: {
    position: 'relative',
    marginBottom: '0.75rem',
  },
  profileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
  },
  profileLogo: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    color: '#fff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '18px',
    flexShrink: 0,
    cursor: 'pointer',
  },
  username: {
    fontWeight: 'bold',
    fontSize: '15px',
    color: '#333',
  },
  profileDropdown: {
    marginTop: '0.5rem',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '0.5rem',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    zIndex: 1,
  },
  logoutBtn: {
    padding: '0.3rem 0.5rem',
    backgroundColor: '#da1157',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
  },
  separator: {
    height: '1px',
    backgroundColor: '#ccc',
    margin: '1rem 0',
  },
  sectionTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '14px',
    color: '#666',
  },
  sessionItem: {
    padding: '0.5rem',
    margin: '0.3rem 0',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};

export default Sidebar;
