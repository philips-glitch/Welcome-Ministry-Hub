import { NAV } from '../data.js';

export default function Sidebar({ active, onNavigate, badges }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div className="col">
          <span className="brand-name">Flourish Hub</span>
          <span className="brand-sub">Admin · WM 2026</span>
        </div>
      </div>
      {NAV.map((label, i) => (
        <button key={label} className={'nav-item' + (i === active ? ' active' : '')} onClick={() => onNavigate(i)}>
          <span>{label}</span>
          <span className="nav-badge">{badges[i] || ''}</span>
        </button>
      ))}
      <div className="whoami">
        Masuk sebagai <b>Angel</b>
        <br />
        Super Admin · Tim Acara
      </div>
    </aside>
  );
}
