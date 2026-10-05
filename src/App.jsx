import { useState } from 'react';
import { AppProvider, useApp } from './contexts/AppContext.jsx';
import { BrandSelector } from './components/BrandSelector.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ChatInterface } from './components/ChatInterface.jsx';
import { useIsMobile } from './hooks/useMediaQuery.js';
import './App.css';

function AppContent() {
  const { activeBrand } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Show brand selector only when no brand is active
  if (!activeBrand) {
    return (
      <div className="app-container">
        <div className="default-bot-layout">
          <div className="default-bot-header">
            <h1>AI Hub</h1>
            <p>Your unified AI assistant</p>
          </div>
          <ChatInterface onMenuClick={() => setSidebarOpen(true)} />
          <div className="brand-selector-footer">
            <div className="divider">
              <span>Switch to a specific AI</span>
            </div>
            <BrandSelector />
          </div>
        </div>
      </div>
    );
  }

  // Show chat interface with sidebar when brand is active
  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen || !isMobile} onClose={() => setSidebarOpen(false)} />
      <ChatInterface onMenuClick={() => setSidebarOpen(true)} />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
