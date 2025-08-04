import { useState } from 'react';
import { signup } from '../services/api';

function Signup({ onSignupSuccess, onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const handleSignup = async () => {
    try {
      await signup(username, password);
      onSignupSuccess();
    } catch (e) {
      setError(e.response?.data?.detail || 'Signup failed');
    }
  };

  return (
    <>
      <style>{`
        /* Fade in + slide up on load */
        @keyframes fadeUp {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Smooth continuous gradient shimmer */
        @keyframes gradientShift {
          0% {
            background-position: 0% center;
          }
          50% {
            background-position: 100% center;
          }
          100% {
            background-position: 0% center;
          }
        }
          @keyframes fadeUpFast {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        .brand-heading {
          margin: 0;
          font-size: 6rem;
          font-family: "Righteous", sans-serif;
          font-weight: 400;

          background: linear-gradient(90deg, #a958a5, #da1157, #a958a5);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;

          animation: fadeUp 1.2s ease forwards, gradientShift 3s ease infinite;
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.brandWrapper}>
          <h1 className="brand-heading">Intellivus</h1>
        </div>
        <div style={styles.card}>
          <h2 style={styles.title}>Signup</h2>
          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={styles.input}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
          />
          <button
            onClick={handleSignup}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              ...styles.button,
              boxShadow: isHovered
                ? '0 0 12px rgba(218, 17, 87, 0.8)'
                : '0 0 8px rgba(218, 17, 87, 0.6)',
              transform: isHovered ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            Signup
          </button>
          {error && <p style={styles.error}>{error}</p>}
          <p style={styles.link}>
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              style={{ ...styles.anchor, background: 'none', border: 'none', padding: 0 }}
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'row', // brand and card side by side
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#b3d1b1',
    padding: '0 2rem',
  },
  brandWrapper: {
    marginRight: '3rem',
  },
  card: {
    width: '320px',
    padding: '2rem',
    borderRadius: '12px',
    background: '#d3e3d1',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    textAlign: 'center',
    zIndex: 1,
    opacity: 0,
    transform: 'translateY(20px)',
    animation: 'fadeUpFast 0.2s ease forwards',
  },
  title: {
    marginBottom: '1.5rem',
  },
  input: {
    width: '80%',
    padding: '0.5rem',
    marginBottom: '0.75rem',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '0.9rem',
  },
  button: {
    width: '90%',
    padding: '0.5rem',
    background: '#da1157',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
  link: {
    fontSize: '0.9rem',
  },
  anchor: {
    color: '#e65f8e',
    textDecoration: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  error: {
    color: 'red',
    marginBottom: '1rem',
  },
};

export default Signup;
