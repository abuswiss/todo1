import React from 'react';
import PropTypes from 'prop-types';
import { tasksService } from '../lib/supabase-native';
import { useNotifications } from '../context/notification-context';

export const Checkbox = ({ id, taskDesc, onOptimisticArchive }) => {
  const { showSuccess, showError } = useNotifications();
  
  const archiveTask = async () => {
    // Immediate UI update
    if (onOptimisticArchive) {
      onOptimisticArchive(id);
    }

    try {
      // Background database update
      await tasksService.updateTask(id, {
        archived: true,
      });
      showSuccess('Task completed successfully');
    } catch (error) {
      console.error('Error archiving task:', error);
      showError('Failed to complete task. Please try again.');
      // Could add error handling here to revert optimistic update
    }
  };

  return (
    <div
      className="checkbox-holder"
      data-testid="checkbox-action"
      onClick={() => archiveTask()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') archiveTask();
      }}
      aria-label={`Mark ${taskDesc} as done?`}
      role="button"
      tabIndex={0}
    >
      <span className="checkbox" />
    </div>
  );
};

Checkbox.propTypes = {
  id: PropTypes.string.isRequired,
  taskDesc: PropTypes.string.isRequired,
  onOptimisticArchive: PropTypes.func,
};
