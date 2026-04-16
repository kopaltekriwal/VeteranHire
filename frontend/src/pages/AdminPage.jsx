import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  getAdminStats,
  getAdminUsers,
  getPendingVerifications,
  getUsers,
  getVerificationQueue,
  updateVerificationByAdmin,
  verifyUser,
} from '../api';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'queue', label: 'Verification Queue' },
];
const STATUS_COLORS = ['#4F8CFF', '#94A3B8', '#DC2626'];

function formatTimestamp(value) {
  if (!value) {
    return 'Not fetched yet';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not fetched yet';
  }
  return parsed.toLocaleString();
}

function AdminPage({ user }) {
  const navigate = useNavigate();
  const [section, setSection] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [apiMode, setApiMode] = useState('new');

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const loadData = async () => {
    if (!isAdmin) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (apiMode === 'new') {
        const [usersPayload, queuePayload] = await Promise.all([
          getUsers(),
          getPendingVerifications(),
        ]);
        setUsers(usersPayload.users || []);
        setQueue(queuePayload.users || []);
        const statsPayload = await getAdminStats(user?.id);
        setStats(statsPayload);
      } else {
        const [usersPayload, queuePayload] = await Promise.all([
          getAdminUsers(user.id),
          getVerificationQueue(user.id),
        ]);
        setUsers(usersPayload.users || []);
        setQueue(queuePayload.queue || []);
        const statsPayload = await getAdminStats(user?.id);
        setStats(statsPayload);
      }
    } catch (err) {
      if (apiMode === 'new') {
        try {
          const [usersPayload, queuePayload] = await Promise.all([
            getAdminUsers(user.id),
            getVerificationQueue(user.id),
          ]);
          setUsers(usersPayload.users || []);
          setQueue(queuePayload.queue || []);
          const statsPayload = await getAdminStats(user?.id);
          setStats(statsPayload);
          setApiMode('legacy');
          return;
        } catch (legacyErr) {
          setError(legacyErr.message || 'Failed to load users.');
        }
      } else {
        setError(err.message || 'Failed to load users.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const summary = useMemo(() => {
    if (stats) {
      return {
        total: Number(stats.totalUsers || 0),
        verified: users.filter((item) => item.verification_status === 'Verified').length,
        pending: users.filter((item) => item.verification_status === 'Pending').length,
        rejected: users.filter((item) => item.verification_status === 'Rejected').length,
        totalJobs: Number(stats.totalJobs || 0),
        totalApplications: Number(stats.totalApplications || 0),
        activeUsers: Number(stats.activeUsers || 0),
      };
    }
    const total = users.length;
    const verified = users.filter((item) => item.verification_status === 'Verified').length;
    const pending = users.filter((item) => item.verification_status === 'Pending').length;
    const rejected = users.filter((item) => item.verification_status === 'Rejected').length;
    return { total, verified, pending, rejected, totalJobs: 0, totalApplications: 0, activeUsers: 0 };
  }, [users, stats]);

  const verificationChartData = useMemo(
    () => [
      { name: 'Verified', value: summary.verified },
      { name: 'Pending', value: summary.pending },
      { name: 'Rejected', value: summary.rejected },
    ],
    [summary]
  );

  const jobsChartData = useMemo(() => {
    if (stats?.topCategories?.length) {
      return stats.topCategories.map((row) => ({
        name: String(row.name || '').toUpperCase(),
        jobs: Number(row.count || 0),
      }));
    }
    return users
      .slice()
      .sort((a, b) => Number(b.jobs_matched || 0) - Number(a.jobs_matched || 0))
      .slice(0, 6)
      .map((item) => ({
        name: String(item.name || 'User').split(' ')[0],
        jobs: Number(item.jobs_matched || 0),
      }));
  }, [users, stats]);

  const userActivityData = useMemo(
    () => (Array.isArray(stats?.userActivity) ? stats.userActivity : []),
    [stats]
  );

  const runAction = async (targetUserId, status) => {
    setMessage('');
    setError('');
    try {
      if (apiMode === 'new') {
        await verifyUser(targetUserId, status);
      } else {
        await updateVerificationByAdmin(user.id, targetUserId, status);
      }
      setMessage(`User ${targetUserId} marked as ${status}.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Action failed.');
    }
  };

  if (!isAdmin) {
    return (
      <section className="page page-section">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="muted">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="page page-section">
      <h1 className="page-title">Admin Dashboard</h1>

      <div className="admin-layout">
        <aside className="card-block admin-sidebar">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={section === item.key ? 'admin-nav-btn active' : 'admin-nav-btn'}
              onClick={() => setSection(item.key)}
              data-tooltip={item.label}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <div className="admin-main">
          {loading ? <p className="muted">Loading...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}

          {section === 'dashboard' && (
            <>
              <div className="admin-kpis">
                <article className="card-block admin-kpi card">
                  <h3>Total Users</h3>
                  <p>{summary.total}</p>
                </article>
                <article className="card-block admin-kpi card">
                  <h3>Verified</h3>
                  <p>{summary.verified}</p>
                </article>
                <article className="card-block admin-kpi card">
                  <h3>Total Jobs</h3>
                  <p>{summary.totalJobs}</p>
                </article>
                <article className="card-block admin-kpi card">
                  <h3>Applications</h3>
                  <p>{summary.totalApplications}</p>
                </article>
                <article className="card-block admin-kpi card">
                  <h3>Active Users</h3>
                  <p>{summary.activeUsers}</p>
                </article>
              </div>

              <article className="card-block admin-freshness card">
                <div className="admin-freshness-header">
                  <h3>Jobs Data Freshness</h3>
                  <span className="status-badge verified">Live Snapshot</span>
                </div>
                <div className="admin-freshness-grid">
                  <div className="freshness-item">
                    <span className="muted">Last Fetch</span>
                    <strong>{formatTimestamp(stats?.jobsLastFetchedAt)}</strong>
                  </div>
                  <div className="freshness-item">
                    <span className="muted">Deduped Jobs In DB</span>
                    <strong>{Number(stats?.jobsDedupedCount || 0)}</strong>
                  </div>
                  <div className="freshness-item">
                    <span className="muted">Last Fetch Added</span>
                    <strong>{Number(stats?.lastFetchAddedJobs || 0)}</strong>
                  </div>
                  <div className="freshness-item">
                    <span className="muted">Last Fetch Raw</span>
                    <strong>{Number(stats?.lastFetchRawJobs || 0)}</strong>
                  </div>
                </div>
              </article>

              <div className="analytics-grid admin-dashboard-charts">
                <article className="card-block chart-card">
                  <h3>Verification Split</h3>
                  <div className="chart-shell">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={verificationChartData} dataKey="value" outerRadius={95} innerRadius={56}>
                          {verificationChartData.map((entry, index) => (
                            <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="card-block chart-card">
                  <h3>Jobs by Category</h3>
                  <div className="chart-shell">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={jobsChartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="jobs" fill="#4F8CFF" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                <article className="card-block chart-card">
                  <h3>User Activity (7 days)</h3>
                  <div className="chart-shell">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={userActivityData}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#4F8CFF" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>
            </>
          )}

          {section === 'users' && (
            <div className="card-block admin-table-wrap">
              <h2>Users</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Aadhaar</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className="table-row">
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.aadhaar_masked || item.aadhaar_number || 'Not provided'}</td>
                      <td><span className={`status-badge ${String(item.verification_status || '').toLowerCase()}`}>{item.verification_status}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" className="approve-btn" onClick={() => runAction(item.id, 'Verified')} data-tooltip="Approve user verification">Approve</button>
                          <button type="button" className="reject-btn" onClick={() => runAction(item.id, 'Rejected')} data-tooltip="Reject user verification">Reject</button>
                          <button type="button" className="military-btn" onClick={() => navigate(`/admin/user/${item.id}`)} data-tooltip="Open user analytics">View Analytics</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === 'queue' && (
            <div className="card-block admin-table-wrap">
              <h2>Verification Queue</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Aadhaar</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id} className="table-row">
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.aadhaar_masked || item.aadhaar_number || 'Not provided'}</td>
                      <td><span className={`status-badge ${String(item.verification_status || '').toLowerCase()}`}>{item.verification_status}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" className="approve-btn" onClick={() => runAction(item.id, 'Verified')} data-tooltip="Approve user verification">Approve</button>
                          <button type="button" className="reject-btn" onClick={() => runAction(item.id, 'Rejected')} data-tooltip="Reject user verification">Reject</button>
                          <button type="button" className="military-btn" onClick={() => navigate(`/admin/user/${item.id}`)} data-tooltip="Open user analytics">View Analytics</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminPage;
