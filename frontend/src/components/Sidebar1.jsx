import { useEffect, useState, useCallback } from 'react';
import { fetchSessions, deleteSession } from '../services/api';
import { MoreVertical, Edit3, Trash2 } from 'lucide-react'; // Import icons

function Sidebar({ onSelect, activeSession, username, refreshRef, handleLogout, onSessionDeleted }) {
  const [sessions, setSessions] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [isProfileHovered, setIsProfileHovered] = useState(false);
  const [isLogoutHovered, setIsLogoutHovered] = useState(false);
  const [deletingSession, setDeletingSession] = useState(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState(null);
  const [renamingSession, setRenamingSession] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuSessionId(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleMenuClick = (sessionId, e) => {
    e.stopPropagation();
    setOpenMenuSessionId(openMenuSessionId === sessionId ? null : sessionId);
  };

  const handleRenameStart = (sessionId, currentName) => {
    setRenamingSession(sessionId);
    setNewSessionName(currentName.replace('...', ''));
    setOpenMenuSessionId(null);
  };

  const handleRenameSubmit = async (sessionId) => {
    if (!newSessionName.trim()) return;
    
    try {
      // Update the session name locally (you'd need to implement renameSession API call)
      setSessions(prev => prev.map(s => 
        s.session_id === sessionId 
          ? { ...s, preview: newSessionName.trim() }
          : s
      ));
      
      // TODO: Call API to rename session in backend
      // await renameSession(sessionId, newSessionName.trim(), username);
      
    } catch (error) {
      console.error('Error renaming session:', error);
      alert('Failed to rename session. Please try again.');
    } finally {
      setRenamingSession(null);
      setNewSessionName('');
    }
  };

  const handleRenameCancel = () => {
    setRenamingSession(null);
    setNewSessionName('');
  };

  const handleDeleteSession = async (sessionId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this chat session? This action cannot be undone.");
    if (!confirmDelete) return;

    setDeletingSession(sessionId);
    setOpenMenuSessionId(null);
    
    try {
      await deleteSession(sessionId, username);
      
      // Update local sessions list
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      
      // If the deleted session was the active one, notify parent to handle it
      if (sessionId === activeSession && onSessionDeleted) {
        onSessionDeleted(sessionId);
      }
      
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    } finally {
      setDeletingSession(null);
    }
  };

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
          style={{
            ...styles.sessionContainer,
            backgroundColor: s.session_id === activeSession ? '#e0f7fa' : 'transparent',
          }}
        >
          {renamingSession === s.session_id ? (
            <div style={styles.renameContainer}>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(s.session_id);
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                onBlur={() => handleRenameSubmit(s.session_id)}
                style={styles.renameInput}
                autoFocus
              />
            </div>
          ) : (
            <>
              <div
                onClick={() => onSelect(s.session_id)}
                style={styles.sessionItem}
              >
                {s.preview.slice(0, 35)}...
              </div>
              <div style={styles.menuContainer}>
                <button
                  onClick={(e) => handleMenuClick(s.session_id, e)}
                  style={styles.ellipsisBtn}
                  disabled={deletingSession === s.session_id}
                >
                  {deletingSession === s.session_id ? '⏳' : <MoreVertical size={14} />}
                </button>
                
                {openMenuSessionId === s.session_id && (
                  <div style={styles.dropdown}>
                    <button
                      onClick={() => handleRenameStart(s.session_id, s.preview)}
                      style={styles.dropdownItem}
                    >
                      <Edit3 size={12} />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s.session_id)}
                      style={{...styles.dropdownItem, ...styles.deleteItem}}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
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
  sessionContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: '0.3rem 0',
    borderRadius: '5px',
    transition: 'background 0.2s',
    padding: '0.25rem',
    gap: '0.5rem',
    position: 'relative',
  },
  sessionItem: {
    flex: 1,
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#444',
    lineHeight: '1.3',
    borderRadius: '3px',
  },
  menuContainer: {
    position: 'relative',
  },
  ellipsisBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    transition: 'color 0.2s, background-color 0.2s',
    flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: '0',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 100,
    minWidth: '120px',
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#444',
    textAlign: 'left',
    transition: 'background-color 0.2s',
  },
  deleteItem: {
    color: '#dc3545',
  },
  renameContainer: {
    flex: 1,
    padding: '0.25rem 0.5rem',
  },
  renameInput: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '0.25rem 0.5rem',
    fontSize: '12px',
    outline: 'none',
    backgroundColor: '#fff',
  },
};

// Add CSS for hover effects
const hoverStyle = `
  .sidebar .ellipsis-btn:hover {
    color: #333 !important;
    background-color: rgba(0, 0, 0, 0.05) !important;
  }
  .sidebar .dropdown-item:hover {
    background-color: #f5f5f5 !important;
  }
  .sidebar .dropdown-item.delete-item:hover {
    background-color: rgba(220, 53, 69, 0.1) !important;
  }
`;

// Inject CSS for hover effects
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('sidebar-hover-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  const styleSheet = document.createElement('style');
  styleSheet.id = 'sidebar-hover-styles';
  styleSheet.innerText = hoverStyle;
  document.head.appendChild(styleSheet);
}

export default Sidebar;