import { useEffect, useState } from 'react';

import { fetchCareerGuidance } from '../api';
import CourseCard from '../components/CourseCard';

const actions = [
  { key: 'improve_resume', label: 'Improve My Resume' },
  { key: 'career_path', label: 'Suggest Career Path' },
  { key: 'skill_courses', label: 'Skill-Based Course Recommendations' },
];

function CareerGuidancePage() {
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');
  const [guidance, setGuidance] = useState(null);
  const [cachedResult, setCachedResult] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('vh_last_recommendation');
    if (saved) {
      setCachedResult(JSON.parse(saved));
    }
  }, []);

  const runAction = async (action) => {
    setLoadingAction(action);
    setError('');

    try {
      const payload = await fetchCareerGuidance(action);
      setGuidance(payload);
    } catch (err) {
      setError(err.message || 'Unable to load guidance.');
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <section className="page page-section">
      <div className="header-box">
        <h1 className="page-title">Career Guidance</h1>
        <p>Choose a structured guidance option based on your latest recommendation analysis.</p>
      </div>

      <div className="guidance-actions">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={Boolean(loadingAction)}
            onClick={() => runAction(action.key)}
          >
            {loadingAction === action.key ? 'Loading...' : action.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {!cachedResult && (
        <p className="muted card-block">
          No stored skill gap data yet. Visit Job Recommendations and process a resume first.
        </p>
      )}

      {guidance && guidance.title !== 'Skill-Based Course Recommendations' && (
        <div className="card-block">
          <h2>{guidance.title}</h2>
          <ul>
            {(guidance.items || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {guidance && guidance.title === 'Skill-Based Course Recommendations' && (
        <div className="card-block">
          <h2>{guidance.title}</h2>

          <h3>Missing Skills</h3>
          <ul>
            {(guidance.missing_skills || []).map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>

          <h3>Suggested Courses</h3>
          <div className="course-grid">
            {(guidance.recommended_courses || []).map((course) => (
              <CourseCard key={`${course.name}-${course.provider}`} course={course} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default CareerGuidancePage;

