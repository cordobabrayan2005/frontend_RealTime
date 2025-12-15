import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import UserManual from "./pages/UserManual";
import RealTime from "./pages/RealTime";
import About from "./pages/About";
import Sidebar from "./components/Sidebar";
import Sitemap from "./components/Sitemap";
import { api } from "./services/api";
import Profile from "./pages/Profile";
import VideoCall from "./pages/Videocall";
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * Root application component that mounts the routing shell inside a browser router.
 *
 * @returns {JSX.Element} React application entry point.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

/**
 * Shell routing layer that renders navigation controls, guarded routes, and layout chrome.
 *
 * @returns {JSX.Element} Shell layout for authenticated and public routes.
 */
function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const showSitemap = location.pathname !== '/videocall';
  const { isAuthed, logout, checkAuth } = useAuthStore();  

  /**
   * Performs initial authentication checks and subscribes to sidebar toggle events.
   */
  useEffect(() => {
    checkAuth();
    function onToggle() {
      setSidebarOpen((s) => !s);
    }
    window.addEventListener("toggleSidebar", onToggle as EventListener);
    return () => window.removeEventListener("toggleSidebar", onToggle as EventListener);
  }, []);

  /**
   * Closes the sidebar if it is currently open.
   */
  function handleClose() {
    setSidebarOpen(false);
  }

  /**
   * Logs out the current user and returns to the login route.
   */
  function handleLogout() {
    logout();
    handleClose();
    navigate("/login");
  }

  return (
    <div className={`app ${sidebarOpen ? "sidebar-open" : ""}`}>
      <Sidebar isOpen={sidebarOpen} onClose={handleClose} onLogout={handleLogout} isAuthed={isAuthed} />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/realtime" element={<ProtectedRoute><RealTime /></ProtectedRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="/videocall" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/user-manual" element={<UserManual />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </main>
      
      {showSitemap && <Sitemap />}
    </div>
  );
}