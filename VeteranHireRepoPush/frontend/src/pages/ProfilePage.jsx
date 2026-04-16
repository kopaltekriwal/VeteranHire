import { useEffect, useState } from 'react';

import {
  generateCourses,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  uploadVerificationDocument,
} from '../api';

function ProfilePage({ user, onProfileUpdated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    education: '',
    military_rank: '',
    branch: '',
    aadhaar_number: '',
    experience_years: 0,
    preferred_job_type: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingResume, setSavingResume] = useState(false);
  const [verificationFile, setVerificationFile] = useState(null);
  const [aadhaarError, setAadhaarError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setProfileLoading(true);
      setError('');
      try {
        const payload = await getProfile(user.id);
        if (cancelled) {
          return;
        }
        const profile = payload.profile;
        onProfileUpdated(profile);
        setForm({
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          location: profile.location || '',
          education: profile.education || '',
          military_rank: profile.military_rank || '',
          branch: profile.branch || '',
          aadhaar_number: profile.aadhaar_number || '',
          experience_years: profile.experience_years || 0,
          preferred_job_type: profile.preferred_job_type || '',
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load profile.');
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.id, onProfileUpdated]);

  if (!user?.id) {
    return (
      <section className="page page-section">
        <h1 className="page-title">Manage Profile</h1>
        <p className="muted">Please login first.</p>
      </section>
    );
  }

  const onFieldChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    setAadhaarError('');

    const aadhaarDigits = String(form.aadhaar_number || '').replace(/\D/g, '');
    if (aadhaarDigits && !/^\d{12}$/.test(aadhaarDigits)) {
      setSaving(false);
      setAadhaarError('Aadhaar number must contain exactly 12 digits.');
      return;
    }

    try {
      const payload = await updateProfile(user.id, {
        ...form,
        aadhaar_number: aadhaarDigits,
        experience_years: Number(form.experience_years || 0),
      });
      onProfileUpdated(payload.profile);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPicture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMessage('');
    setError('');
    try {
      const payload = await uploadProfilePicture(user.id, file);
      onProfileUpdated(payload.profile);
      setMessage('Profile picture uploaded.');
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture.');
    }
  };

  const submitVerification = async () => {
    if (!verificationFile) {
      setAadhaarError('Please upload a verification document.');
      return;
    }

    const aadhaarDigits = String(form.aadhaar_number || '').replace(/\D/g, '');
    if (!/^\d{12}$/.test(aadhaarDigits)) {
      setAadhaarError('Aadhaar number must contain exactly 12 digits.');
      return;
    }

    setMessage('');
    setError('');
    setAadhaarError('');
    try {
      const payload = await uploadVerificationDocument(user.id, verificationFile, 'aadhaar', aadhaarDigits);
      onProfileUpdated(payload.profile);
      setVerificationFile(null);
      setMessage('Verification submitted successfully. Status is now Pending.');
    } catch (err) {
      setError(err.message || 'Failed to submit verification.');
    }
  };

  const uploadResumeForUpskill = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMessage('');
    setError('');
    setSavingResume(true);
    try {
      await generateCourses({ userId: user.id, resumeFile: file });
      setMessage('Resume saved successfully. You can now use "Use My Resume" in Upskill.');
    } catch (err) {
      setError(err.message || 'Failed to save resume for Upskill.');
    } finally {
      setSavingResume(false);
      event.target.value = '';
    }
  };

  return (
    <section className="page page-section">
      <h1 className="page-title">Manage Profile</h1>
      {profileLoading ? <p>Loading profile...</p> : null}

      <div className="profile-layout">
        <form className="card-block profile-form" onSubmit={saveProfile}>
          <div className="profile-section">
            <h3>Personal Info</h3>

            <label>
              Name
              <input type="text" value={form.name} onChange={onFieldChange('name')} required />
            </label>

            <label>
              Email
              <input type="email" value={form.email} onChange={onFieldChange('email')} required />
            </label>

            <label>
              Phone
              <input type="text" value={form.phone} onChange={onFieldChange('phone')} />
            </label>

            <label>
              Location
              <input type="text" value={form.location} onChange={onFieldChange('location')} />
            </label>
          </div>

          <div className="profile-section">
            <h3>Professional Info</h3>

            <label>
              Education
              <input type="text" value={form.education} onChange={onFieldChange('education')} placeholder="Highest degree or qualification" />
            </label>

            <label>
              Military Rank
              <input type="text" value={form.military_rank} onChange={onFieldChange('military_rank')} placeholder="Ex: Subedar, Captain" />
            </label>

            <label>
              Branch
              <input type="text" value={form.branch} onChange={onFieldChange('branch')} placeholder="Army, Navy, Air Force" />
            </label>

            <label>
              Aadhaar Number
              <input type="text" value={form.aadhaar_number || ''} onChange={onFieldChange('aadhaar_number')} placeholder="XXXX-XXXX-XXXX" />
            </label>

            <label>
              Years of Experience
              <input type="number" min="0" value={form.experience_years} onChange={onFieldChange('experience_years')} />
            </label>

            <label>
              Preferred Job Type
              <select value={form.preferred_job_type} onChange={onFieldChange('preferred_job_type')}>
                <option value="">Not set</option>
                <option value="govt">Government</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>

          <button type="submit" className="military-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <div className="card-block">
          <div className="profile-section">
            <h3>Personal Info</h3>
            <h4>Profile Picture</h4>
            <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={uploadPicture} />

            <h4>Resume For Upskill</h4>
            <input type="file" accept=".pdf,.doc,.docx" onChange={uploadResumeForUpskill} />
            <p className="muted">
              Upload once here to enable one-click <strong>Use My Resume</strong> in the Upskill tab.
            </p>
            {savingResume ? <p className="muted">Saving resume...</p> : null}
          </div>

          <div className="profile-section">
            <h3>Verification</h3>

            <label>
              Aadhaar Number
              <input type="text" value={form.aadhaar_number || ''} onChange={onFieldChange('aadhaar_number')} placeholder="XXXX-XXXX-XXXX" />
            </label>

            <label>
              Upload Verification Document
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => {
                  setVerificationFile(event.target.files?.[0] || null);
                  setAadhaarError('');
                }}
              />
            </label>

            <p className="verification-note">
              Verification is manually reviewed. DigiLocker integration can be added in future.
            </p>

            <div className="verification-status-row">
              <span className={`status-badge ${String(user.verification_status || 'Pending').toLowerCase()}`}>
                {user.verification_status || 'Pending'}
              </span>
              <button type="button" className="military-btn" onClick={submitVerification}>
                Submit for Verification
              </button>
            </div>

            {aadhaarError ? <p className="error-text">{aadhaarError}</p> : null}
          </div>
        </div>
      </div>

      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

export default ProfilePage;
