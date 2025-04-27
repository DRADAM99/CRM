'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings2 } from 'lucide-react';
import { TabsManager } from './TabsManager';

const COLORS = {
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  yellow: 'bg-yellow-100 text-yellow-800'
};

/**
 * @typedef {Object} User
 * @property {string} uid - The user's unique ID
 */

/**
 * @typedef {Object} Tab
 * @property {string} id - The tab's unique ID
 * @property {string} name - The tab's name
 * @property {string} color - The tab's color (one of: 'red', 'blue', 'green', 'purple', 'yellow')
 * @property {string} userId - The ID of the user who created the tab
 */

/**
 * @typedef {Object} TaskTab
 * @property {string} id - The task tab's unique ID
 * @property {string} taskId - The ID of the task
 * @property {string} tabId - The ID of the tab
 * @property {string} addedBy - The ID of the user who added the tab to the task
 */

/**
 * TaskTabs component for managing tabs associated with a task
 * @param {Object} props
 * @param {string} props.taskId - The ID of the task
 * @param {User} props.currentUser - The current user object
 * @returns {JSX.Element}
 */
export function TaskTabs({ taskId, currentUser }) {
  /** @type {[Tab[], Function]} */
  const [userTabs, setUserTabs] = useState([]);
  /** @type {[TaskTab[], Function]} */
  const [taskTabs, setTaskTabs] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [isManaging, setIsManaging] = useState(false);

  // Listen for user's tabs
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'userTabs'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserTabs(tabs);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Listen for task's tabs
  useEffect(() => {
    if (!taskId) return;

    const q = query(
      collection(db, 'taskTabs'),
      where('taskId', '==', taskId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tabs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTaskTabs(tabs);
    });

    return () => unsubscribe();
  }, [taskId]);

  const handleCreateTab = async (e) => {
    e.preventDefault();
    if (!newTabName.trim() || !currentUser) return;

    try {
      await addDoc(collection(db, 'userTabs'), {
        userId: currentUser.uid,
        name: newTabName.trim(),
        color: selectedColor,
        createdAt: serverTimestamp()
      });

      setNewTabName('');
      setSelectedColor('blue');
      setIsAdding(false);
    } catch (error) {
      console.error('Error creating tab:', error);
      alert('שגיאה ביצירת תגית');
    }
  };

  const handleAddTabToTask = async (tabId) => {
    if (!currentUser || !taskId) return;

    try {
      await addDoc(collection(db, 'taskTabs'), {
        taskId,
        tabId,
        addedBy: currentUser.uid,
        addedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding tab to task:', error);
      alert('שגיאה בהוספת תגית למשימה');
    }
  };

  const handleRemoveTabFromTask = async (taskTabId) => {
    try {
      await deleteDoc(doc(db, 'taskTabs', taskTabId));
    } catch (error) {
      console.error('Error removing tab from task:', error);
      alert('שגיאה בהסרת תגית מהמשימה');
    }
  };

  // Get active tabs for this task
  const activeTabs = taskTabs.map(taskTab => {
    const userTab = userTabs.find(ut => ut.id === taskTab.tabId);
    return userTab ? { 
      taskTabId: taskTab.id,
      id: userTab.id,
      ...userTab,
      ...taskTab
    } : null;
  }).filter(Boolean);

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {/* Tabs Manager Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsManaging(true)}
        className="h-7 w-7 p-0 hover:bg-gray-100"
        title="נהל תגיות"
      >
        <Settings2 className="h-4 w-4 text-gray-500" />
      </Button>

      {/* Active tabs */}
      {activeTabs.map(tab => (
        <div key={tab.id} className="relative group">
          <div className={`px-2.5 py-1 rounded-md ${COLORS[tab.color]} flex items-center gap-1.5 text-sm font-medium min-w-[70px] shadow-sm`}>
            <div className={`h-2 w-2 rounded-full ${COLORS[tab.color].replace('bg-', 'bg-opacity-70 bg-')}`} />
            <span className="truncate">{tab.name}</span>
            <button
              onClick={() => handleRemoveTabFromTask(tab.taskTabId)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-gray-500 hover:text-gray-700"
              aria-label="Remove tab"
            >
              ×
            </button>
          </div>
        </div>
      ))}

      {/* Add tab interface */}
      {isAdding ? (
        <form onSubmit={handleCreateTab} className="flex items-center gap-2">
          <Input
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            placeholder="שם התגית"
            className="h-8 text-sm w-28"
            autoFocus
          />
          <div className="flex gap-1">
            {Object.entries(COLORS).map(([color, bgClass]) => (
              <button
                key={color}
                type="button"
                className={`w-5 h-5 rounded-full ${bgClass.split(' ')[0]} ${selectedColor === color ? 'ring-2 ring-offset-1 ring-gray-300' : ''}`}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
          <Button type="submit" size="sm" className="h-8 text-sm px-3">שמור</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100" onClick={() => setIsAdding(false)}>✕</Button>
        </form>
      ) : (
        <>
          {/* Existing tabs dropdown */}
          {userTabs.length > 0 && (
            <div className="relative group">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100">+</Button>
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-md p-2 z-10 min-w-[150px]">
                {userTabs.map(tab => (
                  <div 
                    key={tab.id} 
                    className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer whitespace-nowrap"
                    onClick={() => !taskTabs.some(tt => tt.tabId === tab.id) && handleAddTabToTask(tab.id)}
                  >
                    <div className={`w-3 h-3 rounded-full ${COLORS[tab.color].split(' ')[0]}`} />
                    <span className="text-sm">{tab.name}</span>
                    {taskTabs.some(tt => tt.tabId === tab.id) && <span className="text-sm text-green-600">✓</span>}
                  </div>
                ))}
                <div 
                  className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer border-t border-gray-200 mt-2 pt-2"
                  onClick={() => setIsAdding(true)}
                >
                  <span className="text-sm text-gray-500">+ תגית חדשה</span>
                </div>
              </div>
            </div>
          )}
          
          {/* New tab button when no existing tabs */}
          {userTabs.length === 0 && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100" onClick={() => setIsAdding(true)}>+</Button>
          )}
        </>
      )}

      {/* Tabs Manager Modal */}
      <TabsManager
        isOpen={isManaging}
        onClose={() => setIsManaging(false)}
        userTabs={userTabs}
        onTabsChange={() => {
          // The real-time listener will handle the updates
        }}
      />
    </div>
  );
}