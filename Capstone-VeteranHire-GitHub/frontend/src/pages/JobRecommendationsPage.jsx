import { useEffect, useMemo, useRef, useState } from 'react';

import { recommendJobs } from '../api';
import FiltersSidebar from '../components/FiltersSidebar';
import JobCards from '../components/JobCards';
import PieChart from '../components/PieChart';

const DEFAULT_FILTERS = {
  location: 'All',
  salaryRange: 'All',
  jobType: 'All',
  experienceLevel: 'All',
};

const JOBS_PER_PAGE = 20;

function parseSalaryRangeLabel(label) {
  const value = String(label || '').toLowerCase();
  if (!value || value === 'all') {
    return { min: null, max: null };
  }
  if (value === '0-5l') {
    return { min: 0, max: 5 };
  }
  if (value === '5-10l') {
    return { min: 5, max: 10 };
  }
  if (value === '10-20l') {
    return { min: 10, max: 20 };
  }
  if (value === '20+l') {
    return { min: 20, max: null };
  }
  return { min: null, max: null };
}

function deriveSalaryBounds(job) {
  const minRaw = Number(job?.salary_min);
  const maxRaw = Number(job?.salary_max);

  if (Number.isFinite(minRaw) || Number.isFinite(maxRaw)) {
    return {
      min: Number.isFinite(minRaw) ? minRaw : null,
      max: Number.isFinite(maxRaw) ? maxRaw : null,
    };
  }

  const label = String(job?.salary_range || '').toLowerCase();
  const hits = label.match(/\d+(?:\.\d+)?/g) || [];
  if (!hits.length) {
    return { min: null, max: null };
  }

  const nums = hits.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (!nums.length) {
    return { min: null, max: null };
  }

  if (nums.length === 1) {
    if (label.includes('up to')) {
      return { min: null, max: nums[0] };
    }
    return { min: nums[0], max: null };
  }

  return { min: nums[0], max: nums[1] };
}

function matchesSalaryRange(job, salaryRange) {
  if (salaryRange === 'All') {
    return true;
  }

  const target = parseSalaryRangeLabel(salaryRange);
  const bounds = deriveSalaryBounds(job);

  if (bounds.min === null && bounds.max === null) {
    return false;
  }

  if (target.min !== null && bounds.max !== null && bounds.max < target.min) {
    return false;
  }
  if (target.max !== null && bounds.min !== null && bounds.min > target.max) {
    return false;
  }

  return true;
}

