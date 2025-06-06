import React, { useState } from 'react';
import { FiSun, FiMoon, FiCheckSquare, FiLogOut } from 'react-icons/fi';
import PropTypes from 'prop-types';
import { AddTask } from '../AddTask';
import { useAuth } from '../../context/auth-context';

export const Header = ({ darkMode, setDarkMode }) => {
  const [shouldShowMain, setShouldShowMain] = useState(false);
  const [showQuickAddTask, setShowQuickAddTask] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <header className="header" data-testid="header">
      <nav>
        <div className="logo">
          <FiCheckSquare className="logo-icon" />
          <span>AI Todoist</span>
        </div>
        <div className="settings">
          <ul>
            <li className="settings__add">
              <button
                data-testid="quick-add-task-action"
                aria-label="Quick add task"
                type="button"
                onClick={() => {
                  setShowQuickAddTask(true);
                  setShouldShowMain(true);
                }}
              >
                +
              </button>
            </li>
            <li className="settings__darkmode">
              <button
                data-testid="dark-mode-action"
                aria-label="Darkmode on/off"
                type="button"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <FiSun /> : <FiMoon />}
              </button>
            </li>
            <li className="settings__user">
              <span className="user-email">{user?.email}</span>
              <button
                data-testid="logout-action"
                aria-label="Logout"
                type="button"
                onClick={() => signOut()}
                className="logout-btn"
              >
                <FiLogOut />
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <AddTask
        showAddTaskMain={false}
        shouldShowMain={shouldShowMain}
        showQuickAddTask={showQuickAddTask}
        setShowQuickAddTask={setShowQuickAddTask}
      />
    </header>
  );
};

Header.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  setDarkMode: PropTypes.func.isRequired,
};
