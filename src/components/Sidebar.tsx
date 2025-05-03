import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Sidebar.css';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  activeView: 'all' | 'favorites' | 'tags' | 'trash';
  onViewChange: (view: 'all' | 'favorites' | 'tags' | 'trash') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleSidebar, activeView, onViewChange }) => {
  const navigate = useNavigate();
  
  // Updated sidebar items with only relevant icons, removed settings
  const sidebarItems = [
    { id: 'all', label: 'All Clips', icon: 'clipboard' },
    { id: 'tags', label: 'Tags', icon: 'tag' },
    { id: 'favorites', label: 'Favorites', icon: 'star' },
    { id: 'trash', label: 'Trash', icon: 'trash' },
  ];

  // Render icon SVG based on icon name
  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'clipboard':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
        );
      case 'tag':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
        );
      case 'star':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      case 'trash':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        );
      case 'back':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        );
      case 'user':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        );
      case 'search':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        );
      case 'menu':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        );
      default:
        return null;
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Toggle button at top */}
      <div className="toggle-container">
        <button 
          className="sidebar-toggle" 
          onClick={toggleSidebar}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {renderIcon('menu')}
        </button>
      </div>
      
      {/* Search bar */}
      <div className="search-container">
        <div className="search-icon" onClick={toggleSidebar} style={{ cursor: 'pointer' }}>
          {renderIcon('search')}
        </div>
        {!isCollapsed && (
          <div className="search-input-wrapper">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search clips..." 
            />
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="sidebar-nav">
        <ul>
          {sidebarItems.map(item => (
            <li key={item.id} className="sidebar-item">
              <a 
                href="#" 
                className={`sidebar-link ${activeView === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onViewChange(item.id as 'all' | 'favorites' | 'tags' | 'trash');
                }}
              >
                <span className="icon">{renderIcon(item.icon)}</span>
                {!isCollapsed && <span className="label">{item.label}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Profile section - moved to bottom */}
      <div className="profile-section">
        <div className="profile-icon">
          {renderIcon('user')}
        </div>
        {!isCollapsed && <div className="profile-name">Guest</div>}
      </div>
      
      {/* Back button at bottom */}
      <div className="sidebar-footer">
        <a href="#" className="sidebar-link" onClick={handleBack}>
          <span className="icon">{renderIcon('back')}</span>
          {!isCollapsed && <span className="label">Back</span>}
        </a>
      </div>
    </div>
  );
};

export default Sidebar; 