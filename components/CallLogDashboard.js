"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Phone, Clock, PhoneIncoming, PhoneOutgoing, AlertTriangle, RefreshCw, Play, Pause, Mic, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

// Extensions to monitor
const MONITORED_EXTENSIONS = ["104", "105"];

// Working hours for break detection (8:00 - 18:00)
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;

// Hebrew day names
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Helper to format date for API (YYYY-MM-DD)
function formatDateForApi(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format time for display (HH:MM)
function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Helper to format duration
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Helper to format total duration as HH:MM:SS
function formatTotalDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Get color class for heatmap based on minutes of activity
function getHeatmapColor(minutes) {
  if (minutes === 0) return "bg-gray-200";
  if (minutes <= 5) return "bg-green-100";
  if (minutes <= 15) return "bg-green-300";
  if (minutes <= 30) return "bg-green-500";
  if (minutes <= 45) return "bg-green-600";
  return "bg-green-700";
}

// Get text color for heatmap
function getHeatmapTextColor(minutes) {
  if (minutes <= 15) return "text-gray-700";
  return "text-white";
}

// Get week start date (Sunday)
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get week end date (Saturday)
function getWeekEnd(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

// Get array of dates for a week
function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export default function CallLogDashboard() {
  const { currentUser } = useAuth();
  const { users } = useData();
  
  // State
  const [dateFilter, setDateFilter] = useState("today"); // today, yesterday, custom, week
  const [customDate, setCustomDate] = useState("");
  const [weekStartDate, setWeekStartDate] = useState(() => getWeekStart(new Date()));
  const [callLogs, setCallLogs] = useState({}); // { "104": [...], "105": [...] }
  const [weeklyLogs, setWeeklyLogs] = useState({}); // { "104": { "2024-01-01": [...], ... }, ... }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const hasLoadedFromFirestore = useRef(false);
  
  // Audio playback state
  const [playingCallId, setPlayingCallId] = useState(null);
  const [loadingRecording, setLoadingRecording] = useState(null);
  const audioRef = useRef(null);

  // Get user info by extension
  const extensionUsers = useMemo(() => {
    const mapping = {};
    MONITORED_EXTENSIONS.forEach(ext => {
      // Find user with this extension
      const user = users.find(u => String(u.EXT) === ext);
      mapping[ext] = user ? user.alias : `שלוחה ${ext}`;
    });
    return mapping;
  }, [users]);

  // Fetch users with EXT field from Firestore directly
  const [extensionUserMap, setExtensionUserMap] = useState({});
  
  useEffect(() => {
    const fetchExtensionUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);
        const mapping = {};
        usersSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.EXT) {
            mapping[String(data.EXT)] = data.alias || data.email || `שלוחה ${data.EXT}`;
          }
        });
        setExtensionUserMap(mapping);
      } catch (err) {
        console.error("Error fetching extension users:", err);
      }
    };
    fetchExtensionUsers();
  }, []);

  // Load preferences from Firestore
  useEffect(() => {
    if (!currentUser) return;
    
    const loadPrefs = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          hasLoadedFromFirestore.current = true;
          const d = snap.data();
          if (d.calllog_dateFilter) setDateFilter(d.calllog_dateFilter);
          if (d.calllog_customDate) setCustomDate(d.calllog_customDate);
          if (d.calllog_weekStartDate) setWeekStartDate(new Date(d.calllog_weekStartDate));
        }
        setPrefsLoaded(true);
      } catch (err) {
        console.error("Error loading calllog prefs:", err);
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, [currentUser]);

  // Save preferences to Firestore
  useEffect(() => {
    if (!currentUser || !prefsLoaded) return;
    
    const savePrefs = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          calllog_dateFilter: dateFilter,
          calllog_customDate: customDate,
          calllog_weekStartDate: weekStartDate.toISOString(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error("Error saving calllog prefs:", err);
      }
    };
    savePrefs();
  }, [currentUser, prefsLoaded, dateFilter, customDate, weekStartDate]);

  // Calculate the target date based on filter
  const targetDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateFilter === "today") {
      return today;
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    } else if (dateFilter === "custom" && customDate) {
      return new Date(customDate);
    } else if (dateFilter === "week") {
      return weekStartDate;
    }
    return today;
  }, [dateFilter, customDate, weekStartDate]);

  // Fetch call logs from API for single day
  const fetchCallLogs = useCallback(async () => {
    if (!targetDate || dateFilter === "week") return;
    
    setLoading(true);
    setError(null);
    
    const dateStr = formatDateForApi(targetDate);
    const newLogs = {};
    
    try {
      // Fetch for each extension
      await Promise.all(MONITORED_EXTENSIONS.map(async (ext) => {
        try {
          const response = await fetch("/api/call-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate: dateStr,
              endDate: dateStr,
              extensionNumber: ext
            })
          });
          
          // Check if response is JSON before parsing
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.error(`Non-JSON response for ext ${ext}:`, response.status, response.statusText);
            if (response.status === 504) {
              throw new Error("504 Gateway Timeout - המרכזיה לא הגיבה");
            }
            newLogs[ext] = [];
            return;
          }
          
          const data = await response.json();
          
          if (data.success) {
            newLogs[ext] = data.data || [];
          } else {
            console.error(`Error fetching logs for ext ${ext}:`, data.error);
            newLogs[ext] = [];
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch logs for ext ${ext}:`, fetchErr);
          newLogs[ext] = [];
        }
      }));
      
      setCallLogs(newLogs);
    } catch (err) {
      console.error("Error fetching call logs:", err);
      // Check if this is a 504 timeout error
      if (err.message?.includes("504") || err.message?.includes("timeout")) {
        setError("⏱️ המרכזיה לא הגיבה בזמן - קיימת בעיית חסימת IP בין Vercel למרכזיה. נדרש פנייה לתמיכה של MasterPBX להסרת החסימה.");
      } else {
        setError("שגיאה בטעינת נתוני שיחות - " + (err.message || "נסה שוב מאוחר יותר"));
      }
    } finally {
      setLoading(false);
    }
  }, [targetDate, dateFilter]);

  // Fetch weekly call logs
  const fetchWeeklyLogs = useCallback(async () => {
    if (dateFilter !== "week") return;
    
    setLoading(true);
    setError(null);
    
    const weekDates = getWeekDates(weekStartDate);
    const startDateStr = formatDateForApi(weekDates[0]);
    const endDateStr = formatDateForApi(weekDates[6]);
    
    const newWeeklyLogs = {};
    
    try {
      await Promise.all(MONITORED_EXTENSIONS.map(async (ext) => {
        try {
          const response = await fetch("/api/call-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate: startDateStr,
              endDate: endDateStr,
              extensionNumber: ext
            })
          });
          
          // Check if response is JSON before parsing
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.error(`Non-JSON response for ext ${ext} (weekly):`, response.status, response.statusText);
            if (response.status === 504) {
              throw new Error("504 Gateway Timeout - המרכזיה לא הגיבה");
            }
            newWeeklyLogs[ext] = {};
            weekDates.forEach(d => {
              newWeeklyLogs[ext][formatDateForApi(d)] = [];
            });
            return;
          }
          
          const data = await response.json();
          
          if (data.success) {
            // Group by date
            const logsByDate = {};
            weekDates.forEach(d => {
              logsByDate[formatDateForApi(d)] = [];
            });
            
            (data.data || []).forEach(call => {
              const callDate = call.startDate.split(' ')[0];
              if (logsByDate[callDate]) {
              logsByDate[callDate].push(call);
            }
          });
          
          newWeeklyLogs[ext] = logsByDate;
        } else {
          newWeeklyLogs[ext] = {};
        }
        } catch (fetchErr) {
          console.error(`Failed to fetch weekly logs for ext ${ext}:`, fetchErr);
          newWeeklyLogs[ext] = {};
          weekDates.forEach(d => {
            newWeeklyLogs[ext][formatDateForApi(d)] = [];
          });
        }
      }));
      
      setWeeklyLogs(newWeeklyLogs);
    } catch (err) {
      console.error("Error fetching weekly logs:", err);
      // Check if this is a 504 timeout error
      if (err.message?.includes("504") || err.message?.includes("timeout")) {
        setError("⏱️ המרכזיה לא הגיבה בזמן - קיימת בעיית חסימת IP בין Vercel למרכזיה. נדרש פנייה לתמיכה של MasterPBX להסרת החסימה.");
      } else {
        setError("שגיאה בטעינת נתוני שבוע - " + (err.message || "נסה שוב מאוחר יותר"));
      }
    } finally {
      setLoading(false);
    }
  }, [weekStartDate, dateFilter]);

  // Fetch on mount and when date changes
  useEffect(() => {
    if (prefsLoaded) {
      if (dateFilter === "week") {
        fetchWeeklyLogs();
      } else {
        fetchCallLogs();
      }
    }
  }, [fetchCallLogs, fetchWeeklyLogs, prefsLoaded, dateFilter]);

  // Open recording in PBX portal (fallback since API doesn't work)
  const openRecordingPortal = (call) => {
    // The MasterPBX recording API isn't working via the documented endpoints
    // This opens the PBX portal where recordings can be accessed manually
    // URL format may vary - adjust based on actual PBX portal structure
    const pbxPortalUrl = `https://master.ippbx.co.il/`;
    
    // Show info to user
    const dateStr = call.startDate.split(' ')[0];
    const timeStr = formatTime(call.startDate);
    
    if (confirm(`הקלטות זמינות בפורטל המרכזיה.\n\nפרטי השיחה:\nתאריך: ${dateStr}\nשעה: ${timeStr}\nמזהה: ${call.callId}\n\nלפתוח את פורטל המרכזיה?`)) {
      window.open(pbxPortalUrl, '_blank');
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Calculate stats for an extension
  const calculateStats = useCallback((logs) => {
    if (!logs || logs.length === 0) {
      return {
        totalCalls: 0,
        totalDuration: 0,
        avgDuration: 0,
        incomingCalls: 0,
        outgoingCalls: 0,
        longestBreak: 0,
        hourlyActivity: Array(24).fill(0)
      };
    }

    const totalCalls = logs.length;
    const totalDuration = logs.reduce((sum, call) => sum + (call.durationSeconds || 0), 0);
    const avgDuration = Math.round(totalDuration / totalCalls);
    const incomingCalls = logs.filter(c => c.direction === 'incoming').length;
    const outgoingCalls = logs.filter(c => c.direction === 'outgoing').length;

    // Calculate hourly activity (minutes of calls per hour)
    const hourlyActivity = Array(24).fill(0);
    logs.forEach(call => {
      const startTime = new Date(call.startDate);
      const hour = startTime.getHours();
      const durationMinutes = Math.ceil((call.durationSeconds || 0) / 60);
      hourlyActivity[hour] += durationMinutes;
    });

    // Calculate longest break during work hours
    let longestBreak = 0;
    const sortedLogs = [...logs].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    // Filter logs within work hours
    const workHourLogs = sortedLogs.filter(call => {
      const hour = new Date(call.startDate).getHours();
      return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
    });

    if (workHourLogs.length > 1) {
      for (let i = 1; i < workHourLogs.length; i++) {
        const prevEnd = new Date(workHourLogs[i - 1].endDate);
        const currStart = new Date(workHourLogs[i].startDate);
        const breakMinutes = Math.floor((currStart - prevEnd) / 60000);
        if (breakMinutes > longestBreak) {
          longestBreak = breakMinutes;
        }
      }
    }

    return {
      totalCalls,
      totalDuration,
      avgDuration,
      incomingCalls,
      outgoingCalls,
      longestBreak,
      hourlyActivity
    };
  }, []);

  // Calculate weekly stats
  const calculateWeeklyStats = useCallback((weeklyData) => {
    let totalCalls = 0;
    let totalDuration = 0;
    let totalBreakTime = 0;
    let daysWithCalls = 0;

    Object.values(weeklyData || {}).forEach(dayLogs => {
      if (dayLogs.length > 0) {
        daysWithCalls++;
        const dayStats = calculateStats(dayLogs);
        totalCalls += dayStats.totalCalls;
        totalDuration += dayStats.totalDuration;
        totalBreakTime += dayStats.longestBreak;
      }
    });

    return {
      totalCalls,
      avgCallsPerDay: daysWithCalls > 0 ? Math.round(totalCalls / daysWithCalls) : 0,
      avgBreakTime: daysWithCalls > 0 ? Math.round(totalBreakTime / daysWithCalls) : 0,
      totalDuration,
      daysWithCalls
    };
  }, [calculateStats]);

  // Navigate weeks
  const goToPreviousWeek = () => {
    const prev = new Date(weekStartDate);
    prev.setDate(prev.getDate() - 7);
    setWeekStartDate(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStartDate);
    next.setDate(next.getDate() + 7);
    setWeekStartDate(next);
  };

  const goToCurrentWeek = () => {
    setWeekStartDate(getWeekStart(new Date()));
  };

  // Render heatmap for an extension
  const renderHeatmap = (hourlyActivity) => {
    // Only show work hours (8-18)
    const workHours = [];
    for (let h = WORK_START_HOUR; h <= WORK_END_HOUR; h++) {
      workHours.push({ hour: h, minutes: hourlyActivity[h] || 0 });
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1 justify-center">
          {workHours.map(({ hour, minutes }) => (
            <Tooltip key={hour}>
              <TooltipTrigger asChild>
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center text-xs font-medium cursor-default ${getHeatmapColor(minutes)} ${getHeatmapTextColor(minutes)}`}
                >
                  {hour}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm" dir="rtl">{minutes} דקות פעילות בשעה {hour}:00</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex justify-center gap-2 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-200"></div> 0 דק׳
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-300"></div> 1-15 דק׳
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div> 16-30 דק׳
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-700"></div> 30+ דק׳
          </span>
        </div>
      </div>
    );
  };

  // Render weekly vertical heatmap (like daily view but vertical, one column per day)
  const renderWeeklyHeatmap = (weeklyData, ext) => {
    const weekDates = getWeekDates(weekStartDate).filter((_, idx) => idx !== 6); // Exclude Saturday (index 6)
    const userName = extensionUserMap[ext] || extensionUsers[ext] || `שלוחה ${ext}`;
    const weekStats = calculateWeeklyStats(weeklyData);

    return (
      <Card key={ext} className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg" dir="rtl">
            <Phone className="w-5 h-5" />
            {userName}
            <span className="text-sm font-normal text-gray-500">(שלוחה {ext})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Weekly Stats Summary */}
          <div className="grid grid-cols-3 gap-3 text-center bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <div>
              <div className="text-2xl font-bold text-blue-700">{weekStats.avgCallsPerDay}</div>
              <div className="text-xs text-blue-600">ממוצע שיחות ליום</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-700">{weekStats.totalCalls}</div>
              <div className="text-xs text-purple-600">סה״כ שיחות</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${weekStats.avgBreakTime > 30 ? 'text-red-700' : 'text-green-700'}`}>
                {weekStats.avgBreakTime} דק׳
              </div>
              <div className="text-xs text-gray-600">ממוצע זמן הפסקה</div>
            </div>
          </div>

          {/* Weekly Vertical Heatmap - Each day is a column of hourly bars */}
          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
            <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">פעילות שבועית לפי שעות</h4>
            <div className="flex gap-2 justify-center min-w-max">
              {weekDates.map((date, dayIdx) => {
                const dateStr = formatDateForApi(date);
                const dayLogs = weeklyData[dateStr] || [];
                const dayStats = calculateStats(dayLogs);
                const isToday = formatDateForApi(new Date()) === dateStr;

                // Create array of work hours (8-18)
                const workHours = [];
                for (let h = WORK_START_HOUR; h <= WORK_END_HOUR; h++) {
                  workHours.push({ hour: h, minutes: dayStats.hourlyActivity[h] || 0 });
                }

                return (
                  <div key={dateStr} className={`flex flex-col items-center gap-1 ${isToday ? 'ring-2 ring-blue-500 rounded-lg p-1' : ''}`}>
                    {/* Day header */}
                    <div className="text-center mb-1">
                      <div className="text-xs font-semibold text-gray-700">{HEBREW_DAYS[dayIdx]}</div>
                      <div className="text-xs text-gray-600">{date.getDate()}/{date.getMonth() + 1}</div>
                    </div>
                    
                    {/* Vertical hourly bars */}
                    <div className="flex flex-col-reverse gap-0.5">
                      {workHours.map(({ hour, minutes }) => (
                        <Tooltip key={hour}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-12 h-6 rounded flex items-center justify-center text-[10px] font-medium cursor-default ${getHeatmapColor(minutes)} ${getHeatmapTextColor(minutes)}`}
                            >
                              {hour}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-sm" dir="rtl">
                              {HEBREW_DAYS[dayIdx]} {date.getDate()}/{date.getMonth() + 1}<br/>
                              שעה {hour}:00 - {minutes} דקות
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>

                    {/* Day summary tooltip trigger */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs text-center text-gray-600 cursor-help border-t pt-1 mt-1">
                          {dayStats.totalCalls} שיחות
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="text-right" dir="rtl">
                        <div className="space-y-1">
                          <div className="font-semibold">{HEBREW_DAYS[dayIdx]} {date.toLocaleDateString('he-IL')}</div>
                          <div>סה״כ שיחות: {dayStats.totalCalls}</div>
                          <div>זמן כולל: {formatTotalDuration(dayStats.totalDuration)}</div>
                          <div>ממוצע שיחה: {formatDuration(dayStats.avgDuration)}</div>
                          <div>נכנסות: {dayStats.incomingCalls} | יוצאות: {dayStats.outgoingCalls}</div>
                          <div className={dayStats.longestBreak > 30 ? 'text-red-500' : ''}>
                            זמן הפסקה: {dayStats.longestBreak > 0 ? `${dayStats.longestBreak} דק׳` : '-'}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex justify-center gap-2 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-200"></div> 0 דק׳
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-300"></div> 1-15 דק׳
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div> 16-30 דק׳
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-700"></div> 30+ דק׳
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render stats summary
  const renderStats = (stats) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-700">{stats.totalCalls}</div>
          <div className="text-xs text-blue-600">סה״כ שיחות</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">{formatTotalDuration(stats.totalDuration)}</div>
          <div className="text-xs text-green-600">זמן כולל</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-700">{formatDuration(stats.avgDuration)}</div>
          <div className="text-xs text-purple-600">ממוצע לשיחה</div>
        </div>
        <div className="bg-cyan-50 rounded-lg p-3">
          <div className="flex justify-center gap-2">
            <span className="text-lg font-bold text-cyan-700">{stats.incomingCalls}</span>
            <PhoneIncoming className="w-4 h-4 text-cyan-600" />
            <span className="text-lg font-bold text-orange-700">{stats.outgoingCalls}</span>
            <PhoneOutgoing className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-xs text-gray-600">נכנסות / יוצאות</div>
        </div>
        <div className={`rounded-lg p-3 ${stats.longestBreak > 30 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`text-2xl font-bold ${stats.longestBreak > 30 ? 'text-red-700' : 'text-gray-700'}`}>
            {stats.longestBreak > 0 ? `${stats.longestBreak} דק׳` : '-'}
          </div>
          <div className={`text-xs ${stats.longestBreak > 30 ? 'text-red-600' : 'text-gray-600'} flex items-center justify-center gap-1`}>
            {stats.longestBreak > 30 && <AlertTriangle className="w-3 h-3" />}
            הפסקה ארוכה
          </div>
        </div>
      </div>
    );
  };

  // Render call log table
  const renderCallTable = (logs, extensionNumber) => {
    if (!logs || logs.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          אין שיחות להצגה
        </div>
      );
    }

    return (
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm border-collapse" dir="rtl">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-right font-semibold">שעה</th>
              <th className="px-3 py-2 text-right font-semibold">משך</th>
              <th className="px-3 py-2 text-right font-semibold">כיוון</th>
              <th className="px-3 py-2 text-right font-semibold">מספר</th>
              <th className="px-3 py-2 text-center font-semibold w-20">הקלטה</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 100).map((call, idx) => {
              const isIncoming = call.direction === 'incoming';
              const otherNumber = isIncoming ? call.caller : call.callee;
              const isPlaying = playingCallId === call.id;
              const isLoadingRec = loadingRecording === call.id;
              
              return (
                <tr key={call.id || idx} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{formatTime(call.startDate)}</td>
                  <td className="px-3 py-2">{call.durationFormatted || formatDuration(call.durationSeconds)}</td>
                  <td className="px-3 py-2">
                    {isIncoming ? (
                      <span className="flex items-center gap-1 text-cyan-600">
                        <PhoneIncoming className="w-4 h-4" /> נכנסת
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-orange-600">
                        <PhoneOutgoing className="w-4 h-4" /> יוצאת
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{otherNumber}</td>
                  <td className="px-3 py-2 text-center">
                    {call.hasRecording ? (
                      <div className="flex items-center justify-center gap-1">
                        <Mic className="w-4 h-4 text-green-600" />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openRecordingPortal(call)}
                          title="פתח פורטל להאזנה להקלטה"
                        >
                          <Play className="w-4 h-4 text-blue-600" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logs.length > 100 && (
          <div className="text-center text-gray-500 text-sm py-2">
            מוצגות 100 שיחות מתוך {logs.length}
          </div>
        )}
      </div>
    );
  };

  // Render extension section
  const renderExtensionSection = (ext) => {
    const logs = callLogs[ext] || [];
    const stats = calculateStats(logs);
    const userName = extensionUserMap[ext] || extensionUsers[ext] || `שלוחה ${ext}`;

    return (
      <Card key={ext} className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg" dir="rtl">
            <Phone className="w-5 h-5" />
            {userName}
            <span className="text-sm font-normal text-gray-500">(שלוחה {ext})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Heatmap */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">פעילות לפי שעות (דקות)</h4>
            {renderHeatmap(stats.hourlyActivity)}
          </div>
          
          {/* Stats */}
          {renderStats(stats)}
          
          {/* Call Log Table */}
          <div className="border rounded-lg">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h4 className="text-sm font-medium text-gray-700">יומן שיחות</h4>
            </div>
            {renderCallTable(logs, ext)}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header with Date Filter */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Phone className="w-6 h-6" />
              לוח בקרת שיחות
            </CardTitle>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Filter Buttons */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <Button
                  size="sm"
                  variant={dateFilter === "today" ? "default" : "ghost"}
                  onClick={() => setDateFilter("today")}
                  className="text-sm"
                >
                  היום
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "yesterday" ? "default" : "ghost"}
                  onClick={() => setDateFilter("yesterday")}
                  className="text-sm"
                >
                  אתמול
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "custom" ? "default" : "ghost"}
                  onClick={() => setDateFilter("custom")}
                  className="text-sm"
                >
                  בחר
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "week" ? "default" : "ghost"}
                  onClick={() => setDateFilter("week")}
                  className="text-sm flex items-center gap-1"
                >
                  <Calendar className="w-4 h-4" />
                  שבועי
                </Button>
              </div>
              
              {/* Custom Date Input */}
              {dateFilter === "custom" && (
                <Input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-40 h-9"
                />
              )}

              {/* Week Navigation */}
              {dateFilter === "week" && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={goToPreviousWeek}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={goToCurrentWeek}>
                    השבוע
                  </Button>
                  <Button size="sm" variant="outline" onClick={goToNextWeek}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {/* Refresh Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={dateFilter === "week" ? fetchWeeklyLogs : fetchCallLogs}
                disabled={loading}
                className="gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                רענן
              </Button>
            </div>
          </div>
          
          {/* Display selected date */}
          <div className="text-sm text-gray-600 mt-2">
            <Clock className="w-4 h-4 inline ml-1" />
            {dateFilter === "week" ? (
              <>
                מציג נתונים עבור שבוע: {getWeekDates(weekStartDate)[0].toLocaleDateString("he-IL")} - {getWeekDates(weekStartDate)[6].toLocaleDateString("he-IL")}
              </>
            ) : (
              <>
                מציג נתונים עבור: {targetDate.toLocaleDateString("he-IL", { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-gray-600">
            <RefreshCw className="w-5 h-5 animate-spin" />
            טוען נתוני שיחות...
          </div>
        </div>
      )}

      {/* Weekly View */}
      {!loading && dateFilter === "week" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {MONITORED_EXTENSIONS.map(ext => renderWeeklyHeatmap(weeklyLogs[ext] || {}, ext))}
        </div>
      )}

      {/* Daily View - Extension Sections */}
      {!loading && dateFilter !== "week" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {MONITORED_EXTENSIONS.map(ext => renderExtensionSection(ext))}
        </div>
      )}
    </div>
  );
}
