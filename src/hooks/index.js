/* eslint-disable no-nested-ternary */
import { useState, useEffect } from 'react';
import moment from 'moment';
import { tasksService, projectsService } from '../lib/supabase-native-fixed';
import { collatedTasksExist } from '../helpers';
import { useAuth } from '../context/auth-context';

export const useTasks = selectedProject => {
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const { user } = useAuth();

  // Native optimistic update functions with relational data
  const addTaskOptimistic = (taskData) => {
    const optimisticTask = {
      id: 'temp-' + Date.now(),
      ...taskData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project: taskData.projectId ? { id: taskData.projectId, name: 'Loading...' } : null,
      subtasks: [],
      parent_task: null,
      _optimistic: true
    };
    setTasks(prevTasks => [optimisticTask, ...prevTasks]);
    return optimisticTask.id;
  };

  const updateTaskOptimistic = (taskId, updates) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              ...updates, 
              updated_at: new Date().toISOString(),
              _optimistic: true 
            }
          : task
      )
    );
  };

  const deleteTaskOptimistic = (taskId) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    setArchivedTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  };

  const archiveTaskOptimistic = (taskId) => {
    const taskToArchive = tasks.find(task => task.id === taskId);
    if (taskToArchive) {
      const archivedTask = { ...taskToArchive, archived: true, _optimistic: true };
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      setArchivedTasks(prevTasks => [archivedTask, ...prevTasks]);
    }
  };

  const revertOptimisticUpdate = (originalTasks, originalArchived = []) => {
    setTasks(originalTasks);
    setArchivedTasks(originalArchived);
  };

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setArchivedTasks([]);
      return;
    }

    // Build filters for the subscription
    const filters = { archived: false };
    
    if (selectedProject && !collatedTasksExist(selectedProject)) {
      filters.projectId = selectedProject;
    } else if (selectedProject === 'TODAY') {
      filters.dateFilter = 'TODAY';
    } else if (selectedProject === 'NEXT_7') {
      filters.dateFilter = 'NEXT_7';
    } else if (selectedProject === 'INBOX' || selectedProject === 0) {
      filters.projectId = '1';
    }

    console.log('Setting up native Supabase subscription for user:', user.id, 'filters:', filters);

    let unsubscribeFunction = null;

    // Use native Supabase subscription
    try {
      unsubscribeFunction = tasksService.subscribeToTasks(user.id, filters, (allTasks) => {
        console.log('Received tasks from native subscription:', allTasks.length);
        
        // Separate active and archived tasks
        const activeTasks = allTasks.filter(task => !task.archived);
        const archived = allTasks.filter(task => task.archived);
        
        // Apply client-side filtering for special collections
        let filteredActiveTasks = activeTasks;
        
        if (selectedProject === 'NEXT_7') {
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          
          filteredActiveTasks = activeTasks.filter(task => {
            if (!task.date) return false;
            try {
              const taskDate = new Date(task.date.split('/').reverse().join('-'));
              return taskDate >= today && taskDate <= nextWeek;
            } catch (e) {
              return false;
            }
          });
        } else if (selectedProject === 'INBOX' || selectedProject === 0) {
          filteredActiveTasks = activeTasks.filter(task => !task.date || task.date === '');
        }

        setTasks(filteredActiveTasks);
        setArchivedTasks(archived);
      });
    } catch (error) {
      console.error('Error setting up subscription:', error);
    }

    return () => {
      console.log('Unsubscribing from native Supabase subscription');
      if (unsubscribeFunction) {
        try {
          unsubscribeFunction();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      }
    };
  }, [selectedProject, user]);

  return { 
    tasks, 
    archivedTasks,
    addTaskOptimistic,
    updateTaskOptimistic, 
    deleteTaskOptimistic,
    archiveTaskOptimistic,
    revertOptimisticUpdate
  };
};

export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    console.log('Setting up native Supabase projects subscription for user:', user.id);
    
    let unsubscribeFunction = null;

    try {
      // Use native Supabase projects service
      unsubscribeFunction = projectsService.subscribeToProjects(user.id, (allProjects) => {
        console.log('Received projects from native subscription:', allProjects.length);
        
        // Transform for backward compatibility
        const transformedProjects = allProjects.map(project => ({
          ...project,
          docId: project.id,
          projectId: project.id,
          taskCount: 0, // Will be calculated client-side if needed
          userId: project.user_id,
          createdAt: project.created_at,
          updatedAt: project.updated_at
        }));
        
        setProjects(transformedProjects);
      });
    } catch (error) {
      console.error('Error setting up projects subscription:', error);
    }

    return () => {
      console.log('Unsubscribing from native Supabase projects subscription');
      if (unsubscribeFunction) {
        try {
          unsubscribeFunction();
        } catch (error) {
          console.error('Error unsubscribing from projects:', error);
        }
      }
    };
  }, [user]);

  return { projects, setProjects };
};
