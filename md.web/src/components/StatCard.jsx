const StatCard = ({ icon, label, value, change, tone = 'primary', trend = 'neutral' }) => {
  const changeClass = trend === 'negative' ? 'stat-change negative' : 'stat-change positive';

  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {change ? <div className={changeClass}>{change}</div> : null}
      </div>
    </div>
  );
};

export default StatCard;

