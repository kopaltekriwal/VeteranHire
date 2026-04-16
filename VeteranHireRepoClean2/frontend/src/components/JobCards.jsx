function JobCards({ jobs }) {
  if (!jobs?.length) {
    return <p className="muted">No jobs found for the current query and filters.</p>;
  }

  return (
    <div className="job-grid">
      {jobs.map((job, index) => {
        const jobType = String(job.type || 'private').toLowerCase() === 'govt' ? 'govt' : 'private';
        const company = job.company || 'Unknown Company';
        const companyInitial = company.trim().charAt(0).toUpperCase() || 'V';

        return (
          <article key={`${job.title}-${job.link}-${index}`} className="job-card card" data-tooltip="Open role details">
            <div className="card-top-row">
              <div className="company-row">
                <div className="company-logo-placeholder" aria-hidden="true">
                  {companyInitial}
                </div>
                <div className="card-content">
                  <h3>{job.title}</h3>
                  <p className="muted">{company}</p>
                </div>
              </div>
              <span className={`pill badge ${jobType === 'govt' ? 'pill-govt' : 'pill-private'}`}>
                {jobType === 'govt' ? 'Govt' : 'Private'}
              </span>
            </div>

            <div className="card-content">
              <p className="card-description">{job.description}</p>
            </div>

            <div className="meta-grid">
              <span className="job-location"><strong>{'\uD83D\uDCCD'} Location:</strong> {job.location || 'Not specified'}</span>
              <span className="salary-badge"><strong>Salary:</strong> {job.salary_range || 'Not specified'}</span>
              <span><strong>Experience:</strong> {job.experience_level || 'Not specified'}</span>
            </div>

            <div className="skills-row">
              {(job.skills || []).slice(0, 6).map((skill) => (
                <span key={`${job.title}-${skill}`} className="skill-chip">
                  {skill}
                </span>
              ))}
            </div>

            <a href={job.link} target="_blank" rel="noreferrer" className="military-btn btn-primary apply-btn" data-tooltip="Apply on company portal">
              Apply Now
            </a>
          </article>
        );
      })}
    </div>
  );
}

export default JobCards;
