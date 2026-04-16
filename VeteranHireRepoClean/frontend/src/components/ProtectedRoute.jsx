import { Navigate } from 'react-router-dom';

import { getToken, getUser } from '../utils/auth';

function ProtectedRoute({ children, roleRequired }) {
  const user = getUser();
  const token = getToken();

  if (!user || !token) {
    return <Navigate to="/" replace />;
  }

  if (roleRequired && String(user.role || '').toLowerCase() !== String(roleRequired).toLowerCase()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
