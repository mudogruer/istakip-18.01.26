import { useState } from 'react';

const Topbar = ({ title }) => {
  const [query, setQuery] = useState('');

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <div className="topbar-search">
          <span className="topbar-search-icon">🔍</span>
          <input
            type="search"
            placeholder="Ara..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Uygulama içi arama"
          />
        </div>
        <button className="topbar-user" type="button">
          <div className="topbar-user-avatar">BA</div>
          <div className="topbar-user-info">
            <div className="topbar-user-name">Batuhan</div>
            <div className="topbar-user-role">Yönetici</div>
          </div>
        </button>
      </div>
    </header>
  );
};

export default Topbar;

