import React, { useState } from 'react'
import { Menu, BarChart2, CalendarDays } from 'lucide-react'

const Layout = ({ children, sidebar, sidebarOpen, onToggleSidebar, onCloseSidebar, currentView, onChangeView, onTriggerEasterEgg }) => {
    const [clickCount, setClickCount] = useState(0);
    const [lastClickTime, setLastClickTime] = useState(0);

    const handleLogoClick = () => {
        const now = Date.now();
        if (now - lastClickTime > 2000) {
            setClickCount(1);
        } else {
            const next = clickCount + 1;
            if (next >= 5) {
                if (onTriggerEasterEgg) onTriggerEasterEgg();
                setClickCount(0);
            } else {
                setClickCount(next);
            }
        }
        setLastClickTime(now);
    };

    return (
        <div className={`layout${sidebarOpen ? ' sidebar-open' : ''}`} style={{ display: 'flex', minHeight: '100vh' }}>
            <header className="mobile-header">
                <button onClick={onToggleSidebar} aria-label="메뉴 열기" style={{ display: 'flex', padding: '0.5rem' }}>
                    <Menu size={22} />
                </button>
                <span 
                    onClick={handleLogoClick}
                    style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                >
                    🍎 MeaLog
                </span>
            </header>

            <div className="sidebar-backdrop" onClick={onCloseSidebar} />
            {sidebar}

            <main className="app-main">
                {children}
            </main>
        </div>
    )
}

export default Layout
