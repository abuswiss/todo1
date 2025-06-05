import React, { useEffect, useState } from 'react';
import { Checkbox } from './Checkbox';
import { AddTask } from './AddTask';
import SmartTaskInput from './SmartTaskInput';
import { useTasks } from '../hooks';
import { collatedTasks } from '../constants';
import { getTitle, getCollatedTitle, collatedTasksExist } from '../helpers';
import { useSelectedProjectValue, useProjectsValue } from '../context';
import { firebase } from '../firebase';
import moment from 'moment';
import { FiZap, FiList, FiClock, FiUser, FiTag, FiEdit2, FiTrash2 } from 'react-icons/fi';

export const Tasks = () => {
  const { selectedProject } = useSelectedProjectValue();
  const { projects } = useProjectsValue();
  const { tasks } = useTasks(selectedProject);
  const [useSmartInput, setUseSmartInput] = useState(true);

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

    try {
      await firebase
        .firestore()
        .collection('tasks')
        .add({
          archived: false,
          projectId,
          task: taskData.task,
          date: collatedDate || taskData.date || '',
          priority: taskData.priority || 'medium',
          userId: 'demo-user',
          aiEnhanced: taskData.aiEnhanced || false,
          metadata: taskData.metadata || {},
          createdAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await firebase
          .firestore()
          .collection('tasks')
          .doc(taskId)
          .delete();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleEditTask = async (taskId, currentTask) => {
    const newTask = window.prompt('Edit task:', currentTask);
    if (newTask && newTask !== currentTask) {
      try {
        await firebase
          .firestore()
          .collection('tasks')
          .doc(taskId)
          .update({
            task: newTask
          });
      } catch (error) {
        console.error('Error updating task:', error);
      }
    }
  };

  const renderTaskItem = (task) => {
    const isAIEnhanced = task.aiEnhanced;
    const metadata = task.metadata || {};
    
    return (
      <li key={`${task.id}`} className={`task-item ${isAIEnhanced ? 'ai-enhanced' : ''}`}>
        <div className="checkbox-holder">
          <Checkbox id={task.id} taskDesc={task.task} />
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
        {tasks.map(renderTaskItem)}
      </ul>
      
      {tasks.length === 0 && (
        <div className="empty-state">
          <FiZap size={48} />
          <h3>Ready to get organized?</h3>
          <p>Add your first task using our AI-powered smart input above.</p>
        </div>
      )}
    </div>
  );
};
