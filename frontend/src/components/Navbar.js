import React from 'react';
import { NavLink, Link } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',      icon: '◈' },
  { to: '/documents',    label: 'Documents',      icon: '⬡' },
  { to: '/facts',        label: 'Facts',          icon: '◆' },
  { to: '/relationships',label: 'Relationships',  icon: '⬡' },
  { to: '/demo',         label: 'Demo Cases',     icon: '◉' },
];

export default function Navbar() {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <Link to="/" className="navbar-brand">
        <div className="navbar-brand-icon">FL</div>
        <span>FactLoom</span>
      </Link>

      <div className="navbar-nav">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span style={{ fontSize: '0.85rem' }}>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <div className="navbar-right">
        <div className="status-dot" title="API connected" />
        <span className="text-xs text-muted">v1.0</span>
      </div>
    </nav>
  );
}
