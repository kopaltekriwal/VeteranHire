import { useEffect, useMemo, useState } from 'react';

import { generateCourses } from '../api';
import CourseCard from '../components/CourseCard';

const DEFAULT_COURSES = [
  {
    name: 'Supply Chain Fundamentals',
    provider: 'Coursera',
    rating: '4.7',
    duration: '6 weeks',
    level: 'Beginner',
    description: 'Core supply chain concepts, planning, and execution for operations roles.',
    skill: 'Supply Chain',
  },
  {
    name: 'Process Management Basics',
    provider: 'Udemy',
    rating: '4.6',
    duration: '5 weeks',
    level: 'Beginner',
    description: 'Learn process tracking, SOP design, and workflow optimization.',
    skill: 'Process Tracking',
  },
  {
    name: 'Data Analysis for Operations',
    provider: 'Coursera',
    rating: '4.8',
    duration: '8 weeks',
    level: 'Intermediate',
    description: 'Use practical analytics to improve operational decisions and reporting.',
    skill: 'Data Analysis',
  },
  {
    name: 'Project Management Essentials',
    provider: 'Udemy',
    rating: '4.5',
    duration: '6 weeks',
    level: 'Beginner',
    description: 'Project lifecycle, planning, risk control, and delivery fundamentals.',
    skill: 'Project Management',
  },
  {
    name: 'Leadership Communication',
    provider: 'Coursera',
    rating: '4.7',
    duration: '4 weeks',
    level: 'Beginner',
    description: 'Build clear communication and team leadership in civilian environments.',
    skill: 'Leadership',
  },
  {
    name: 'Warehouse Operations & Safety',
    provider: 'Udemy',
    rating: '4.4',
    duration: '7 weeks',
    level: 'Intermediate',
    description: 'Warehouse standards, safety compliance, and inventory flow techniques.',
    skill: 'Warehouse Operations',
  },
  {
    name: 'ERP for Logistics Teams',
    provider: 'Coursera',
    rating: '4.6',
    duration: '6 weeks',
    level: 'Intermediate',
    description: 'ERP workflows for transport, procurement, and stock control.',
    skill: 'ERP',
  },
  {
    name: 'Workplace Cybersecurity Awareness',
    provider: 'Udemy',
    rating: '4.5',
    duration: '3 weeks',
    level: 'Beginner',
    description: 'Security awareness and practical defense practices for daily operations.',
    skill: 'Security',
  },
  {
    name: 'Vendor Management Essentials',
    provider: 'Coursera',
    rating: '4.7',
    duration: '5 weeks',
    level: 'Intermediate',
    description: 'Build vendor coordination, contracts, and partner performance workflows.',
    skill: 'Vendor Management',
  },
  {
    name: 'Risk Management for Teams',
    provider: 'Udemy',
    rating: '4.4',
    duration: '4 weeks',
    level: 'Beginner',
    description: 'Identify operational risks and build practical mitigation plans.',
    skill: 'Risk Management',
  },
  {
    name: 'Advanced Inventory Control',
    provider: 'Coursera',
    rating: '4.6',
    duration: '6 weeks',
    level: 'Intermediate',
    description: 'Improve stock accuracy, replenishment, and warehouse productivity.',
    skill: 'Inventory Management',
  },
  {
    name: 'Team Supervision in Operations',
    provider: 'Udemy',
    rating: '4.5',
    duration: '5 weeks',
    level: 'Beginner',
    description: 'Lead frontline teams with strong planning and accountability.',
    skill: 'Supervision',
  },
];

