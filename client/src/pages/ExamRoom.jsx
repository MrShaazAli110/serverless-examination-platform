import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ProctorCamera } from '../components/ProctorCamera';
import { AntiCheatWarningModal } from '../components/AntiCheatWarningModal';
import { 
  Clock, 
  Flag, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Maximize
} from 'lucide-react';

export const ExamRoom = ({ examId, onExamCompleted, onExit }) => {
  const { currentUser } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers & Flags
  // answers: { [questionId]: value (string or array) }
  const [answers, setAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState(30 * 60);
  const timerRef = useRef(null);

  // Anti-Cheat & Proctoring
  const [violationsCount, setViolationsCount] = useState(0);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [activeViolationType, setActiveViolationType] = useState('');
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Submit Modal
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 1. Initialize Exam & Attempt Session
  useEffect(() => {
    let isMounted = true;

    const initExamSession = async () => {
      try {
        setLoading(true);

        // Fetch Exam & questions
        const examRes = await api.getExamById(examId, 'student');
        if (!examRes.success || !examRes.data) {
          alert('Could not load examination data');
          onExit();
          return;
        }

        const examData = examRes.data;
        if (!isMounted) return;

        setExam(examData);
        setQuestions(examData.questions || []);
        setSecondsRemaining((examData.duration_minutes || 30) * 60);

        // Start attempt session in database
        const studentInfo = currentUser ? {
          id: currentUser.id,
          full_name: currentUser.full_name,
          email: currentUser.email,
        } : {
          id: null,
          full_name: 'Guest Candidate',
          email: 'guest@examsphere.io',
        };
        const attemptRes = await api.startAttempt(examId, studentInfo);
        if (attemptRes.success && isMounted) {
          setAttempt(attemptRes.data);
        }

        // Request Fullscreen
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
          }
        } catch (e) {
          console.warn('Fullscreen request blocked or dismissed by user:', e.message);
        }
      } catch (err) {
        console.error('Failed to init exam session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initExamSession();

    return () => {
      isMounted = false;
    };
  }, [examId]);

  // 2. Countdown Timer
  useEffect(() => {
    if (loading || !exam || isDisqualified) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinalSubmit('Time expired - auto submitted');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, exam, isDisqualified]);

  // 3. Proctoring & Anti-Cheating Event Handlers
  const reportViolation = async (type, message) => {
    if (!attempt || isDisqualified) return;

    try {
      const res = await api.logViolation(attempt.id, type, message);
      if (res.success) {
        setViolationsCount(res.violations_count);
        setActiveViolationType(type);
        setWarningModalOpen(true);

        if (res.isDisqualified) {
          setIsDisqualified(true);
          // Auto submit disqualified session
          setTimeout(() => {
            handleFinalSubmit('Disqualified due to exceeding tab switch limit');
          }, 3500);
        }
      }
    } catch (err) {
      console.error('Failed to log violation:', err);
    }
  };

  useEffect(() => {
    // Tab Visibility Change (Tab Switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation('tab_switch', 'Candidate navigated away from the assessment tab');
      }
    };

    // Window Blur (Unfocus window / Alt+Tab)
    const handleBlur = () => {
      reportViolation('window_blur', 'Window lost active focus');
    };

    // Fullscreen Change
    const handleFullscreenChange = () => {
      const inFs = Boolean(document.fullscreenElement);
      setIsFullscreen(inFs);
      if (!inFs && !warningModalOpen && !showSubmitConfirm) {
        reportViolation('fullscreen_exit', 'Candidate exited required fullscreen mode');
      }
    };

    // Disable Right-Click Context Menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Prevent Copy / Cut
    const handleCopy = (e) => {
      e.preventDefault();
      reportViolation('copy_attempt', 'Clipboard copy attempted during exam');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
    };
  }, [attempt, isDisqualified]);

  // Format Time (MM:SS)
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimerCritical = secondsRemaining < 300; // < 5 mins

  // Current Question
  const currentQuestion = questions[currentIndex] || null;

  // Answer handlers
  const handleSelectSingle = (option) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  const handleToggleMulti = (option) => {
    if (!currentQuestion) return;
    const currentSelected = answers[currentQuestion.id] || [];
    let updated;
    if (currentSelected.includes(option)) {
      updated = currentSelected.filter((item) => item !== option);
    } else {
      updated = [...currentSelected, option];
    }
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: updated,
    }));
  };

  const handleTextAnswer = (text) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: text,
    }));
  };

  const handleClearCurrentAnswer = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.id];
      return copy;
    });
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id);
      } else {
        next.add(currentQuestion.id);
      }
      return next;
    });
  };

  // Submit Logic
  const handleFinalSubmit = async (reason = '') => {
    if (submitting || !attempt) return;
    setSubmitting(true);

    try {
      const timeSpentSeconds = (exam.duration_minutes * 60) - secondsRemaining;
      const res = await api.submitAttempt(attempt.id, answers, Math.max(1, timeSpentSeconds));

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (res.success) {
        onExamCompleted(res.data.id);
      } else {
        alert('Submission failed: ' + res.message);
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Error submitting exam:', err);
      alert('Error during submission: ' + err.message);
      setSubmitting(false);
    }
  };

  // Status stats for summary
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flaggedQuestions.size;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-dim)' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '0.5rem' }}>
          Initializing Proctor Shield & Question Stream...
        </h2>
        <p>Connecting to Supabase Database...</p>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2>No questions configured for this examination.</h2>
        <button onClick={onExit} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Return to Catalog
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#070b14' }}>
      {/* Top Examination HUD Bar */}
      <div style={{
        padding: '0.75rem 1.5rem',
        background: '#0d1322',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Exam Title & Subject */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-primary">{exam.category}</span>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
              {exam.title}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Candidate: <strong>{currentUser?.full_name || attempt?.student_name || 'Guest Candidate'}</strong> ({currentUser?.email || attempt?.student_email || 'guest@examsphere.io'})
          </div>
        </div>

        {/* Center: Countdown Timer Widget */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.45rem 1.25rem',
          borderRadius: 'var(--radius-full)',
          background: isTimerCritical ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          border: `1.5px solid ${isTimerCritical ? '#f43f5e' : 'var(--border-subtle)'}`,
        }}
        className={isTimerCritical ? 'timer-critical' : ''}
        >
          <Clock size={18} color={isTimerCritical ? '#f43f5e' : '#818cf8'} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Time Left:</span>
          <span style={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '1.3rem',
            letterSpacing: '0.05em',
            color: isTimerCritical ? '#fb7185' : '#ffffff'
          }}>
            {formatTime(secondsRemaining)}
          </span>
        </div>

        {/* Right Action: Finish & Submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isFullscreen && (
            <button
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen();
                }
              }}
              className="btn btn-secondary btn-sm"
              title="Return to Fullscreen"
            >
              <Maximize size={14} /> Fullscreen
            </button>
          )}

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="btn btn-danger btn-sm"
            style={{ fontWeight: 700 }}
          >
            <Send size={15} /> Finish & Submit Exam
          </button>
        </div>
      </div>

      {/* Main Workspace Layout (2 Columns: Left Question Panel, Right Proctor & Palette) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: '1.5rem',
        padding: '1.5rem',
        flex: 1
      }}>
        {/* Left Column: Active Question Workspace */}
        <div className="glass-panel" style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div>
            {/* Question Top Info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.85rem' }}>
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                  Type: {currentQuestion.question_type.replace('_', ' ')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 600 }}>
                  +{currentQuestion.marks} Marks
                </span>
                {exam.negative_marking && (
                  <span style={{ fontSize: '0.85rem', color: '#fb7185', fontWeight: 600 }}>
                    -{currentQuestion.negative_marks || exam.negative_marks_per_question || 0.5} Negative
                  </span>
                )}
                <button
                  onClick={handleToggleFlag}
                  className={`btn btn-sm ${flaggedQuestions.has(currentQuestion.id) ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    background: flaggedQuestions.has(currentQuestion.id) ? '#a855f7' : undefined,
                    borderColor: flaggedQuestions.has(currentQuestion.id) ? '#c084fc' : undefined,
                  }}
                >
                  <Flag size={14} />
                  {flaggedQuestions.has(currentQuestion.id) ? 'Marked for Review' : 'Review Later'}
                </button>
              </div>
            </div>

            {/* Question Text */}
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              lineHeight: 1.5,
              color: '#ffffff',
              marginBottom: '1.25rem'
            }}>
              {currentQuestion.question_text}
            </h2>

            {/* Code Snippet Box if available */}
            {currentQuestion.code_snippet && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  marginBottom: '0.35rem'
                }}>
                  <Code2 size={13} />
                  Reference Code Block:
                </div>
                <div className="code-block">
                  <pre>{currentQuestion.code_snippet}</pre>
                </div>
              </div>
            )}

            {/* Response Options Selection Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
              {/* Single Choice or True/False */}
              {(currentQuestion.question_type === 'single_choice' || currentQuestion.question_type === 'true_false') && (
                currentQuestion.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSelected = answers[currentQuestion.id] === opt;

                  return (
                    <div
                      key={i}
                      onClick={() => handleSelectSingle(opt)}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="option-badge">{letter}</div>
                      <span style={{ fontSize: '0.95rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                        {opt}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Multi-Choice Checkboxes */}
              {currentQuestion.question_type === 'multi_choice' && (
                currentQuestion.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const selectedArr = answers[currentQuestion.id] || [];
                  const isSelected = selectedArr.includes(opt);

                  return (
                    <div
                      key={i}
                      onClick={() => handleToggleMulti(opt)}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="option-badge" style={{ borderRadius: '6px' }}>{letter}</div>
                      <span style={{ fontSize: '0.95rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                        {opt}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Short Answer / Text Entry */}
              {currentQuestion.question_type === 'short_answer' && (
                <div>
                  <textarea
                    placeholder="Type your concise technical answer here..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleTextAnswer(e.target.value)}
                    className="textarea"
                    rows={4}
                    style={{ fontSize: '0.95rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
                    Automated evaluation supports flexible case-insensitive matching.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation & Action Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.5rem',
            marginTop: '2rem'
          }}>
            <button
              onClick={handleClearCurrentAnswer}
              disabled={!answers[currentQuestion.id]}
              className="btn btn-secondary btn-sm"
              style={{ opacity: answers[currentQuestion.id] ? 1 : 0.4 }}
            >
              <RotateCcw size={14} /> Clear Response
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="btn btn-secondary"
                style={{ opacity: currentIndex === 0 ? 0.4 : 1 }}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="btn btn-primary"
                >
                  Next Question <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="btn btn-success"
                >
                  Review & Submit <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Proctor Feed & Question Status Palette */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Live AI Proctor Camera */}
          <ProctorCamera
            violationsCount={violationsCount}
            isRequired={exam.webcam_required}
          />

          {/* Question Palette Card */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>
              Question Palette
            </h4>

            {/* Grid of question buttons */}
            <div className="palette-grid" style={{ marginBottom: '1.25rem' }}>
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && (!Array.isArray(answers[q.id]) || answers[q.id].length > 0);
                const isFlagged = flaggedQuestions.has(q.id);

                let statusClass = '';
                if (isCurrent) statusClass += ' current';
                if (isFlagged) statusClass += ' flagged';
                if (isAnswered) statusClass += ' answered';

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`palette-node ${statusClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Palette Legend */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.4rem',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '0.75rem',
              fontSize: '0.72rem',
              color: 'var(--text-dim)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }} />
                <span>Answered ({answeredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#a855f7' }} />
                <span>Review ({flaggedCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#6366f1' }} />
                <span>Current</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#475569' }} />
                <span>Unanswered ({unansweredCount})</span>
              </div>
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="glass-card" style={{ padding: '1rem', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Exam Integrity Safeguards
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-dim)' }}>
              <div>• Tab Switch Limit: <strong>{exam.tab_switch_limit || 3} strikes</strong></div>
              <div>• Auto-Save: <strong style={{ color: '#34d399' }}>Active (Local & Server)</strong></div>
              <div>• Session Security: <strong>Proctor Encrypted</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Anti Cheat Warning Modal */}
      <AntiCheatWarningModal
        isOpen={warningModalOpen}
        violationType={activeViolationType}
        violationsCount={violationsCount}
        limit={exam.tab_switch_limit || 3}
        isDisqualified={isDisqualified}
        onAcknowledge={() => setWarningModalOpen(false)}
      />

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ffffff' }}>
              Confirm Assessment Submission
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Are you sure you want to finish? Once submitted, your answers will be automatically evaluated and finalized in the database.
            </p>

            {/* Answer Summary Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              textAlign: 'center',
              gap: '0.5rem'
            }}>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{answeredCount}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Answered</div>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{unansweredCount}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Unanswered</div>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>{flaggedCount}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>For Review</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Return to Exam
              </button>
              <button
                onClick={() => handleFinalSubmit('User confirmed submission')}
                className="btn btn-success"
                disabled={submitting}
              >
                {submitting ? 'Evaluating Answers...' : 'Submit & View Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
