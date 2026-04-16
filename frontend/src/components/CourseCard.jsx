function getProviderBadge(provider) {
  const key = String(provider || '').toLowerCase();
  if (key.includes('coursera')) return 'C';
  if (key.includes('udemy')) return 'U';
  return 'L';
}

function buildGoogleSearchLink(queryValue) {
  const encoded = encodeURIComponent(String(queryValue || '').trim());
  return `https://www.google.com/search?q=${encoded}`;
}

function getBannerTheme(provider, level) {
  const providerKey = String(provider || '').toLowerCase();
  if (providerKey.includes('coursera')) {
    return 'blue';
  }
  if (String(level || '').toLowerCase().includes('intermediate')) {
    return 'dark';
  }
  return 'light';
}

function CourseCard({ course }) {
  const courseName = course?.name || 'Recommended Course';
  const provider = String(course?.provider || 'Coursera').toLowerCase().includes('coursera') ? 'Coursera' : 'Udemy';
  const query = course?.skill || courseName;
  const safeLink = course?.link || buildGoogleSearchLink(`${query} course`);
  const rating = course?.rating || 'N/A';
  const duration = course?.duration || '4-6 weeks';
  const level = course?.level || 'Beginner';
  const shortDescription = course?.description || `Build practical ${query} capability with structured lessons and guided exercises.`;
  const providerBadge = getProviderBadge(provider);
  const providerLogo = provider === 'Coursera' ? 'C' : 'U';
  const bannerTheme = getBannerTheme(provider, level);

  return (
    <article className="course-card">
      <div className={`course-banner ${bannerTheme}`}>
        <span className="course-banner-text">{courseName}</span>
      </div>

      <div className="course-card-content">
        <h4>{courseName}</h4>

        <div className="course-provider-row">
          <span className="provider-logo">{providerLogo}</span>
          <span>{provider}</span>
          <span className="provider-badge">{providerBadge}</span>
        </div>

        <div className="course-meta">
          <span><strong>Rating:</strong> {rating}</span>
          <span><strong>Duration:</strong> {duration}</span>
          <span><strong>Level:</strong> {level}</span>
        </div>

        <p className="course-description">{shortDescription}</p>
      </div>

      <a href={safeLink} target="_blank" rel="noreferrer" className="military-btn btn-primary">
        View Course
      </a>
    </article>
  );
}

export default CourseCard;
