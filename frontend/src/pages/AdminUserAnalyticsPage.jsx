import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';

import { getAdminUserAnalytics } from '../api';

const PIE_COLORS = ['#4F8CFF', '#94A3B8'];

function AdminUserAnalyticsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const payload = await getAdminUserAnalytics(id);
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load analytics.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const barData = useMemo(() => {
    const scores = data?.skill_scores || {};
    return Object.entries(scores).map(([name, value]) => ({ name, value }));
  }, [data]);

  const pieData = useMemo(() => {
    const score = Number(data?.match_score || 0);
    return [
      { name: 'Matched', value: score },
      { name: 'Missing', value: Math.max(0, 100 - score) },
    ];
  }, [data]);

  return (
    <section className="page page-section">
      <h1 className="page-title">User Analytics</h1>
      <div className="admin-analytics-header card-block">
        <button type="button" className="military-btn ghost" onClick={() => navigate('/admin')}>
          Back to Admin
        </button>

        {loading ? <p className="muted">Loading analytics...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {data ? (
          <>
            <h2>{data.name}</h2>
            <p>{data.email}</p>
            <p>
              Verification: <span className={`status-badge ${String(data.verification_status || '').toLowerCase()}`}>{data.verification_status}</span>
            </p>
          </>
        ) : null}
      </div>

      {data ? (
        <>
          <div className="admin-kpis analytics-kpis">
            <article className="card-block admin-kpi card">
              <h3>Jobs Matched</h3>
              <p>{data.jobs_matched || 0}</p>
            </article>
            <article className="card-block admin-kpi card">
              <h3>Skill Gaps</h3>
              <p>{(data.skill_gap || []).length}</p>
            </article>
            <article className="card-block admin-kpi card">
              <h3>Recommended Courses</h3>
              <p>{(data.recommended_courses || []).length}</p>
            </article>
          </div>

          <div className="analytics-grid">
            <article className="card-block chart-card">
              <h3>Skill Scores</h3>
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4F8CFF" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card-block chart-card">
              <h3>Match Score</h3>
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" outerRadius={95} innerRadius={55}>
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="analytics-lists">
            <article className="card-block">
              <h3>Skill Gap</h3>
              <ul>
                {(data.skill_gap || []).map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </article>
            <article className="card-block">
              <h3>Recommended Courses</h3>
              <ul>
                {(data.recommended_courses || []).map((course) => (
                  <li key={course}>{course}</li>
                ))}
              </ul>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default AdminUserAnalyticsPage;
