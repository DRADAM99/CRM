'use client';

import { useState } from 'react';
import { db } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2 } from 'lucide-react';

const COLORS = {
  red: 'bg-red-200',
  blue: 'bg-blue-200',
  green: 'bg-green-200',
  purple: 'bg-purple-200',
  yellow: 'bg-yellow-200'
};

export function TabsManager({ isOpen, onClose, userTabs, onTabsChange }) {
  const [editingTab, setEditingTab] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleStartEdit = (tab) => {
    setEditingTab(tab);
    setEditName(tab.name);
    setEditColor(tab.color);
  };

  const handleCancelEdit = () => {
    setEditingTab(null);
    setEditName('');
    setEditColor('');
  };

  const handleSaveEdit = async () => {
    if (!editingTab || !editName.trim()) return;

    try {
      await updateDoc(doc(db, 'userTabs', editingTab.id), {
        name: editName.trim(),
        color: editColor
      });
      
      handleCancelEdit();
      if (onTabsChange) onTabsChange();
    } catch (error) {
      console.error('Error updating tab:', error);
      alert('שגיאה בעדכון התגית');
    }
  };

  const handleDeleteTab = async (tabId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תגית זו?')) return;

    try {
      await deleteDoc(doc(db, 'userTabs', tabId));
      if (onTabsChange) onTabsChange();
    } catch (error) {
      console.error('Error deleting tab:', error);
      alert('שגיאה במחיקת התגית');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ניהול תגיות</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {userTabs.map(tab => (
            <div key={tab.id} className="flex items-center justify-between p-2 rounded-lg border">
              {editingTab?.id === tab.id ? (
                // Edit mode
                <div className="flex items-center gap-2 w-full">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    placeholder="שם התגית"
                  />
                  <div className="flex gap-1">
                    {Object.entries(COLORS).map(([color, bgClass]) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full ${bgClass} ${editColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                        onClick={() => setEditColor(color)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleSaveEdit}>שמור</Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>ביטול</Button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${COLORS[tab.color]}`} />
                    <span>{tab.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(tab)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTab(tab.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {userTabs.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              אין תגיות עדיין. צור תגית חדשה מתוך משימה.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 