function JobRecommendationsPage({ user, onResumeStatusChange, onAnalysisUpdate }) {
  const pageTopRef = useRef(null);
  const [resumeMode, setResumeMode] = useState('profile');
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const recommendedJobs = useMemo(() => result?.recommended_jobs || result?.jobs || [], [result]);
  const hasProfileResume = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('vh_resume_status') || '{}');
      return Boolean(stored?.hasResume);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!hasProfileResume) {
      setResumeMode('upload');
    }
  }, [hasProfileResume]);

  const runAnalysis = async (fileToSend) => {
    const payload = await recommendJobs(fileToSend, user?.id);
    setResult(payload);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSearchTerm('');
    setCurrentPage(1);
    localStorage.setItem('vh_last_recommendation', JSON.stringify(payload));
    onResumeStatusChange?.({
      hasResume: true,
      lastUpdatedAt: new Date().toISOString(),
    });
    onAnalysisUpdate?.({
      skills: payload.resume_data?.skills || [],
      skill_gap: payload.skill_gap || { missing_skills: [], recommended_courses: [] },
      courses: payload.courses || payload.skill_gap?.recommended_courses || [],
    });
  };

  const submitResume = async (event) => {
    event.preventDefault();

    if (resumeMode === 'upload' && !resumeFile) {
      setError('Please upload a PDF or DOCX resume for Option 2.');
      return;
    }

    if (resumeMode === 'profile') {
      const saved = localStorage.getItem('vh_last_recommendation');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setResult(parsed);
          setError('');
          return;
        } catch {
          // fall through to upload requirement
        }
      }
      setError('No stored profile resume analysis found. Please use Option 2 once.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await runAnalysis(resumeFile);
    } catch (err) {
      setError(err.message || 'Failed to generate recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    if (page === currentPage || page < 1 || page > totalPages) {
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    let updated = recommendedJobs;

    if (appliedFilters.location !== 'All') {
      updated = updated.filter((job) =>
        String(job.location || '')
          .toLowerCase()
          .includes(appliedFilters.location.toLowerCase())
      );
    }

    if (appliedFilters.jobType !== 'All') {
      updated = updated.filter((job) => String(job.type || '').toLowerCase() === appliedFilters.jobType);
    }

    if (appliedFilters.experienceLevel !== 'All') {
      updated = updated.filter((job) => String(job.experience_level || '').includes(appliedFilters.experienceLevel));
    }

    if (appliedFilters.salaryRange !== 'All') {
      updated = updated.filter((job) => matchesSalaryRange(job, appliedFilters.salaryRange));
    }

    setFilteredJobs(updated);
  }, [appliedFilters, recommendedJobs]);

  const searchedJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return filteredJobs;
    }
    return filteredJobs.filter((job) => String(job.title || '').toLowerCase().includes(term));
  }, [filteredJobs, searchTerm]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(searchedJobs.length / JOBS_PER_PAGE)), [searchedJobs.length]);
  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 1) {
      return [1];
    }
    if (currentPage <= 2) {
      return Array.from({ length: Math.min(4, totalPages) }, (_, index) => index + 1);
    }
    if (currentPage >= totalPages - 1) {
      const start = Math.max(1, totalPages - 2);
      return Array.from({ length: totalPages - start + 1 }, (_, index) => start + index);
    }
    return [currentPage - 1, currentPage, currentPage + 1];
  }, [currentPage, totalPages]);

  const currentJobs = useMemo(
    () => searchedJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE),
    [searchedJobs, currentPage]
  );
  const totalJobs = searchedJobs.length;
  const start = totalJobs === 0 ? 0 : (currentPage - 1) * JOBS_PER_PAGE + 1;
  const end = totalJobs === 0 ? 0 : Math.min(currentPage * JOBS_PER_PAGE, totalJobs);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, appliedFilters, result]);

  useEffect(() => {
    if (!searchedJobs.length) {
      return;
    }
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage, searchedJobs.length]);

  return (
    <section className="page page-section" ref={pageTopRef}>
      <div className="header-box hero-search-wrap hero-card">
        <h1 className="page-title">Job Recommendations</h1>
        <p>Upload your resume to get skill-based match analysis and top roles.</p>
      </div>

      <form className="resume-form card-block" onSubmit={submitResume}>
        <div className="resume-mode-tabs" role="tablist" aria-label="Resume source options">
          <button
            type="button"
            className={resumeMode === 'profile' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setResumeMode('profile')}
            disabled={!hasProfileResume}
          >
            Use Profile Resume
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
          <p className="muted">
            Option 1: {hasProfileResume ? 'Use uploaded profile resume' : 'No profile resume found yet.'}
          </p>
        ) : (
          <>
            <p className="muted">Option 2: Upload new resume</p>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
          </>
        )}

        <button type="submit" className="military-btn" disabled={loading}>
          {loading ? 'Processing...' : resumeMode === 'profile' ? 'Use Profile Resume' : 'Analyze New Resume'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <>
          <div className="insight-layout">
            <div className="insight-left card-block">
              <h2>Profile Match</h2>
              <p>
                <strong>Top Job Match %:</strong> {Math.min(99, result.match_score || 0)}
              </p>

              <div className="list-block">
                <h3>Matched Skills</h3>
                <ul>
                  {(result.matched_skills || []).map((skill) => (
                    <li key={`matched-${skill}`}>{skill}</li>
                  ))}
                </ul>
              </div>

              <div className="list-block">
                <h3>Missing Skills</h3>
                <ul>
                  {(result.missing_skills || []).map((skill) => (
                    <li key={`missing-${skill}`}>{skill}</li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="insight-right card-block">
              <h3>Skill Coverage</h3>
              <PieChart matchedSkills={result.matched_skills || []} missingSkills={result.missing_skills || []} />
            </aside>
          </div>

          <h2>Recommended Jobs</h2>

          <div className="search-layout">
            <FiltersSidebar filters={filters} setFilters={setFilters} applyFilters={applyFilters} onReset={resetFilters} />

            <div className="results-panel">
              <div className="results-header card-block">
                <strong>{searchedJobs.length} jobs found</strong>
                <input
                  type="text"
                  className="recommendation-search"
                  placeholder="Search within recommended jobs..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              {totalJobs > 0 && (
                <div className="job-range">
                  Showing {start}{'\u2013'}{end} of {totalJobs} jobs
                </div>
              )}

              <JobCards key={`rec-page-${currentPage}`} jobs={currentJobs} />

              {searchedJobs.length > 0 && (
                <>
                  <p className="muted page-indicator">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="pagination">
                    {currentPage > 1 ? (
                      <button type="button" onClick={() => handlePageChange(currentPage - 1)}>
                        Prev
                      </button>
                    ) : null}

                    {visiblePageNumbers.map((pageNumber) => {
                      const isActive = currentPage === pageNumber;
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => handlePageChange(pageNumber)}
                          className={isActive ? 'active' : ''}
                          disabled={isActive}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}

                    {currentPage < totalPages ? (
                      <button type="button" onClick={() => handlePageChange(currentPage + 1)}>
                        Next
                      </button>
                    ) : null}

                    <select
                      value={currentPage}
                      onChange={(event) => handlePageChange(Number(event.target.value))}
                      aria-label="Jump to page"
                    >
                      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default JobRecommendationsPage;

