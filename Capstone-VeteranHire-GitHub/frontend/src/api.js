import { getToken } from './utils/auth';
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function toUrl(path) {
  return new URL(path, API_BASE_URL).toString();
}

async function parseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

export async function searchJobs(query, filters = {}) {
  const url = new URL('/search_jobs', API_BASE_URL);
  if (query?.trim()) {
    url.searchParams.set('q', query.trim());
  }

  if (filters.location) {
    url.searchParams.set('location', filters.location);
  }
  if (filters.salaryRange) {
    url.searchParams.set('salary_range', filters.salaryRange);
  }
  if (filters.jobType) {
    url.searchParams.set('job_type', filters.jobType);
  }
  if (filters.experienceLevel) {
    url.searchParams.set('experience_level', filters.experienceLevel);
  }

  const response = await authFetch(url.toString());
  return parseJson(response, 'Failed to search jobs.');
}

export async function recommendJobs(resumeFile, userId) {
  const formData = new FormData();
  formData.append('resume_file', resumeFile);
  if (userId) {
    formData.append('user_id', String(userId));
  }

  const response = await authFetch(toUrl('/recommend_jobs'), {
    method: 'POST',
    body: formData,
  });

  return parseJson(response, 'Failed to process resume.');
}

export async function fetchCareerGuidance(action) {
  const response = await authFetch(toUrl('/career_guidance'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });

  return parseJson(response, 'Failed to fetch career guidance.');
}

export async function chatWithAssistant({ userId, message }) {
  const response = await authFetch(toUrl('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId || null,
      message,
    }),
  });

  return parseJson(response, 'Failed to fetch assistant response.');
}

export async function getCvPrefill(userId) {
  const response = await authFetch(toUrl(`/cv_prefill/${userId}`));
  return parseJson(response, 'Failed to load CV prefill data.');
}

async function downloadCvFile(endpoint, payload, fallbackName) {
  const response = await authFetch(toUrl(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || 'CV generation failed.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const fileMatch = disposition.match(/filename="?([^"]+)"?/i);
  const filename = fileMatch?.[1] || fallbackName;
  return { blob, filename };
}

export async function downloadCvPdf(payload) {
  return downloadCvFile('/generate_pdf', payload, 'candidate_ATS_Resume.pdf');
}

export async function downloadCvDocx(payload) {
  return downloadCvFile('/generate_docx', payload, 'candidate_ATS_Resume.docx');
}

export async function generateCourses({ userId, resumeFile }) {
  const hasResumeFile = Boolean(resumeFile);
  const hasUserId = Boolean(userId);

  if (!hasResumeFile && !hasUserId) {
    throw new Error('Provide either user_id or resume_file.');
  }

  let response;
  if (hasResumeFile) {
    const formData = new FormData();
    formData.append('resume_file', resumeFile);
    if (hasUserId) {
      formData.append('user_id', String(userId));
    }
    response = await authFetch(toUrl('/generate_courses'), {
      method: 'POST',
      body: formData,
    });
  } else {
    response = await authFetch(toUrl('/generate_courses'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });
  }

  return parseJson(response, 'Failed to generate course recommendations.');
}

export async function signupUser(payload) {
  const response = await authFetch(toUrl('/signup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Signup failed.');
}

export async function loginUser(payload) {
  const response = await authFetch(toUrl('/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Login failed.');
}

export async function getProfile(userId) {
  const response = await authFetch(toUrl(`/profile/${userId}`));
  return parseJson(response, 'Failed to load profile.');
}

export async function updateProfile(userId, payload) {
  const response = await authFetch(toUrl(`/profile/${userId}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update profile.');
}

async function uploadFile(endpoint, file, extras = {}) {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(extras).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });
  const response = await authFetch(toUrl(endpoint), {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'File upload failed.');
}

export async function uploadProfilePicture(userId, file) {
  return uploadFile(`/profile/${userId}/profile_picture`, file);
}

export async function uploadVerificationDocument(userId, file, documentType = 'aadhaar', aadhaarNumber = '') {
  return uploadFile(`/profile/${userId}/verification`, file, { document_type: documentType, aadhaar_number: aadhaarNumber });
}

export async function setVerificationStatus(userId, status) {
  const response = await authFetch(toUrl(`/profile/${userId}/verification_status`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update verification status.');
}

export async function getAdminUsers(adminId) {
  const url = new URL('/admin/users', API_BASE_URL);
  url.searchParams.set('admin_id', String(adminId));
  const response = await authFetch(url.toString());
  return parseJson(response, 'Failed to load admin users.');
}

export async function getVerificationQueue(adminId) {
  const url = new URL('/admin/verification_queue', API_BASE_URL);
  url.searchParams.set('admin_id', String(adminId));
  const response = await authFetch(url.toString());
  return parseJson(response, 'Failed to load verification queue.');
}

export async function updateVerificationByAdmin(adminId, userId, status) {
  const url = new URL(`/admin/verification/${userId}`, API_BASE_URL);
  url.searchParams.set('admin_id', String(adminId));
  const response = await authFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update verification.');
}

export async function getUsers() {
  const response = await authFetch(toUrl('/api/users'));
  return parseJson(response, 'Failed to load users.');
}

export async function getPendingVerifications() {
  const response = await authFetch(toUrl('/api/verification'));
  return parseJson(response, 'Failed to load pending verifications.');
}

export async function verifyUser(userId, status) {
  const response = await authFetch(toUrl(`/api/verify/${userId}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update user verification.');
}

export async function getAdminUserAnalytics(userId) {
  const response = await authFetch(toUrl(`/api/admin/user/${userId}`));
  return parseJson(response, 'Failed to load user analytics.');
}

export async function getAdminStats(adminId) {
  const url = new URL('/admin/stats', API_BASE_URL);
  if (adminId) {
    url.searchParams.set('admin_id', String(adminId));
  }
  const response = await authFetch(url.toString());
  return parseJson(response, 'Failed to load admin stats.');
}

export function asAbsoluteUrl(relativeOrAbsolute) {
  if (!relativeOrAbsolute) {
    return '';
  }
  if (relativeOrAbsolute.startsWith('http://') || relativeOrAbsolute.startsWith('https://')) {
    return relativeOrAbsolute;
  }
  return toUrl(relativeOrAbsolute);
}
