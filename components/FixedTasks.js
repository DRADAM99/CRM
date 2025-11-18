"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format, startOfWeek, addDays, getWeek, getYear, isSameDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
const BASE_ROWS = ["ייעוצים", "מתחילים", "מפגשים", "גביה"];
const COLUMNS = ["מודיעין", "רעננה", "עין דור"];

// Pastel colors matching the app
const CARD_COLORS = [
  "#eaccd8", // pink
  "#bee4e5", // blue
  "#c8c7ef", // purple
  "#cfe8bc", // green
  "#efe9b4", // yellow
];

// Helper to get rows for a specific date
function getRowsForDate(date) {
  const dayOfMonth = date.getDate();
  let rows = [...BASE_ROWS];
  
  // Add דוחות on 7th and 22nd
  if (dayOfMonth === 7 || dayOfMonth === 22) {
    rows.push("דוחות");
  }
  
  // Add זיכויים on 8th
  if (dayOfMonth === 8) {
    rows.push("זיכויים");
  }
  
  return rows;
}

// Helper to check if גביה should be bold
function shouldGviyaBeBold(date) {
  const dayOfMonth = date.getDate();
  return [5, 10, 15, 20, 25, 28, 30].includes(dayOfMonth);
}

// Helper to format date for display
function formatDateDisplay(date) {
  return format(date, 'd/M', { locale: he });
}

// Helper to get week ID for Firebase
function getWeekId(date) {
  const year = getYear(date);
  const week = getWeek(date, { locale: he });
  return `${year}-W${week}`;
}

