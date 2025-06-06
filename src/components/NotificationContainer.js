import React from 'react';
import { 
  FiCheckCircle, 
  FiXCircle, 
  FiAlertTriangle, 
  FiInfo, 
  FiX 
} from 'react-icons/fi';
import { useNotifications, NOTIFICATION_TYPES } from '../context/notification-context';

const NotificationItem = ({ notification, onRemove }) => {
  const { id, message, type, actions } = notification;

  const getIcon = () => {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return <FiCheckCircle className="notification-icon success" />;
      case NOTIFICATION_TYPES.ERROR:
        return <FiXCircle className="notification-icon error" />;
      case NOTIFICATION_TYPES.WARNING:
        return <FiAlertTriangle className="notification-icon warning" />;
      case NOTIFICATION_TYPES.INFO:
      default:
        return <FiInfo className="notification-icon info" />;
    }
  };

  const getClassName = () => {
    return `notification notification--${type}`;
  };

  return (
    <div className={getClassName()}>
      <div className="notification-content">
        {getIcon()}
        <div className="notification-message">
          {message}
        </div>
        <button
          className="notification-close"
          onClick={() => onRemove(id)}
          aria-label="Close notification"
        >
          <FiX />
        </button>
      </div>
      
      {actions && actions.length > 0 && (
        <div className="notification-actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className="notification-action"
              onClick={() => {
                action.onClick();
                onRemove(id);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notifications-container">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
};