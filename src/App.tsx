/* The code you provided is importing various modules and components needed for a React application.
Here is a breakdown of each import statement: */
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
import { useAuthStore } from './stores/authStore';  // Nuevo
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * The `App` function in this TypeScript React component manages authentication state, routing, and
 * rendering different components based on the user's authentication status.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

/**
 * Shell component that manages:
 * - Sidebar state (open/close).
 * - Authentication state via `useAuthStore`.
 * - Routing between pages.
 * - Conditional rendering of the sitemap.
 * 
 * @component
 * @returns {JSX.Element} The main application shell with sidebar, routes, and sitemap.
 */
function Shell() {
    /** Sidebar open/close state */
  const [sidebarOpen, setSidebarOpen] = useState(false);

    /** React Router navigation hook */
  const navigate = useNavigate();

    /** React Router location hook */
  const location = useLocation();
  
  // Show sitemap on all pages except the VideoCall route
  const showSitemap = location.pathname !== '/videocall';

    /** Authentication store values and actions */
  const { isAuthed, logout, checkAuth } = useAuthStore();  

  /**
   * Effect hook:
   * - Verifies authentication on app load.
   * - Registers a custom `toggleSidebar` event listener.
   * - Cleans up the event listener on unmount.
   */
  useEffect(() => {
    checkAuth();  // Verify authentication on load
    function onToggle() {
      setSidebarOpen((s) => !s);
    }
    window.addEventListener("toggleSidebar", onToggle as EventListener);
    return () => window.removeEventListener("toggleSidebar", onToggle as EventListener);
  }, []);

  /**
   * Closes the sidebar.
   * 
   * @function handleClose
   * @returns {void}
   */
  function handleClose() {
    setSidebarOpen(false);
  }

  /**
   * Logs out the user, closes the sidebar, and navigates to the login page.
   * 
   * @function handleLogout
   * @returns {void}
   */
  function handleLogout() {
    logout();  // Clear auth state
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