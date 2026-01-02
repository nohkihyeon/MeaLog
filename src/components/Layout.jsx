import React from 'react'

const Layout = ({ children, sidebar }) => {
    return (
        <div className="layout" style={{ display: 'flex', minHeight: '100vh' }}>
            {sidebar}
            <main style={{
                flex: 1,
                marginLeft: '240px', // Match sidebar width
                backgroundColor: 'var(--bg-primary)',
                minHeight: '100vh',
                maxWidth: 'calc(100% - 240px)'
            }}>
                {children}
            </main>
        </div>
    )
}

export default Layout
