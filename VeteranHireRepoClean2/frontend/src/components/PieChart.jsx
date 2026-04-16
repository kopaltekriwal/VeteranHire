import { useMemo } from 'react';

function PieChart({ matchedSkills = [], missingSkills = [] }) {
  const data = useMemo(() => {
    const matched = matchedSkills.length;
    const missing = missingSkills.length;
    const total = matched + missing;

    if (total === 0 || missing === 0) {
      return {
        hasGap: false,
        matchedPercent: 100,
        missingPercent: 0,
      };
    }

    const matchedPercent = Math.round((matched / total) * 100);
    return {
      hasGap: true,
      matchedPercent,
      missingPercent: 100 - matchedPercent,
    };
  }, [matchedSkills, missingSkills]);

  if (!data.hasGap) {
    return <p className="muted">No skill gap detected</p>;
  }

  return (
    <div className="pie-chart-wrap">
      <div
        className="pie-chart"
        style={{
          background: `conic-gradient(var(--accent) 0% ${data.matchedPercent}%, var(--border) ${data.matchedPercent}% 100%)`,
        }}
      >
        <span className="pie-label matched">{data.matchedPercent}% Matched</span>
        <span className="pie-label missing">{data.missingPercent}% Missing</span>
      </div>
    </div>
  );
}

export default PieChart;
