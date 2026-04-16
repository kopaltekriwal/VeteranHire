import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { getUser } from '../utils/auth';

const baseNavItems = [
  { label: 'Search', to: '/search' },
  { label: 'Job Recommendations', to: '/job-recommendations' },
  { label: 'AI Assistant', to: '/ai-assistant' },
  { label: 'Upskill', to: '/upskill' },
  { label: 'CV Generator', to: '/cv-generation' },
  { label: 'More Websites', to: '/more-websites' },
];

function Navbar({ theme, onToggleTheme, user, authActions }) {
  const storedUser = getUser();
  const currentUser = user || storedUser;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const onAdminRoute = location.pathname.startsWith('/admin');

  const onSubmitAuth = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let authUser = null;
      if (isSignup) {
        authUser = await authActions.signup({ name: name.trim(), email: email.trim(), password });
      } else {
        authUser = await authActions.login({ email: email.trim(), password });
      }
      setShowAuthPanel(false);
      setName('');
      setEmail('');
      setPassword('');
      if (String(authUser?.role || '').toLowerCase() === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const navItems = onAdminRoute
    ? [{ label: 'Admin Dashboard', to: '/admin' }]
    : baseNavItems;

  return (
    <header className="top-nav navbar">
      <div className="navbar-left">
        <img
          src="/shield.png"
          alt="VeteranHire Logo"
          className="logo-icon"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate('/');
            }
          }}
        />
        <span className="logo-text">VeteranHire</span>
      </div>

      <nav className="nav-links navbar-center" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar-right">
        <div className="nav-actions">
          <button className="theme-btn" type="button" onClick={onToggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'} Mode
          </button>

          {!currentUser ? (
            <div className="profile-wrap">
              <button className="military-btn" type="button" onClick={() => setShowAuthPanel((prev) => !prev)}>
                Login / Signup
              </button>
              {showAuthPanel && (
                <div className="auth-panel card-block">
                  <h4>{isSignup ? 'Create Account' : 'Login'}</h4>
                  <form onSubmit={onSubmitAuth} className="auth-form">
                    {isSignup && (
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                      />
                    )}
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    {authError && <p className="error-text">{authError}</p>}
                    <button type="submit" className="military-btn" disabled={authLoading}>
                      {authLoading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Login'}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setIsSignup((prev) => !prev);
                      setAuthError('');
                    }}
                  >
                    {isSignup ? 'Already have an account? Login' : 'New user? Signup'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="profile-wrap">
              <button
                className="profile-btn"
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
              >
                <img
                  src={currentUser.profile_pic || 'https://ui-avatars.com/api/?name=User'}
                  alt="Profile"
                  className="profile-avatar"
                />
                <span>{currentUser.name || currentUser.email}</span>
              </button>
              {showProfileMenu && (
                <div className="profile-menu">
                  {onAdminRoute ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/search');
                        setShowProfileMenu(false);
                      }}
                    >
                      Exit Admin
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/profile');
                      setShowProfileMenu(false);
                    }}
                  >
                    Manage Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      authActions.logout();
                      setShowProfileMenu(false);
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
