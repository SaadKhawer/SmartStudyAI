/**
 * Sidebar Component
 * Navigation sidebar with user info and theme toggle
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, FileText,
  Settings, LogOut, Sun, Moon, Brain, Bell,
  GraduationCap, Calendar, BarChart3, Trophy,
  Users, Mic } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat',            icon: MessageSquare,   label: 'AI Chat' },
  { to: '/study-planner',  icon: Calendar,        label: 'Study Planner' },
  { to: '/quiz',            icon: Brain,           label: 'Quiz' },
  { to: '/exam',            icon: GraduationCap,   label: 'AI Examiner' },
  { to: '/voice',           icon: Mic,             label: 'Voice Mode' },
  { to: '/weakness',        icon: BarChart3,       label: 'My Progress' },
  { to: '/achievements',    icon: Trophy,          label: 'Achievements' },
  { to: '/groups',          icon: Users,           label: 'Study Groups' },
  { to: '/documents',       icon: FileText,        label: 'Documents' },
  { to: '/reminders',       icon: Bell,            label: 'Reminders' },
  { to: '/settings',        icon: Settings,        label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">📚</div>
        <div className="logo-text">Study<span>AI</span></div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        {/* Theme toggle */}
        <button
          className="nav-item"
          onClick={toggleTheme}
          style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="user-card" onClick={handleLogout} title="Logout">
          <div className="user-avatar">{initials}</div>
          <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div className="user-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <LogOut size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
