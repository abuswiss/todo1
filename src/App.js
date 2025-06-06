import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Header } from './components/layout/Header';
import { Content } from './components/layout/Content';
import { ProjectsProvider, SelectedProjectProvider } from './context';
import { AuthProvider, useAuth } from './context/auth-context';
import { NotificationProvider } from './context/notification-context';
import { Auth } from './components/Auth';
import { NotificationContainer } from './components/NotificationContainer';
import PerplexityChat from './components/PerplexityChat';

const AppContent = ({ darkMode, setDarkMode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <NotificationProvider>
      <SelectedProjectProvider>
        <ProjectsProvider>
          <main
            data-testid="application"
            className={darkMode ? 'darkmode' : undefined}
          >
            <Header darkMode={darkMode} setDarkMode={setDarkMode} />
            <Content />
            <PerplexityChat />
            <NotificationContainer />
          </main>
        </ProjectsProvider>
      </SelectedProjectProvider>
    </NotificationProvider>
  );
};

export const App = ({ darkModeDefault = false }) => {
  const [darkMode, setDarkMode] = useState(darkModeDefault);

  return (
    <AuthProvider>
      <AppContent darkMode={darkMode} setDarkMode={setDarkMode} />
    </AuthProvider>
  );
};

App.propTypes = {
  darkModeDefault: PropTypes.bool,
};