function UpskillPage({ user, resumeStatus, lastAnalysisResult, onResumeStatusChange, onAnalysisUpdate }) {
  const [resumeMode, setResumeMode] = useState('profile');
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(lastAnalysisResult || null);
  const [analysisDone, setAnalysisDone] = useState(false);

  const hasStoredResume = useMemo(() => Boolean(user?.id && resumeStatus?.hasResume), [user?.id, resumeStatus?.hasResume]);
  const allCourses = useMemo(() => [...DEFAULT_COURSES], []);
  const randomCourses = useMemo(() => {
    const fullDataset = [...allCourses];
    const source = fullDataset.length >= 10
      ? fullDataset
      : [...fullDataset, ...DEFAULT_COURSES].slice(0, 10);
    return [...source].sort(() => 0.5 - Math.random()).slice(0, 10);
  }, [allCourses]);
  const filteredCoursesAfterAnalysis = useMemo(() => {
    if (!analysisDone || !result) {
      return [];
    }
    const missingSkills = (result.skill_gap?.missing_skills || []).map((skill) => String(skill || '').toLowerCase());
    if (!missingSkills.length) {
      return result.courses || [];
    }
    return (result.courses || []).filter((course) => {
      const tags = [
        String(course.skill || '').toLowerCase(),
        String(course.name || '').toLowerCase(),
      ];
      return missingSkills.some((skill) => tags.some((tag) => tag.includes(skill) || skill.includes(tag)));
    });
  }, [result]);

  useEffect(() => {
    if (!hasStoredResume) {
      setResumeMode('upload');
    }
  }, [hasStoredResume]);

  const processRequest = async ({ userId, file }) => {
    setLoading(true);
    setError('');
    try {
      const payload = await generateCourses({ userId, resumeFile: file });
      setResult(payload);
      setAnalysisDone(true);

      const nextStatus = {
        hasResume: true,
        lastUpdatedAt: new Date().toISOString(),
      };
      onResumeStatusChange?.(nextStatus);
      onAnalysisUpdate?.(payload);
      localStorage.setItem('vh_last_analysis', JSON.stringify(payload));
    } catch (err) {
      setError(err.message || 'Failed to generate course recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const onUseResume = async () => {
    if (!hasStoredResume || !user?.id) {
      setError('Upload a resume first.');
      return;
    }
    await processRequest({ userId: user.id, file: null });
  };

  const onUploadResume = async (event) => {
    event.preventDefault();
    if (resumeMode === 'profile') {
      await onUseResume();
      return;
    }
    if (!resumeFile) {
      setError('Upload resume to get personalized course recommendations');
      return;
    }
    await processRequest({ userId: user?.id, file: resumeFile });
  };

  return (
    <section className="page page-section">
      <div className="header-box">
        <h1 className="page-title">Upskill</h1>
        <p>Generate your skill gap analysis and course recommendations without job matching.</p>
      </div>

      <form className="resume-form card-block upskill-option" onSubmit={onUploadResume}>
        <div className="resume-mode-tabs" role="tablist" aria-label="Resume source options">
          <button
            type="button"
            className={resumeMode === 'profile' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setResumeMode('profile')}
            disabled={!hasStoredResume}
            data-tooltip={!hasStoredResume ? 'Upload a resume first' : ''}
          >
            Use Existing Resume
          </button>
          <button
            type="button"
            className={resumeMode === 'upload' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setResumeMode('upload')}
          >
            Upload New Resume
          </button>
        </div>

        {resumeMode === 'profile' ? (
          <p className="muted">Option 1: Use uploaded profile resume</p>
        ) : (
          <>
            <p className="muted">Option 2: Upload new resume</p>
            <label
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  setResumeFile(file);
                }
              }}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
              />
              <span>{resumeFile ? resumeFile.name : 'Drag & drop your resume here, or click to upload'}</span>
            </label>
          </>
        )}
        <button type="submit" className="military-btn" disabled={loading}>
          {loading ? 'Analyzing...' : resumeMode === 'profile' ? 'Use Existing Resume' : 'Generate Courses'}
        </button>
      </form>

      {loading && (
        <p className="muted card-block">
          Analyzing your profile...
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {!loading && !analysisDone && (
        <div className="card-block">
          <h2>Explore / Popular Courses</h2>
          <p className="muted">Start with these high-impact courses while we prepare your personalized learning path.</p>
          <div className="course-grid">
            {randomCourses.map((course) => (
              <CourseCard key={`${course.name}-${course.provider}`} course={course} />
            ))}
          </div>
        </div>
      )}

      {analysisDone && result && (
        <div className="card-block">
          <h2>Matching Skills</h2>
          <ul>
            {(result.skills || []).map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>

          <h2>Skill Gap</h2>
          <ul>
            {(result.skill_gap?.missing_skills || []).map((skill) => (
              <li key={`gap-${skill}`}>{skill}</li>
            ))}
          </ul>

          <h2>Course Recommendations</h2>
          <div className="course-grid">
            {filteredCoursesAfterAnalysis.map((course) => (
              <CourseCard key={`${course.name}-${course.provider}`} course={course} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default UpskillPage;

