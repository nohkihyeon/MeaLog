import React from 'react'
import { Menu } from 'lucide-react'

const Layout = ({ children, sidebar, sidebarOpen, onToggleSidebar, onCloseSidebar }) => {
    return (
        <div className={`layout${sidebarOpen ? ' sidebar-open' : ''}`} style={{ display: 'flex', minHeight: '100vh' }}>
            {/* 모바일 전용 상단 바 (데스크톱에서는 CSS로 숨김) */}
            <header className="mobile-header">
                <button onClick={onToggleSidebar} aria-label="메뉴 열기" style={{ display: 'flex', padding: '0.5rem' }}>
                    <Menu size={22} />
                </button>
                <span style={{ fontWeight: 600 }}>🍎 MeaLog</span>
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
