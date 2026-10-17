import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CertificateModal } from '../components/CertificateModal';
import { 
  Award, 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  ShieldAlert, 
  Download,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export const StudentHistory = ({ onViewResult, onSelectExam, setActiveTab }) => {
  const { currentUser, setAuthModalOpen } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertAttempt, setSelectedCertAttempt] = useState(null);

  const fetchHistory = async () => {
    if (!currentUser?.email) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.getStudentHistory(currentUser.email);
      if (res.success) {
        setAttempts(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching student history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser?.email]);

  if (!currentUser) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '500px', margin: '0 auto', padding: '3rem 2rem' }}>
          <Award size={48} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
            Candidate Certifications & Records
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Please sign in to your candidate account to view your completed examination history and download verifiable certificates.
          </p>
          <button onClick={() => setAuthModalOpen(true)} className="btn btn-primary btn-lg">
            Sign In to Account
          </button>
        </div>
      </div>
    );
  }

  const passedAttempts = attempts.filter(a => a.passed);
  const totalScoreEarned = passedAttempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Profile & Achievements Header */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <img
            src={currentUser.avatar_url}
            alt={currentUser.full_name}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              border: '3px solid #6366f1',
              objectFit: 'cover'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
                {currentUser.full_name}
              </h1>
              <span className="badge badge-primary">{currentUser.role}</span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              {currentUser.email} • Candidate ID: #{currentUser?.id ? currentUser.id.slice(-6).toUpperCase() : 'CANDIDATE'}
            </p>
          </div>
        </div>

        {/* Quick summary stats */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1.25rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
              {passedAttempts.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Certificates Earned
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1.25rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#818cf8' }}>
              {attempts.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Total Attempts
            </div>
          </div>
        </div>
      </div>

      {/* Attempts List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
              Exam History & Credentials
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              View all completed sessions, review detailed answers, or download verifiable certificates.
            </p>
          </div>

          <button onClick={() => setActiveTab('catalog')} className="btn btn-primary btn-sm">
            Take Another Assessment <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-dim)' }}>
            Loading candidate test records...
          </div>
        ) : attempts.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center' }}>
            <Award size={48} color="var(--text-dim)" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              No completed assessments yet
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Explore the assessment catalog and pass an exam to earn your industry certificate!
            </p>
            <button onClick={() => setActiveTab('catalog')} className="btn btn-primary">
              Browse Available Exams
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {attempts.map((att) => (
              <div
                key={att.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  borderLeft: `4px solid ${att.passed ? '#10b981' : '#f43f5e'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: att.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: att.passed ? '#34d399' : '#fb7185'
                  }}>
                    {att.passed ? <Award size={26} /> : <XCircle size={26} />}
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.2rem' }}>
                      {att.exam_title || 'Assessment'}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', gap: '1rem' }}>
                      <span>Submitted: {new Date(att.submitted_at || att.created_at).toLocaleDateString()}</span>
                      <span>Time: {Math.round((att.time_spent_seconds || 0) / 60)} mins</span>
                      {att.violations_count > 0 && (
                        <span style={{ color: '#fbbf24' }}>Flags: {att.violations_count}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: att.passed ? '#34d399' : '#fb7185' }}>
                      {att.score} / {att.total_marks} ({att.percentage}%)
                    </div>
                    <span className={`badge ${att.passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                      {att.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {att.passed && (
                      <button
                        onClick={() => setSelectedCertAttempt(att)}
                        className="btn btn-primary btn-sm"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                      >
                        <Award size={14} /> Certificate
                      </button>
                    )}

                    <button
                      onClick={() => onViewResult(att.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Eye size={14} /> View Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificate Modal */}
      {selectedCertAttempt && (
        <CertificateModal
          isOpen={Boolean(selectedCertAttempt)}
          onClose={() => setSelectedCertAttempt(null)}
          attemptData={{
            id: selectedCertAttempt.id,
            student_name: currentUser.full_name,
            score: selectedCertAttempt.score,
            total_marks: selectedCertAttempt.total_marks,
            percentage: selectedCertAttempt.percentage,
            submitted_at: selectedCertAttempt.submitted_at,
            exam_title: selectedCertAttempt.exam_title,
          }}
        />
      )}
    </div>
  );
};
