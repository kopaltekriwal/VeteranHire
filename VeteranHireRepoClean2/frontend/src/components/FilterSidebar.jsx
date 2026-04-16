function FilterSidebar({ filters, onFilterChange, onApply, onReset }) {
  return (
    <aside className="filter-sidebar card-block">
      <h3>Mission Filters</h3>

      <label htmlFor="location-filter">Location</label>
      <select
        id="location-filter"
        value={filters.location}
        onChange={(event) => onFilterChange('location', event.target.value)}
      >
        <option value="">All Locations</option>
        <option value="Delhi">Delhi</option>
        <option value="Mumbai">Mumbai</option>
        <option value="Bangalore">Bangalore</option>
        <option value="Chennai">Chennai</option>
        <option value="Pune">Pune</option>
      </select>

      <label htmlFor="salary-filter">Salary Range</label>
      <select
        id="salary-filter"
        value={filters.salaryRange}
        onChange={(event) => onFilterChange('salaryRange', event.target.value)}
      >
        <option value="">Any Salary</option>
        <option value="0-5L">0-5L</option>
        <option value="5-10L">5-10L</option>
        <option value="10-20L">10-20L</option>
        <option value="20+L">20+L</option>
      </select>

      <label htmlFor="job-type-filter">Job Type</label>
      <select
        id="job-type-filter"
        value={filters.jobType}
        onChange={(event) => onFilterChange('jobType', event.target.value)}
      >
        <option value="">All Types</option>
        <option value="govt">Government</option>
        <option value="private">Private</option>
      </select>

      <label htmlFor="exp-filter">Experience Level</label>
      <select
        id="exp-filter"
        value={filters.experienceLevel}
        onChange={(event) => onFilterChange('experienceLevel', event.target.value)}
      >
        <option value="">Any Experience</option>
        <option value="0-2">0-2 years</option>
        <option value="2-5">2-5 years</option>
        <option value="5-10">5-10 years</option>
        <option value="10+">10+ years</option>
      </select>

      <div className="filter-actions">
        <button type="button" className="military-btn" onClick={onApply}>
          Apply Filters
        </button>
        <button type="button" className="military-btn ghost" onClick={onReset}>
          Reset Filters
        </button>
      </div>
    </aside>
  );
}

export default FilterSidebar;
