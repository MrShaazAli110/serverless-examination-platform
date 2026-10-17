import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { Dashboard } from './pages/Dashboard';
import { ExamCatalog } from './pages/ExamCatalog';
import { ExamRoom } from './pages/ExamRoom';
import { ExamResult } from './pages/ExamResult';
import { ExamCreator } from './pages/ExamCreator';
import { Analytics } from './pages/Analytics';
import { StudentHistory } from './pages/StudentHistory';
import { SuperAdminConsole } from './pages/SuperAdminConsole';

function AppContent() {
  const { authModalOpen, setAuthModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '').trim();
    const validTabs = ['dashboard', 'catalog', 'creator', 'analytics', 'history', 'admin'];
    return validTabs.includes(hash) ? hash : 'dashboard';
  });
  const [activeExamId, setActiveExamId] = useState(null);
  const [activeAttemptId, setActiveAttemptId] = useState(null);

  // Sync hash on navigation
  useEffect(() => {
    if (['dashboard', 'catalog', 'creator', 'analytics', 'history', 'admin'].includes(activeTab)) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Listen to browser forward/back hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const validTabs = ['dashboard', 'catalog', 'creator', 'analytics', 'history', 'admin'];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Nav Handlers
  const handleSelectExam = (exam) => {
    setActiveExamId(exam.id);
    setActiveTab('room');
  };

  const handleExamCompleted = (attemptId) => {
    setActiveAttemptId(attemptId);
    setActiveTab('result');
  };

  const handleViewResult = (attemptId) => {
    setActiveAttemptId(attemptId);
    setActiveTab('result');
  };

  const handleRetakeExam = (examId) => {
    setActiveExamId(examId);
    setActiveTab('room');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hide standard navbar when candidate is inside live proctored exam room */}
      {activeTab !== 'room' && (
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      <main style={{ flex: 1, paddingBottom: activeTab === 'room' ? 0 : '3rem' }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            setActiveTab={setActiveTab}
            onSelectExam={handleSelectExam}
            onViewResult={handleViewResult}
          />
        )}

        {activeTab === 'catalog' && (
          <ExamCatalog
            onSelectExam={handleSelectExam}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'room' && activeExamId && (
          <ExamRoom
            examId={activeExamId}
            onExamCompleted={handleExamCompleted}
            onExit={() => setActiveTab('catalog')}
          />
        )}

        {activeTab === 'result' && activeAttemptId && (
          <ExamResult
            attemptId={activeAttemptId}
            onRetake={handleRetakeExam}
            onBackToCatalog={() => setActiveTab('catalog')}
          />
        )}

        {activeTab === 'creator' && (
          <ExamCreator
            onExamCreated={() => setActiveTab('catalog')}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'analytics' && (
          <Analytics
            onViewResult={handleViewResult}
          />
        )}

        {activeTab === 'history' && (
          <StudentHistory
            onViewResult={handleViewResult}
            onSelectExam={handleSelectExam}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'admin' && (
          <SuperAdminConsole />
        )}
      </main>

      {/* Global Footer (Hidden in Exam Room) */}
      {activeTab !== 'room' && (
        <footer style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: '0.8rem',
          marginTop: 'auto'
        }}>
          <div>
            <strong>ExamSphere Pro</strong> — Serverless Proctored Online Examination System
          </div>
          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>
            Built with React & Supabase Serverless Cloud Database • AI Proctoring & Real-Time Integrity Shield Active
          </div>
        </footer>
      )}

      {/* Global Authentication & Registration Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
