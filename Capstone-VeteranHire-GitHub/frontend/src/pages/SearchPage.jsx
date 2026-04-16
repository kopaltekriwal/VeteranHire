import { useEffect, useMemo, useRef, useState } from 'react';

import { searchJobs } from '../api';
import FiltersSidebar from '../components/FiltersSidebar';
import JobCards from '../components/JobCards';

const EMPTY_FILTERS = {
  location: 'All',
  salaryRange: 'All',
  jobType: 'All',
  experienceLevel: 'All',
};

function normalizeFiltersForApi(filters) {
  return {
    location: filters.location === 'All' ? '' : filters.location,
    salaryRange: filters.salaryRange === 'All' ? '' : filters.salaryRange,
    jobType: filters.jobType === 'All' ? '' : filters.jobType,
    experienceLevel: filters.experienceLevel === 'All' ? '' : filters.experienceLevel,
  };
}

function SearchPage({ mode }) {
  const jobsPerPage = 20;
  const pageTopRef = useRef(null);
  const [query, setQuery] = useState(mode === 'all' ? '' : '');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError('');
      try {
        const payload = await searchJobs(mode === 'all' ? '' : query.trim(), normalizeFiltersForApi(appliedFilters));
        if (!cancelled) {
          setJobs(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load jobs.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [jobs, mode]);

  const resultCountText = useMemo(() => `${jobs.length} jobs found`, [jobs.length]);
  const totalJobs = jobs.length;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(jobs.length / jobsPerPage)), [jobs.length]);
  const currentJobs = useMemo(
    () => jobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage),
    [jobs, currentPage, jobsPerPage]
  );
  const start = totalJobs === 0 ? 0 : (currentPage - 1) * jobsPerPage + 1;
  const end = totalJobs === 0 ? 0 : Math.min(currentPage * jobsPerPage, totalJobs);

  useEffect(() => {
    if (!jobs.length) {
      return;
    }
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPage, jobs.length]);

  const performSearch = async (nextFilters = appliedFilters, nextQuery = query) => {
    setLoading(true);
    setError('');

    try {
      const payload = await searchJobs(nextQuery.trim(), normalizeFiltersForApi(nextFilters));
      setJobs(payload);
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await performSearch(appliedFilters, query);
  };

  const applyFilters = async () => {
    setAppliedFilters(draftFilters);
    await performSearch(draftFilters, query);
  };

  const resetFilters = async () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    await performSearch(EMPTY_FILTERS, query);
  };

  const goToPage = (pageNumber) => {
    if (pageNumber === currentPage || pageNumber < 1 || pageNumber > totalPages) {
      return;
    }
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  return (
    <section className="page page-section" ref={pageTopRef}>
      <div className="header-box hero-search-wrap hero-card">
        <h1 className="page-title">Find Your Next Mission</h1>
        <p>Search by role, skills, category, and mission-ready filters.</p>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs (govt or private)..."
            aria-label="Search jobs"
          />
          <button type="submit" className="military-btn">Search</button>
        </form>
      </div>

      <div className="search-layout">
        <FiltersSidebar
          filters={draftFilters}
          setFilters={setDraftFilters}
          applyFilters={applyFilters}
          onReset={resetFilters}
        />

        <div className="results-panel">
          <div className="results-header card-block">
            <strong>{resultCountText}</strong>
            {loading && <span>Loading...</span>}
          </div>
          {!loading && totalJobs > 0 && (
            <div className="job-range">
              Showing {start}{'\u2013'}{end} of {totalJobs} jobs
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <JobCards key={`page-${currentPage}`} jobs={currentJobs} />

          {!loading && jobs.length > 0 && (
            <>
              <p className="muted page-indicator">
                Page {currentPage} of {totalPages}
              </p>
              <div className="pagination">
                {currentPage > 1 ? (
                  <button type="button" onClick={() => goToPage(currentPage - 1)}>
                    Prev
                  </button>
                ) : null}

                {visiblePageNumbers.map((pageNumber) => {
                  const isActive = currentPage === pageNumber;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => goToPage(pageNumber)}
                      className={isActive ? 'active' : ''}
                      disabled={isActive}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                {currentPage < totalPages ? (
                  <button type="button" onClick={() => goToPage(currentPage + 1)}>
                    Next
                  </button>
                ) : null}

                <select
                  value={currentPage}
                  onChange={(event) => goToPage(Number(event.target.value))}
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
    </section>
  );
}

export default SearchPage;

