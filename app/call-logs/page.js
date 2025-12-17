"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useData } from "@/app/context/DataContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import CallLogDashboard from "@/components/CallLogDashboard";

export default function CallLogsPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { currentUserData } = useData();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const role = currentUserData?.role || "";

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Redirect to login if not authenticated
    if (!currentUser) {
      router.push("/login");
      return;
    }

    // Check if user is admin (using both patterns from codebase)
    const isAdmin = currentUserData?.role === "admin" || role === "admin";
    if (isAdmin) {
      setAuthorized(true);
    } else if (currentUserData && !isAdmin) {
      // If currentUserData is loaded and not admin, redirect to main dashboard
      router.push("/");
    }
  }, [currentUser, authLoading, currentUserData, role, router]);

  if (authLoading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">לוח בקרת שיחות</h1>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              חזור לדשבורד ←
            </button>
          </div>
          
          {/* Dashboard */}
          <CallLogDashboard />
        </div>
      </div>
    </TooltipProvider>
  );
}

