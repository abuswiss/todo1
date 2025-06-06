import React, { useEffect, useState } from 'react';
import { Checkbox } from './Checkbox';
import { AddTask } from './AddTask';
import SmartTaskInput from './SmartTaskInput';
import { useTasks } from '../hooks';
import { collatedTasks } from '../constants';
import { getTitle, getCollatedTitle, collatedTasksExist } from '../helpers';
import { useSelectedProjectValue, useProjectsValue } from '../context';
import { useAuth } from '../context/auth-context';
import { useNotifications } from '../context/notification-context';
import { tasksService } from '../lib/supabase-native-fixed';
import moment from 'moment';
import { FiZap, FiList, FiClock, FiUser, FiTag, FiEdit2, FiTrash2 } from 'react-icons/fi';

export const Tasks = () => {
  const { selectedProject } = useSelectedProjectValue();
  const { projects } = useProjectsValue();
  const { user } = useAuth();
  const { showSuccess, showError, showOptimisticUpdateError } = useNotifications();
  const { 
    tasks, 
    addTaskOptimistic, 
    updateTaskOptimistic, 
    deleteTaskOptimistic, 
    archiveTaskOptimistic,
    revertOptimisticUpdate 
  } = useTasks(selectedProject);
  const [useSmartInput, setUseSmartInput] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');

  let projectName = '';

  if (collatedTasksExist(selectedProject) && selectedProject) {
    projectName = getCollatedTitle(collatedTasks, selectedProject).name;
  }

  if (
    projects &&
    projects.length > 0 &&
    selectedProject &&
    !collatedTasksExist(selectedProject)
  ) {
    projectName = getTitle(projects, selectedProject).name;
  }

  useEffect(() => {
    document.title = `${projectName}: Todoist`;
  });

  const handleAddTask = async (taskData) => {
    const projectId = taskData.projectId || selectedProject;
    let collatedDate = '';

    if (projectId === 'TODAY') {
      collatedDate = moment().format('DD/MM/YYYY');
    } else if (projectId === 'NEXT_7') {
      collatedDate = moment().add(7, 'days').format('DD/MM/YYYY');
    }

    const finalTaskData = {
      archived: false,
      projectId,
      task: taskData.task,
      date: collatedDate || taskData.date || '',
      priority: taskData.priority || 'medium',
      userId: user?.id,
      aiEnhanced: taskData.aiEnhanced || false,
      metadata: taskData.metadata || {},
      parentTaskId: taskData.parentTaskId || null, // For subtasks
      createdAt: new Date().toISOString(),
    };

    // Optimistic update - show immediately
    const tempId = addTaskOptimistic(finalTaskData);
    const originalTasks = tasks;

    try {
      // Background database update
      const createdTask = await tasksService.createTask(finalTaskData);
      
      // Update the temp task with real ID when database responds
      updateTaskOptimistic(tempId, { id: createdTask.id, _optimistic: false });
      
      // Return the created task data for parent-child relationships
      return {
        id: createdTask.id,
        tempId: tempId,
        task: createdTask
      };
    } catch (error) {
      console.error('Error adding task:', error);
      // Revert optimistic update on error
      revertOptimisticUpdate(originalTasks);
      
      // Show user-friendly error notification with retry option
      showOptimisticUpdateError('save task', originalTasks, () => {
        handleAddTask(finalTaskData);
      });
      
      throw error; // Re-throw so caller can handle the error
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      const originalTasks = tasks;
      const taskToDelete = tasks.find(t => t.id === taskId);
      
      // Optimistic update - remove immediately
      deleteTaskOptimistic(taskId);

      try {
        // Background database update
        await tasksService.deleteTask(taskId);
        showSuccess('Task deleted successfully');
      } catch (error) {
        console.error('Error deleting task:', error);
        // Revert optimistic update on error
        revertOptimisticUpdate(originalTasks);
        
        // Show error notification with retry option
        showOptimisticUpdateError('delete task', originalTasks, () => {
          handleDeleteTask(taskId);
        });
      }
    }
  };

  const handleEditTask = (taskId, currentTask) => {
    setEditingTask(taskId);
    setEditingTaskText(currentTask);
  };

  const handleSaveEdit = async () => {
    if (editingTaskText.trim() && editingTaskText !== '') {
      const originalTasks = tasks;
      const currentTask = tasks.find(t => t.id === editingTask);
      
      // Optimistic update - show changes immediately
      updateTaskOptimistic(editingTask, { task: editingTaskText.trim() });
      setEditingTask(null);
      setEditingTaskText('');

      try {
        // Background database update
        await tasksService.updateTask(editingTask, {
          task: editingTaskText.trim()
        });
        showSuccess('Task updated successfully');
      } catch (error) {
        console.error('Error updating task:', error);
        // Revert optimistic update on error
        revertOptimisticUpdate(originalTasks);
        
        // Show error notification with retry option
        const currentTaskData = tasks.find(t => t.id === editingTask);
        showOptimisticUpdateError('update task', originalTasks, () => {
          if (currentTaskData) {
            handleEditTask(editingTask, currentTaskData.task);
            setEditingTaskText(editingTaskText.trim());
          }
        });
        
        // Reopen edit modal with original text
        setEditingTask(editingTask);
        setEditingTaskText(currentTask.task);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditingTaskText('');
  };

  const renderTaskItem = (task, isSubtask = false) => {
    const isAIEnhanced = task.aiEnhanced;
    const metadata = task.metadata || {};
    
    return (
      <li key={`${task.id}`} className={`task-item ${isAIEnhanced ? 'ai-enhanced' : ''} ${isSubtask ? 'subtask' : ''}`}>
        <div className="checkbox-holder">
          <Checkbox 
            id={task.id} 
            taskDesc={task.task} 
            onOptimisticArchive={archiveTaskOptimistic}
          />
        </div>
        
        <div className="task-content">
          <div className="task-text">{task.task}</div>
          
          <div className="task-meta">
            {task.date && (
              <span className="task-date">
                <FiClock size={12} />
                {task.date}
              </span>
            )}
            
            {task.priority && task.priority !== 'medium' && (
              <span className={`task-priority ${task.priority}`}>
                <FiTag size={12} />
                {task.priority}
              </span>
            )}
            
            {metadata.aiParsed?.category && (
              <span className="task-category">
                <FiList size={12} />
                {metadata.aiParsed.category}
              </span>
            )}
            
            {metadata.aiParsed?.people && metadata.aiParsed.people.length > 0 && (
              <span className="task-people">
                <FiUser size={12} />
                {metadata.aiParsed.people.join(', ')}
              </span>
            )}
            
            {isAIEnhanced && (
              <span className="ai-badge" title="AI Enhanced Task">
                <FiZap size={12} />
                AI
              </span>
            )}
            
            {metadata.type === 'subtask' && (
              <span className="subtask-badge" title="AI Generated Subtask">
                <FiList size={12} />
                Subtask
              </span>
            )}
          </div>
        </div>
        
        <div className="task-actions">
          <button 
            title="Edit task"
            onClick={() => handleEditTask(task.id, task.task)}
          >
            <FiEdit2 size={14} />
          </button>
          <button 
            title="Delete task"
            onClick={() => handleDeleteTask(task.id)}
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </li>
    );
  };

  const renderTasksWithSubtasks = () => {
    // Group tasks by parent-child relationships
    const parentTasks = tasks.filter(task => !task.parentTaskId || task.parentTaskId === null);
    const subtasks = tasks.filter(task => task.parentTaskId && task.parentTaskId !== null);
    
    const taskElements = [];
    
    parentTasks.forEach(parentTask => {
      // Add the parent task
      taskElements.push(renderTaskItem(parentTask, false));
      
      // Add its subtasks
      const childTasks = subtasks.filter(subtask => 
        subtask.parentTaskId === parentTask.id || 
        (subtask.parentTaskId === 'pending' && subtask.metadata?.parentTask === parentTask.task)
      );
      
      childTasks.forEach(subtask => {
        taskElements.push(renderTaskItem(subtask, true));
      });
    });
    
    return taskElements;
  };

  return (
    <div className="tasks" data-testid="tasks">
      <div className="tasks-header">
        <h2 data-testid="project-name">{projectName}</h2>
        
        <div className="input-toggle">
          <button 
            className={`toggle-btn ${useSmartInput ? 'active' : ''}`}
            onClick={() => setUseSmartInput(true)}
            title="Use AI-powered smart input"
          >
            <FiZap size={16} />
            Smart
          </button>
          <button 
            className={`toggle-btn ${!useSmartInput ? 'active' : ''}`}
            onClick={() => setUseSmartInput(false)}
            title="Use traditional input"
          >
            <FiList size={16} />
            Classic
          </button>
        </div>
      </div>

      {useSmartInput ? (
        <SmartTaskInput onAddTask={handleAddTask} projectId={selectedProject} />
      ) : (
        <AddTask />
      )}

      <ul className="tasks__list">
        {renderTasksWithSubtasks()}
      </ul>
      
      {tasks.length === 0 && (
        <div className="empty-state">
          <FiZap size={48} />
          <h3>Ready to get organized?</h3>
          <p>Add your first task using our AI-powered smart input above.</p>
        </div>
      )}

      {editingTask && (
        <div className="edit-task-overlay">
          <div className="edit-task-modal">
            <div className="edit-task-header">
              <h3>Edit Task</h3>
              <button 
                className="close-btn"
                onClick={handleCancelEdit}
              >
                ×
              </button>
            </div>
            <div className="edit-task-content">
              <input
                type="text"
                value={editingTaskText}
                onChange={(e) => setEditingTaskText(e.target.value)}
                className="edit-task-input"
                placeholder="Enter task description..."
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <div className="edit-task-actions">
                <button 
                  className="save-btn"
                  onClick={handleSaveEdit}
                  disabled={!editingTaskText.trim()}
                >
                  Save Changes
                </button>
                <button 
                  className="cancel-btn"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
