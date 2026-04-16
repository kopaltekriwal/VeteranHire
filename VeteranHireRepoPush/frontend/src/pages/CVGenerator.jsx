import { useEffect, useMemo, useState } from 'react';

import { downloadCvDocx, downloadCvPdf, getCvPrefill } from '../api';

const SKILL_MAP = {
  pm: 'Project Management',
  ai: 'Artificial Intelligence',
  ml: 'Machine Learning',
  hr: 'Human Resources',
  ops: 'Operations Management',
};

const ACTION_VERBS = [
  'managed',
  'led',
  'improved',
  'implemented',
  'coordinated',
  'developed',
  'optimized',
  'executed',
  'achieved',
  'reduced',
];

const INITIAL_FORM = {
  name: '',
  role: '',
  email: '',
  phone: '',
  address: '',
  links: '',
  education: '',
  experience: '',
  skills: '',
  projects: '',
  awards: '',
  summary: '',
};

function splitList(value) {
  return String(value || '')
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitEducation(value) {
  return String(value || '')
    .split(/[\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSkill(skill) {
  const key = String(skill || '').trim().toLowerCase();
  const mapped = SKILL_MAP[key] || skill;
  return mapped
    .split(/\s+/)
    .map((word) => (word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
    .trim();
}

function normalizeSkills(skillsText) {
  const seen = new Set();
  const normalized = [];
  splitList(skillsText).forEach((skill) => {
    const label = normalizeSkill(skill);
    const key = label.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      normalized.push(label);
    }
  });
  return normalized;
}

function normalizeExperienceBullets(experienceText, normalizedSkills) {
  let bullets = String(experienceText || '')
    .split(/\n|\u2022|[.;]+/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`));

  const blob = bullets.join(' ').toLowerCase();
  normalizedSkills.slice(0, 4).forEach((skill) => {
    if (!blob.includes(skill.toLowerCase())) {
      bullets.push(`Applied ${skill} to improve delivery quality and operational efficiency.`);
    }
  });

  if (bullets.length === 0) {
    bullets = ['Managed key responsibilities with measurable results and cross-team collaboration.'];
  }
  return bullets;
}

function normalizeExperience(experienceText, normalizedSkills) {
  let bullets = String(experienceText || '')
    .split(/\n|•|[.;]+/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => (/[.!?]$/.test(line) ? line : `${line}.`));

  const blob = bullets.join(' ').toLowerCase();
  normalizedSkills.slice(0, 4).forEach((skill) => {
    if (!blob.includes(skill.toLowerCase())) {
      bullets.push(`Applied ${skill} to improve delivery quality and operational efficiency.`);
    }
  });

  if (bullets.length === 0) {
    bullets = ['Managed key responsibilities with measurable results and cross-team collaboration.'];
  }
  return bullets;
}

function calculateAtsScore(data) {
  const required = [
    data.name,
    data.role,
    data.email,
    data.phone,
    data.summary,
    data.skills.length,
    data.experience.length,
    data.education.length,
    data.projects.length,
    data.awards.length,
  ];
  const completeness = Math.round((required.filter(Boolean).length / required.length) * 40);
  const skillRelevance = Math.min(35, data.skills.length * 4);
  const experienceBlob = data.experience.join(' ').toLowerCase();
  const verbHits = ACTION_VERBS.filter((verb) => experienceBlob.includes(verb)).length;
  const actionScore = Math.min(25, verbHits * 5);

  return {
    total: Math.min(100, completeness + skillRelevance + actionScore),
    breakdown: { completeness, skillRelevance, actionScore },
  };
}

function triggerDownload({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function CVGenerator({ user }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const normalized = useMemo(() => {
    const skills = normalizeSkills(form.skills);
    const experience = normalizeExperienceBullets(form.experience, skills);
    return {
      ...form,
      links: splitList(form.links),
      education: splitEducation(form.education),
      projects: splitList(form.projects),
      awards: splitList(form.awards),
      skills,
      experience,
      summary: String(form.summary || '').trim(),
    };
  }, [form]);

  const ats = useMemo(() => calculateAtsScore(normalized), [normalized]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkTheme(root.getAttribute('data-theme') === 'dark');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingPrefill(true);
      setError('');
      try {
        const payload = await getCvPrefill(user.id);
        if (cancelled) return;
        setForm((prev) => ({ ...prev, ...payload.prefill }));
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load resume-based prefill.');
        }
      } finally {
        if (!cancelled) {
          setLoadingPrefill(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const buildPayload = () => ({
    name: normalized.name,
    role: normalized.role,
    email: normalized.email,
    phone: normalized.phone,
    address: normalized.address,
    links: normalized.links.join(', '),
    education: normalized.education.join(', '),
    experience: normalized.experience.join('\n'),
    skills: normalized.skills.join(', '),
    projects: normalized.projects.join(', '),
    awards: normalized.awards.join(', '),
    summary: normalized.summary,
  });

  const runDownload = async (type) => {
    if (!normalized.name.trim()) {
      setError('Name is required before download.');
      return;
    }

    setError('');
    setMessage('');
    setDownloading(type);
    try {
      const payload = buildPayload();
      const fileData = type === 'pdf' ? await downloadCvPdf(payload) : await downloadCvDocx(payload);
      triggerDownload(fileData);
      setMessage(`Downloaded ${fileData.filename}`);
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setDownloading('');
    }
  };

  return (
    <section className="page page-section">
      <div className="header-box">
        <h1 className="page-title">CV Generator</h1>
        <p>Create an ATS-friendly CV with live preview and one-click PDF/DOCX download.</p>
      </div>

      <div className="cv-container">
        <div className="cv-layout">
        <form className={`card-block form-card cv-form ${isDarkTheme ? '' : 'cv-light'}`} onSubmit={(event) => event.preventDefault()}>
          <div className="cv-form-header">
            <h2>Resume Details</h2>
            {loadingPrefill ? <span className="muted">Auto-filling from latest resume...</span> : null}
          </div>

          <label>Name<input value={form.name} onChange={onFieldChange('name')} placeholder="John Doe" /></label>
          <label>Role<input value={form.role} onChange={onFieldChange('role')} placeholder="Logistics Manager" /></label>
          <label>Email<input type="email" value={form.email} onChange={onFieldChange('email')} placeholder="john@email.com" /></label>
          <label>Phone<input value={form.phone} onChange={onFieldChange('phone')} placeholder="+91-9XXXXXXXXX" /></label>
          <label>Address<input value={form.address} onChange={onFieldChange('address')} placeholder="City, State, Country" /></label>
          <label>Links (LinkedIn, GitHub, Portfolio - comma separated)<textarea rows="2" value={form.links} onChange={onFieldChange('links')} placeholder="https://linkedin.com/in/you, https://github.com/you, https://portfolio.com" /></label>
          <label>Education (one entry per line)<textarea rows="2" value={form.education} onChange={onFieldChange('education')} placeholder={"B.Tech Mechanical, XYZ University, 2018\nMBA, ABC Institute, 2022"} /></label>
          <label>Experience<textarea rows="4" value={form.experience} onChange={onFieldChange('experience')} placeholder="Managed logistics operations for 200+ personnel" /></label>
          <label>Skills (comma-separated)<textarea rows="2" value={form.skills} onChange={onFieldChange('skills')} placeholder="PM, AI, Logistics, Inventory Management" /></label>
          <label>Projects (comma-separated)<textarea rows="2" value={form.projects} onChange={onFieldChange('projects')} placeholder="Fleet Optimization Program, Warehouse Automation Rollout" /></label>
          <label>Awards (comma-separated)<textarea rows="2" value={form.awards} onChange={onFieldChange('awards')} placeholder="Service Excellence Medal, Best Team Lead 2023" /></label>
          <label>Professional Summary<textarea rows="4" value={form.summary} onChange={onFieldChange('summary')} placeholder="Disciplined veteran with 12 years..." /></label>

          <div className="cv-download-row">
            <button type="button" className="military-btn" disabled={Boolean(downloading)} onClick={() => runDownload('pdf')}>
              {downloading === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
            </button>
            <button type="button" className="military-btn" disabled={Boolean(downloading)} onClick={() => runDownload('docx')}>
              {downloading === 'docx' ? 'Preparing DOCX...' : 'Download DOCX'}
            </button>
          </div>
        </form>

        <aside className="cv-preview-shell">
          <div className="card-block cv-score-card">
            <h3>ATS Score: {ats.total}%</h3>
            <p className="muted">
              Completeness {ats.breakdown.completeness}/40 • Skill Relevance {ats.breakdown.skillRelevance}/35 • Action Verbs {ats.breakdown.actionScore}/25
            </p>
          </div>

          <article className="cv-preview preview-card card-block">
            <h2>{normalized.name || 'Candidate Name'}</h2>
            <p className="cv-role">{normalized.role || 'Target Role'}</p>
            <p>{[normalized.email, normalized.phone, normalized.address].filter(Boolean).join(' | ') || 'email@example.com | +91-XXXXXXXXXX | City, Country'}</p>

            <h3>Links</h3>
            <p>{normalized.links.join(' | ') || 'LinkedIn | GitHub | Portfolio'}</p>

            <h3>Professional Summary</h3>
            <p>{normalized.summary || 'Add a concise professional summary highlighting achievements and target role fit.'}</p>

            <h3>Skills</h3>
            <p>{normalized.skills.join(', ') || 'Project Management, Leadership, Operations Management'}</p>

            <h3>Experience</h3>
            <ul>{normalized.experience.map((item) => <li key={item}>{item}</li>)}</ul>

            <h3>Education</h3>
            <ul>{(normalized.education.length ? normalized.education : ['Add your education details.']).map((item) => <li key={item}>{item}</li>)}</ul>

            <h3>Projects</h3>
            <ul>{(normalized.projects.length ? normalized.projects : ['Add your key projects.']).map((item) => <li key={item}>{item}</li>)}</ul>

            <h3>Certifications / Awards</h3>
            <ul>{(normalized.awards.length ? normalized.awards : ['Add certifications or awards.']).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </aside>
        </div>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

export default CVGenerator;

