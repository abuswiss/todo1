import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

let notificationId = 0;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = NOTIFICATION_TYPES.INFO, options = {}) => {
    const id = ++notificationId;
    const notification = {
      id,
      message,
      type,
      duration: options.duration || 5000,
      persistent: options.persistent || false,
      actions: options.actions || null,
      timestamp: Date.now()
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove notification unless persistent
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods for different notification types
  const showSuccess = useCallback((message, options) => {
    return addNotification(message, NOTIFICATION_TYPES.SUCCESS, options);
  }, [addNotification]);

  const showError = useCallback((message, options) => {
    return addNotification(message, NOTIFICATION_TYPES.ERROR, {
      duration: 8000, // Errors stay longer by default
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, options) => {
    return addNotification(message, NOTIFICATION_TYPES.WARNING, options);
  }, [addNotification]);

  const showInfo = useCallback((message, options) => {
    return addNotification(message, NOTIFICATION_TYPES.INFO, options);
  }, [addNotification]);

  // Specialized methods for common use cases
  const showOptimisticUpdateError = useCallback((action, originalData, retryCallback) => {
    const message = `Failed to ${action}. Your changes have been reverted.`;
    return showError(message, {
      actions: retryCallback ? [
        {
          label: 'Retry',
          onClick: retryCallback
        }
      ] : null
    });
  }, [showError]);

  const showNetworkError = useCallback((retryCallback) => {
    const message = 'Network connection lost. Please check your connection.';
    return showError(message, {
      persistent: true,
      actions: retryCallback ? [
        {
          label: 'Retry',
          onClick: retryCallback
        }
      ] : null
    });
  }, [showError]);

  const showRateLimitError = useCallback(() => {
    const message = 'Too many requests. Please wait a moment before trying again.';
    return showWarning(message, {
      duration: 10000
    });
  }, [showWarning]);

  const showAuthError = useCallback(() => {
    const message = 'Your session has expired. Please sign in again.';
    return showError(message, {
      persistent: true
    });
  }, [showError]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showOptimisticUpdateError,
    showNetworkError,
    showRateLimitError,
    showAuthError
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};