import React from 'react';
import PropTypes from 'prop-types';
import { firebase } from '../firebase';

export const Checkbox = ({ id, taskDesc, onOptimisticArchive }) => {
  const archiveTask = async () => {
    // Immediate UI update
    if (onOptimisticArchive) {
      onOptimisticArchive(id);
    }

    try {
      // Background database update
      await firebase.firestore().collection('tasks').doc(id).update({
        archived: true,
      });
    } catch (error) {
      console.error('Error archiving task:', error);
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
