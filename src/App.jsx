import { useState } from 'react';
import { AppProvider, useApp } from './contexts/AppContext.jsx';
import { BrandSelector } from './components/BrandSelector.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ChatGPTInterface } from './components/ChatGPTInterface.jsx';
import { ClaudeInterface } from './components/ClaudeInterface.jsx';
import { useIsMobile } from './hooks/useMediaQuery.js';
import './App.css';
function Content() { const { activeBrand } = useApp(); const [drawer, setDrawer] = useState(false); const mobile = useIsMobile(); if (!activeBrand) return <main className="home"><div className="home-mark">AI Hub</div><p>选择一个品牌开始对话</p><BrandSelector /></main>; return <div className={`app-container brand-${activeBrand}`}><Sidebar isOpen={!mobile || drawer} onClose={() => setDrawer(false)} /><main className="brand-main">{activeBrand === 'chatgpt' ? <ChatGPTInterface onMenuClick={() => setDrawer(true)} /> : <ClaudeInterface onMenuClick={() => setDrawer(true)} />}</main></div>; }
export default function App() { return <AppProvider><Content /></AppProvider>; }
