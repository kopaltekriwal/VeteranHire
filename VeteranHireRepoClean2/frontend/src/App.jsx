import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import SearchPage from './pages/SearchPage';
import JobRecommendationsPage from './pages/JobRecommendationsPage';
import ChatbotPage from './pages/ChatbotPage';
import CvGenerationPage from './pages/CvGenerationPage';
import MoreWebsitesPage from './pages/MoreWebsitesPage';
import ProfilePage from './pages/ProfilePage';
import UpskillPage from './pages/UpskillPage';
import AdminPage from './pages/AdminPage';
import AdminUserAnalyticsPage from './pages/AdminUserAnalyticsPage';
import { asAbsoluteUrl, loginUser, signupUser } from './api';
import { clearUserStorage, getUser, setUserStorage } from './utils/auth';

function readJsonFromStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeUser(rawUser) {
  const candidate = rawUser?.user ? rawUser.user : rawUser;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const idCandidate = candidate.id ?? candidate.user_id;
  const id = Number(idCandidate);
  const validId = Number.isFinite(id) && id > 0 ? id : undefined;

  return {
    ...candidate,
    id: validId,
    profile_pic: asAbsoluteUrl(candidate.profile_pic),
  };
}

function App() {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(() => normalizeUser(getUser() || readJsonFromStorage('vh_user', null)));
  const [resumeStatus, setResumeStatus] = useState(() => readJsonFromStorage('vh_resume_status', { hasResume: false, lastUpdatedAt: null }));
  const [lastAnalysisResult, setLastAnalysisResult] = useState(() => readJsonFromStorage('vh_last_analysis', null));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('vh_user', JSON.stringify(user));
      setUserStorage(user);
    } else {
      localStorage.removeItem('vh_user');
      clearUserStorage();
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('vh_resume_status', JSON.stringify(resumeStatus));
  }, [resumeStatus]);

  useEffect(() => {
    if (lastAnalysisResult) {
      localStorage.setItem('vh_last_analysis', JSON.stringify(lastAnalysisResult));
    } else {
      localStorage.removeItem('vh_last_analysis');
    }
  }, [lastAnalysisResult]);

  const authActions = useMemo(
    () => ({
      login: async ({ email, password }) => {
        const payload = await loginUser({ email, password });
        const nextUser = normalizeUser(payload.user);
        const token = String(payload.token || '').trim();
        if (!nextUser) {
          throw new Error('Login response did not include a valid user profile.');
        }
        setUser(nextUser);
        setUserStorage(nextUser, token);
        return nextUser;
      },
      signup: async ({ name, email, password }) => {
        const payload = await signupUser({ name, email, password });
        const nextUser = normalizeUser(payload.user);
        const token = String(payload.token || '').trim();
        if (!nextUser) {
          throw new Error('Signup response did not include a valid user profile.');
        }
        setUser(nextUser);
        setUserStorage(nextUser, token);
        return nextUser;
      },
      logout: () => {
        clearUserStorage();
        setUser(null);
      },
      updateUser: (profile) => {
        const nextUser = normalizeUser(profile);
        if (nextUser) {
          setUser(nextUser);
        }
      },
      onResumeStatusChange: (nextStatus) => setResumeStatus(nextStatus),
      onAnalysisUpdate: (analysisPayload) => setLastAnalysisResult(analysisPayload),
    }),
    []
  );

  return (
    <div className="app-shell">
      <Navbar
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        user={user}
        authActions={authActions}
      />

      <main className="app-content">
        <Routes>
          <Route path="/" element={String(getUser()?.role || user?.role || '').toLowerCase() === 'admin' ? <Navigate to="/admin" replace /> : <SearchPage mode="all" />} />
          <Route path="/search" element={<SearchPage mode="search" />} />
          <Route path="/ai-assistant" element={<ChatbotPage user={user} />} />
          <Route
            path="/job-recommendations"
            element={
              <JobRecommendationsPage
                user={user}
                onResumeStatusChange={authActions.onResumeStatusChange}
                onAnalysisUpdate={authActions.onAnalysisUpdate}
              />
            }
          />
          <Route
            path="/upskill"
            element={
              <UpskillPage
                user={user}
                resumeStatus={resumeStatus}
                lastAnalysisResult={lastAnalysisResult}
                onResumeStatusChange={authActions.onResumeStatusChange}
                onAnalysisUpdate={authActions.onAnalysisUpdate}
              />
            }
          />
          <Route path="/profile" element={<ProfilePage user={user} onProfileUpdated={authActions.updateUser} />} />
          <Route path="/cv-generation" element={<CvGenerationPage user={user} />} />
          <Route path="/more-websites" element={<MoreWebsitesPage />} />
          <Route
            path="/admin"
            element={(
              <ProtectedRoute roleRequired="admin">
                <AdminPage user={user || getUser()} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/user/:id"
            element={(
              <ProtectedRoute roleRequired="admin">
                <AdminUserAnalyticsPage />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
