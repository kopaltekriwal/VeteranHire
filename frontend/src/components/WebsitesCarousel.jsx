const websiteRows = [
  [
    { label: 'NCS India', link: 'https://www.ncs.gov.in/', accent: '#1E40AF' },
    { label: 'Employment News', link: 'https://employmentnews.gov.in/', accent: '#50B8FF' },
    { label: 'Naukri', link: 'https://www.naukri.com/', accent: '#0F2A47' },
    { label: 'LinkedIn Jobs', link: 'https://www.linkedin.com/jobs/', accent: '#1E40AF' },
    { label: 'Foundit', link: 'https://www.foundit.in/', accent: '#50B8FF' },
  ],
  [
    { label: 'Indeed', link: 'https://in.indeed.com/', accent: '#0F2A47' },
    { label: 'Freshersworld', link: 'https://www.freshersworld.com/', accent: '#1E40AF' },
    { label: 'Shine', link: 'https://www.shine.com/', accent: '#50B8FF' },
    { label: 'WorkIndia', link: 'https://www.workindia.in/', accent: '#0F2A47' },
    { label: 'Glassdoor', link: 'https://www.glassdoor.co.in/Job/index.htm', accent: '#1E40AF' },
  ],
];

function faviconFor(link) {
  try {
    const host = new URL(link).hostname;
    return `https://www.google.com/s2/favicons?sz=128&domain=${host}`;
  } catch {
    return '/shield.png';
  }
}

function WebsitesCarousel() {
  return (
    <div className="websites-carousel card-block">
      <div className="websites-fade websites-fade-left" />
      <div className="websites-fade websites-fade-right" />

      {websiteRows.map((row, rowIndex) => {
        const loopItems = [...row, ...row];
        const reverse = rowIndex % 2 === 1;
        return (
          <div key={`row-${rowIndex}`} className="websites-row">
            <div className={`websites-track ${reverse ? 'reverse' : ''}`}>
              {loopItems.map((site, index) => (
                <a
                  key={`${site.link}-${index}`}
                  href={site.link}
                  target="_blank"
                  rel="noreferrer"
                  className="website-card"
                  title={site.label}
                  style={{ '--brand-accent': site.accent || '#1E40AF' }}
                >
                  <img src={faviconFor(site.link)} alt={`${site.label} logo`} className="website-logo" loading="lazy" />
                  <span>{site.label}</span>
                  <span className="website-tag">Trusted</span>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WebsitesCarousel;