export default function FixedTasks({ currentUser, users = [], isVisible = true, onToggleVisibility }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    return startOfWeek(new Date(), { locale: he });
  });
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const alias = users.find(u => u.id === currentUser?.uid)?.alias || currentUser?.email || "";

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Set current day index on load (for mobile)
  useEffect(() => {
    const today = new Date();
    const dayName = format(today, 'EEEE', { locale: he });
    const dayMap = {
      'יום ראשון': 0,
      'יום שני': 1,
      'יום שלישי': 2,
      'יום רביעי': 3,
      'יום חמישי': 4,
    };
    if (dayMap[dayName] !== undefined) {
      setCurrentDayIndex(dayMap[dayName]);
    }
  }, []);

  // Visibility is now controlled by parent component

  // Load week data from Firebase with real-time listener
  useEffect(() => {
    const weekId = getWeekId(currentWeekStart);
    const weekRef = doc(db, 'fixedTasksWeekly', weekId);
    
    setLoading(true);
    
    const unsubscribe = onSnapshot(weekRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Ensure all 5 days exist in the data structure
        const completeData = {
          ...data,
          days: { ...data.days }
        };
        
        DAYS.forEach((day, index) => {
          if (!completeData.days[day]) {
            const dayDate = addDays(currentWeekStart, index);
            completeData.days[day] = {
              date: Timestamp.fromDate(dayDate),
              tasks: {},
              comments: []
            };
          }
        });
        
        setWeekData(completeData);
        setLoading(false);
      } else {
        // Initialize empty week data
        const emptyWeekData = {
          weekStartDate: Timestamp.fromDate(currentWeekStart),
          days: {}
        };
        DAYS.forEach((day, index) => {
          const dayDate = addDays(currentWeekStart, index);
          emptyWeekData.days[day] = {
            date: Timestamp.fromDate(dayDate),
            tasks: {},
            comments: []
          };
        });
        
        // Create the document in Firebase
        try {
          await setDoc(weekRef, emptyWeekData);
          setWeekData(emptyWeekData);
        } catch (error) {
          console.error('Error creating week document:', error);
          setWeekData(emptyWeekData);
        }
        setLoading(false);
      }
    }, (error) => {
      console.error('Error loading week data:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentWeekStart]);

  // Navigate to previous week
  const goToPrevWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, -7));
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7));
  };

  // Navigate to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { locale: he }));
  };

  // Handle checkbox toggle
  const handleCheckboxToggle = async (dayName, taskKey, currentChecked) => {
    if (!currentUser || !weekData) return;
    
    // If unchecking, require confirmation
    if (currentChecked) {
      if (!window.confirm('האם אתה בטוח שברצונך לבטל את הסימון?')) {
        return;
      }
    }

    const weekId = getWeekId(currentWeekStart);
    const weekRef = doc(db, 'fixedTasksWeekly', weekId);
    
    try {
      const newTaskData = currentChecked ? {
        checked: false,
        userId: null,
        userAlias: null,
        timestamp: null
      } : {
        checked: true,
        userId: currentUser.uid,
        userAlias: alias,
        timestamp: Timestamp.fromDate(new Date())
      };

      // Optimistic update
      setWeekData(prev => ({
        ...prev,
        days: {
          ...prev.days,
          [dayName]: {
            ...prev.days[dayName],
            tasks: {
              ...prev.days[dayName].tasks,
              [taskKey]: newTaskData
            }
          }
        }
      }));

      // Update Firebase using setDoc with merge to handle non-existent documents
      await setDoc(weekRef, {
        days: {
          [dayName]: {
            tasks: {
              [taskKey]: newTaskData
            }
          }
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error toggling checkbox:', error);
      alert('שגיאה בעדכון המשימה. נסה שוב.');
      // Reload data on error
      const docSnap = await getDoc(weekRef);
      if (docSnap.exists()) {
        setWeekData(docSnap.data());
      }
    }
  };

  // Handle comment update
  const handleCommentUpdate = async (dayName, commentIndex, newText) => {
    if (!currentUser || !weekData) return;
    
    // Don't save empty comments
    if (!newText.trim()) return;
    
    const weekId = getWeekId(currentWeekStart);
    const weekRef = doc(db, 'fixedTasksWeekly', weekId);
    
    try {
      const dayComments = weekData.days[dayName]?.comments || [];
      const updatedComments = [...dayComments];
      
      if (commentIndex < updatedComments.length) {
        // Update existing comment
        updatedComments[commentIndex] = {
          ...updatedComments[commentIndex],
          text: newText,
          userId: currentUser.uid,
          userAlias: alias,
          timestamp: Timestamp.fromDate(new Date())
        };
      } else {
        // Add new comment
        updatedComments.push({
          text: newText,
          userId: currentUser.uid,
          userAlias: alias,
          timestamp: Timestamp.fromDate(new Date())
        });
      }

      // Update Firebase using setDoc with merge to handle non-existent documents
      await setDoc(weekRef, {
        days: {
          [dayName]: {
            comments: updatedComments
          }
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('שגיאה בעדכון ההערה. נסה שוב.');
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && currentDayIndex < DAYS.length - 1) {
      setCurrentDayIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentDayIndex > 0) {
      setCurrentDayIndex(prev => prev - 1);
    }
  };

  // Render single day card
  const renderDayCard = (dayName, dayIndex) => {
    if (!weekData || !weekData.days[dayName]) return null;
    
    const dayDate = addDays(currentWeekStart, dayIndex);
    const dayData = weekData.days[dayName];
    const rows = getRowsForDate(dayDate);
    const isBoldGviya = shouldGviyaBeBold(dayDate);
    const isToday = isSameDay(dayDate, new Date());

    return (
      <div
        key={dayName}
        className="flex-shrink-0 w-full md:w-auto"
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          padding: '16px',
          border: isToday ? '3px solid #2196f3' : '1px solid #e0e0e0',
        }}
      >
        {/* Day header */}
        <div style={{
          textAlign: 'center',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '2px solid #e0e0e0',
          background: CARD_COLORS[dayIndex],
          margin: '-16px -16px 12px -16px',
          padding: '12px',
          borderRadius: '12px 12px 0 0'
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{dayName}</h3>
          <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
            {formatDateDisplay(dayDate)}
          </div>
        </div>

        {/* Tasks grid */}
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }} dir="rtl">
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '6px', background: '#f5f5f5', fontWeight: 600 }}></th>
                {COLUMNS.map(col => (
                  <th key={col} style={{ border: '1px solid #ddd', padding: '6px', background: '#f5f5f5', fontWeight: 600, textAlign: 'center' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row}>
                  <td style={{
                    border: '1px solid #ddd',
                    padding: '6px',
                    fontWeight: (row === 'גביה' && isBoldGviya) ? 700 : 500,
                    background: '#fafafa'
                  }}>
                    {row}
                  </td>
                  {COLUMNS.map(col => {
                    const taskKey = `${row}-${col}`;
                    const taskData = dayData.tasks?.[taskKey] || { checked: false };
                    return (
                      <td key={col} style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <input
                                type="checkbox"
                                checked={taskData.checked || false}
                                onChange={() => handleCheckboxToggle(dayName, taskKey, taskData.checked)}
                                style={{
                                  width: 20,
                                  height: 20,
                                  cursor: 'pointer',
                                  accentColor: '#4caf50'
                                }}
                              />
                            </TooltipTrigger>
                            {taskData.checked && taskData.userAlias && (
                              <TooltipContent>
                                <div style={{ fontSize: 12 }}>
                                  <div>✓ {taskData.userAlias}</div>
                                  {taskData.timestamp && (
                                    <div style={{ color: '#888' }}>
                                      {format(taskData.timestamp.toDate(), 'dd/MM HH:mm')}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Comments section */}
        <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#555' }}>הערות:</div>
          {[0, 1].map(commentIndex => {
            const comment = dayData.comments?.[commentIndex];
            return (
              <TooltipProvider key={commentIndex}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <input
                      type="text"
                      defaultValue={comment?.text || ''}
                      onBlur={(e) => handleCommentUpdate(dayName, commentIndex, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      placeholder={`הערה ${commentIndex + 1}`}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 13,
                        border: '1px solid #ddd',
                        borderRadius: 6,
                        marginBottom: 6,
                        textOverflow: 'ellipsis',
                        direction: 'rtl'
                      }}
                    />
                  </TooltipTrigger>
                  {comment?.text && comment.text.length > 30 && (
                    <TooltipContent>
                      <div style={{ maxWidth: 300, fontSize: 12 }}>
                        <div>{comment.text}</div>
                        {comment.userAlias && (
                          <div style={{ marginTop: 4, color: '#888' }}>
                            {comment.userAlias} - {comment.timestamp && format(comment.timestamp.toDate(), 'dd/MM HH:mm')}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isVisible) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', fontSize: 16, color: '#888' }}>
        טוען משימות...
      </div>
    );
  }

  return (
    <div style={{
      background: '#f8fafc',
      padding: isMobile ? '12px' : '16px',
      borderRadius: 12,
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      marginBottom: 16,
      direction: 'rtl'
    }}>
      {/* Header with navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#3b3b3b', margin: 0 }}>
          משימות קבועות שבועיות
        </h2>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={goToPrevWeek}
            style={{
              background: '#bee4e5',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600
            }}
          >
            <ChevronRight size={18} />
            שבוע קודם
          </button>
          
          <button
            onClick={goToCurrentWeek}
            style={{
              background: '#cfe8bc',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            השבוע
          </button>
          
          <button
            onClick={goToNextWeek}
            style={{
              background: '#bee4e5',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600
            }}
          >
            שבוע הבא
            <ChevronLeft size={18} />
          </button>
          
          <button
            onClick={onToggleVisibility}
            style={{
              background: '#eaccd8',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600
            }}
          >
            <EyeOff size={18} />
            הסתר
          </button>
        </div>
      </div>

      {/* Week info */}
      <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 14, color: '#666' }}>
        {format(currentWeekStart, 'dd/MM/yyyy', { locale: he })} - {format(addDays(currentWeekStart, 4), 'dd/MM/yyyy', { locale: he })}
      </div>

      {/* Days container */}
      {isMobile ? (
        // Mobile: Single day with navigation
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            {DAYS.map((day, index) => (
              <button
                key={day}
                onClick={() => setCurrentDayIndex(index)}
                style={{
                  background: currentDayIndex === index ? CARD_COLORS[index] : '#e0e0e0',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: currentDayIndex === index ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {renderDayCard(DAYS[currentDayIndex], currentDayIndex)}
          </div>
        </div>
      ) : (
        // Desktop: All 5 days in a row
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          overflowX: 'auto'
        }}>
          {DAYS.map((day, index) => renderDayCard(day, index))}
        </div>
      )}
    </div>
  );
}

