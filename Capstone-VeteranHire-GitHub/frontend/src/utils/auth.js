export const getUser = () => {
  try {
    const primary = localStorage.getItem('user');
    if (primary) {
      return JSON.parse(primary);
    }
    const legacy = localStorage.getItem('vh_user');
    return legacy ? JSON.parse(legacy) : null;
  } catch {
    return null;
  }
};

export const getToken = () => localStorage.getItem('token') || localStorage.getItem('vh_token') || '';

export const setUserStorage = (user, token = '') => {
  if (user && typeof user === 'object') {
    localStorage.setItem('user', JSON.stringify(user));
  }
  if (token) {
    localStorage.setItem('token', token);
  }
};

export const clearUserStorage = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('vh_user');
  localStorage.removeItem('vh_token');
};
