import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Header from "./components/layout/Header";
import Auth from "./pages/Auth";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import Session from "./pages/Session";
import Attend from "./pages/Attend";
import AttendanceHistory from "./pages/AttendanceHistory";
import StudentAuth from "./pages/StudentAuth";
import StudentDashboard from "./pages/StudentDashboard";
import GetStarted from "./pages/GetStarted";
import ClassMessages from "./pages/ClassMessages";
import ModifyClass from "./pages/ModifyClass";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<GetStarted />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/student-auth" element={<StudentAuth />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/classes/:id" element={<ClassDetail />} />
          <Route path="/classes/:id/history" element={<AttendanceHistory />} />
          <Route path="/classes/:id/messages" element={<ClassMessages />} />
          <Route path="/classes/:id/modify" element={<ModifyClass />} />
          <Route path="/session/:sessionId" element={<Session />} />
          <Route path="/attend/:sessionId" element={<Attend />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
