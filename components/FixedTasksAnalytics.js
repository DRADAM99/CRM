"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getWeek, getYear, startOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const BASE_ROWS = ["ייעוצים", "מתחילים", "מפגשים", "גביה"];
const COLUMNS = ["מודיעין", "רעננה", "עין דור"];
const BASE_TASKS_PER_DAY = BASE_ROWS.length * COLUMNS.length; // 12 tasks

// Helper to get rows for a specific date (including special dates)
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

// Helper to count expected tasks for a date
function getExpectedTasksForDate(date) {
  const rows = getRowsForDate(date);
  return rows.length * COLUMNS.length;
}

// Helper to get week ID for Firebase
function getWeekId(date) {
  const year = getYear(date);
  const week = getWeek(date, { locale: he });
  return `${year}-W${week}`;
}

export default function FixedTasksAnalytics({ timeFilter = 'month', filterFrom, filterTo }) {
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    let start, end;

    switch (timeFilter) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'custom':
        start = filterFrom ? new Date(filterFrom) : startOfMonth(now);
        end = filterTo ? new Date(filterTo) : endOfMonth(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    return { start, end };
  }, [timeFilter, filterFrom, filterTo]);

  // Load data from Firebase
  useEffect(() => {
    const loadWeeklyData = async () => {
      setLoading(true);
      try {
        // Get all days in the range
        const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
        
        // Get unique week IDs
        const weekIds = [...new Set(days.map(day => getWeekId(startOfWeek(day, { locale: he }))))];
        
        // Fetch all week documents
        const weekDocsPromises = weekIds.map(async (weekId) => {
          const weekRef = collection(db, 'fixedTasksWeekly');
          const q = query(weekRef, where('__name__', '==', weekId));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) return null;
          
          return {
            weekId,
            data: snapshot.docs[0].data()
          };
        });

        const weekDocs = (await Promise.all(weekDocsPromises)).filter(Boolean);
        setWeeklyData(weekDocs);
      } catch (error) {
        console.error('Error loading fixed tasks analytics:', error);
      }
      setLoading(false);
    };

    loadWeeklyData();
  }, [dateRange]);

  // Calculate statistics
  const analytics = useMemo(() => {
    if (weeklyData.length === 0) {
      return {
        dailyStats: [],
        totalExpected: 0,
        totalCompleted: 0,
        completionRate: 0,
        incompleteCount: 0,
        specialTasksStats: {}
      };
    }

    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שבת", "שישי"];
    
    const dailyStats = days.map(day => {
      const dayOfWeek = day.getDay();
      const dayName = dayNames[dayOfWeek];
      
      // Skip weekends (Friday=5, Saturday=6)
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        return null;
      }

      const weekStart = startOfWeek(day, { locale: he });
      const weekId = getWeekId(weekStart);
      const weekDoc = weeklyData.find(w => w.weekId === weekId);
      
      if (!weekDoc || !weekDoc.data.days || !weekDoc.data.days[dayName]) {
        return {
          date: day,
          dayName,
          expected: getExpectedTasksForDate(day),
          completed: 0,
          completionRate: 0,
          isIncomplete: true,
          tasks: {},
          specialTasks: []
        };
      }

      const dayData = weekDoc.data.days[dayName];
      const tasks = dayData.tasks || {};
      const rows = getRowsForDate(day);
      const expected = rows.length * COLUMNS.length;
      
      // Count completed tasks
      let completed = 0;
      const taskDetails = {};
      const specialTasks = [];
      
      rows.forEach(row => {
        COLUMNS.forEach(col => {
          const taskKey = `${row}-${col}`;
          const task = tasks[taskKey];
          if (task && task.checked) {
            completed++;
            taskDetails[taskKey] = task;
          }
          
          // Track special tasks
          if (row === 'דוחות' || row === 'זיכויים') {
            specialTasks.push({
              key: taskKey,
              name: `${row} - ${col}`,
              completed: task && task.checked,
              user: task?.userAlias || null
            });
          }
        });
      });

      const completionRate = expected > 0 ? (completed / expected) * 100 : 0;

      return {
        date: day,
        dayName,
        expected,
        completed,
        completionRate,
        isIncomplete: completionRate < 100,
        tasks: taskDetails,
        specialTasks
      };
    }).filter(Boolean);

    const totalExpected = dailyStats.reduce((sum, day) => sum + day.expected, 0);
    const totalCompleted = dailyStats.reduce((sum, day) => sum + day.completed, 0);
    const completionRate = totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0;
    const incompleteCount = dailyStats.filter(day => day.isIncomplete).length;

    // Special tasks statistics
    const specialTasksStats = {};
    dailyStats.forEach(day => {
      day.specialTasks.forEach(task => {
        if (!specialTasksStats[task.name]) {
          specialTasksStats[task.name] = { total: 0, completed: 0, users: [] };
        }
        specialTasksStats[task.name].total++;
        if (task.completed) {
          specialTasksStats[task.name].completed++;
          if (task.user) {
            specialTasksStats[task.name].users.push(task.user);
          }
        }
      });
    });

    return {
      dailyStats,
      totalExpected,
      totalCompleted,
      completionRate,
      incompleteCount,
      specialTasksStats
    };
  }, [weeklyData, dateRange]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        טוען נתוני משימות קבועות...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h3 className="text-lg font-bold mb-4 text-center">ניתוח משימות קבועות</h3>
        
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{analytics.totalCompleted}</div>
              <div className="text-sm text-gray-600">משימות בוצעו</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{analytics.totalExpected}</div>
              <div className="text-sm text-gray-600">סה"כ משימות</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${analytics.completionRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                {analytics.completionRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">אחוז השלמה</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${analytics.incompleteCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {analytics.incompleteCount}
              </div>
              <div className="text-sm text-gray-600">ימים לא הושלמו</div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-right font-semibold">תאריך</th>
                <th className="border p-2 text-center font-semibold">יום</th>
                <th className="border p-2 text-center font-semibold">משימות מצופות</th>
                <th className="border p-2 text-center font-semibold">בוצעו</th>
                <th className="border p-2 text-center font-semibold">אחוז השלמה</th>
                <th className="border p-2 text-right font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {analytics.dailyStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border p-4 text-center text-gray-500">
                    אין נתונים לתקופה זו
                  </td>
                </tr>
              ) : (
                analytics.dailyStats.map((day, index) => {
                  const isComplete = day.completionRate === 100;
                  const isPartial = day.completionRate > 0 && day.completionRate < 100;
                  const rowColor = isComplete ? 'bg-green-50' : isPartial ? 'bg-yellow-50' : 'bg-red-50';
                  
                  return (
                    <tr key={index} className={rowColor}>
                      <td className="border p-2 text-right">{format(day.date, 'dd/MM/yyyy', { locale: he })}</td>
                      <td className="border p-2 text-center font-medium">{day.dayName}</td>
                      <td className="border p-2 text-center">{day.expected}</td>
                      <td className="border p-2 text-center font-bold">{day.completed}</td>
                      <td className="border p-2 text-center">
                        <span className={`font-bold ${isComplete ? 'text-green-700' : isPartial ? 'text-orange-600' : 'text-red-600'}`}>
                          {day.completionRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="border p-2 text-right">
                        {isComplete ? (
                          <span className="text-green-700 font-medium">✓ הושלם</span>
                        ) : isPartial ? (
                          <span className="text-orange-600 font-medium">⚠ חלקי</span>
                        ) : (
                          <span className="text-red-600 font-medium">✗ לא בוצע</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Special Tasks Summary */}
        {Object.keys(analytics.specialTasksStats).length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-3">משימות מיוחדות (דוחות / זיכויים)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(analytics.specialTasksStats).map(([taskName, stats]) => {
                const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                return (
                  <Card key={taskName}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{taskName}</span>
                        <span className={`font-bold ${completionRate === 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {completionRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {stats.completed} מתוך {stats.total} בוצעו
                      </div>
                      {stats.users.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          מבצעים: {[...new Set(stats.users)].join(', ')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

