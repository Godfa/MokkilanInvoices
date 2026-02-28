import React, { useEffect, useState } from 'react';
import { Icon } from 'semantic-ui-react';
import { useStore } from '../stores/store';
import { observer } from 'mobx-react-lite';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import LoadingComponent from './LoadingComponent';

function App() {
  const { userStore } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appLoaded, setAppLoaded] = useState(false);

  useEffect(() => {
    if (userStore.user) {
      setAppLoaded(true);
    } else {
      const token = window.localStorage.getItem('jwt');
      if (token) {
        userStore.getUser().finally(() => setAppLoaded(true));
      } else {
        setAppLoaded(true);
      }
    }
  }, [userStore])

  useEffect(() => {
    if (userStore.user?.mustChangePassword && location.pathname !== '/changePassword') {
      navigate('/changePassword');
    }
  }, [userStore.user, location.pathname, navigate])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Determine if we should show the sidebar (not on login/auth pages)
  const authPages = ['/login', '/forgot-password', '/reset-password'];
  const isAuthPage = authPages.some(page => location.pathname.startsWith(page));
  const showSidebar = userStore.isLoggedIn && !isAuthPage;

  if (!appLoaded) return <LoadingComponent content='Ladataan sovellusta...' />

  return (
    <div className="app-layout">
      {showSidebar && (
        <>
          {/* Mobile Header */}
          <div className="mobile-header" style={{ display: 'none' }}>
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Icon name={mobileMenuOpen ? 'close' : 'bars'} />
            </button>
            <span style={{ fontWeight: 600 }}>Mökkilan Invoices</span>
            <div style={{ width: 24 }} />
          </div>

          <Sidebar
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
        </>
      )}

      <main className={`app-main ${showSidebar ? '' : 'no-sidebar'}`}>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default observer(App);
