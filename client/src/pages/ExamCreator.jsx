import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  Save, 
  Sparkles, 
  ShieldCheck, 
  Code2, 
  CheckCircle, 
  HelpCircle,
  Clock,
  Layers,
  ArrowLeft
} from 'lucide-react';

export const ExamCreator = ({ onExamCreated, onCancel }) => {
  const { currentUser, isExaminer, setAuthModalOpen } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser || !isExaminer) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '500px', margin: '0 auto', padding: '3rem 2rem' }}>
          <ShieldCheck size={48} color="#8b5cf6" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
            Examiner Authorization Required
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Only certified instructors and administrators can create assessments. Please sign in with an Examiner account.
          </p>
          <button onClick={() => setAuthModalOpen(true)} className="btn btn-primary btn-lg">
            Sign In as Examiner
          </button>
        </div>
      </div>
    );
  }

  // Exam Meta
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software Engineering');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passingPercentage, setPassingPercentage] = useState(60);
  const [negativeMarking, setNegativeMarking] = useState(true);
  const [negativeMarks, setNegativeMarks] = useState(0.5);
  const [tabSwitchLimit, setTabSwitchLimit] = useState(3);
  const [fullscreenRequired, setFullscreenRequired] = useState(true);
  const [webcamRequired, setWebcamRequired] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  // Questions List
  const [questions, setQuestions] = useState([
    {
      id: 'q1',
      question_text: '',
      question_type: 'single_choice',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correct_answers: ['Option 1'],
      explanation: '',
      marks: 5,
      negative_marks: 0,
      difficulty: 'medium',
      code_snippet: '',
    },
  ]);

  const handleAddQuestion = () => {
    const newQ = {
      id: 'q_' + Math.random().toString(36).substring(2, 8),
      question_text: '',
      question_type: 'single_choice',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correct_answers: ['Option 1'],
      explanation: '',
      marks: 5,
      negative_marks: 1,
      difficulty: 'medium',
      code_snippet: '',
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      alert('An assessment must have at least one question.');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleUpdateQuestion = (idx, field, value) => {
    const updated = [...questions];
    updated[idx][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx, optIdx, val) => {
    const updated = [...questions];
    const oldVal = updated[qIdx].options[optIdx];
    updated[qIdx].options[optIdx] = val;

    // Update in correct answers if it was selected
    if (updated[qIdx].correct_answers.includes(oldVal)) {
      updated[qIdx].correct_answers = updated[qIdx].correct_answers.map(ans => ans === oldVal ? val : ans);
    }
    setQuestions(updated);
  };

  const handleAddOption = (qIdx) => {
    const updated = [...questions];
    const newOpt = `Option ${updated[qIdx].options.length + 1}`;
    updated[qIdx].options.push(newOpt);
    setQuestions(updated);
  };

  const handleRemoveOption = (qIdx, optIdx) => {
    const updated = [...questions];
    if (updated[qIdx].options.length <= 2) {
      alert('Must have at least 2 options.');
      return;
    }
    const removedVal = updated[qIdx].options[optIdx];
    updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== optIdx);
    updated[qIdx].correct_answers = updated[qIdx].correct_answers.filter(ans => ans !== removedVal);
    if (updated[qIdx].correct_answers.length === 0 && updated[qIdx].options.length > 0) {
      updated[qIdx].correct_answers = [updated[qIdx].options[0]];
    }
    setQuestions(updated);
  };

  const handleToggleCorrectOption = (qIdx, opt) => {
    const updated = [...questions];
    const q = updated[qIdx];

    if (q.question_type === 'single_choice' || q.question_type === 'true_false') {
      q.correct_answers = [opt];
    } else if (q.question_type === 'multi_choice') {
      if (q.correct_answers.includes(opt)) {
        if (q.correct_answers.length > 1) {
          q.correct_answers = q.correct_answers.filter(a => a !== opt);
        }
      } else {
        q.correct_answers.push(opt);
      }
    }
    setQuestions(updated);
  };

  const calculateTotalMarks = () => {
    return questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  };

  const handleSubmitExam = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter an exam title.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question_text.trim()) {
        alert(`Question #${i + 1} is missing question text.`);
        return;
      }
      if (questions[i].question_type !== 'short_answer' && questions[i].correct_answers.length === 0) {
        alert(`Question #${i + 1} must have at least one marked correct answer.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const examPayload = {
        title,
        description,
        category,
        duration_minutes: Number(durationMinutes),
        total_marks: calculateTotalMarks(),
        passing_percentage: Number(passingPercentage),
        negative_marking: Boolean(negativeMarking),
        negative_marks_per_question: Number(negativeMarks),
        tab_switch_limit: Number(tabSwitchLimit),
        fullscreen_required: Boolean(fullscreenRequired),
        webcam_required: Boolean(webcamRequired),
        access_code: accessCode.trim(),
        created_by: currentUser?.id || null,
        questions: questions.map((q, idx) => ({
          ...q,
          order_index: idx + 1,
        })),
      };

      const res = await api.createExam(examPayload);
      if (res.success) {
        alert('Assessment created and saved successfully to Supabase Database!');
        onExamCreated();
      } else {
        alert('Failed to save exam: ' + res.message);
      }
    } catch (err) {
      console.error('Error creating exam:', err);
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onCancel} className="btn btn-secondary btn-sm" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            Assessment Authoring Studio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Design high-integrity proctored assessments and dynamic question banks.
          </p>
        </div>

        <button
          onClick={handleSubmitExam}
          disabled={submitting}
          className="btn btn-primary btn-lg"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
        >
          <Save size={18} />
          {submitting ? 'Saving to Database...' : 'Publish Assessment'}
        </button>
      </div>

      <form onSubmit={handleSubmitExam} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Exam Configuration Card */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="#818cf8" /> Assessment Specifications
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Assessment Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Distributed Systems & Microservice Architecture"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Technical Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select"
              >
                <option value="Software Engineering">Software Engineering</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Cloud & DevOps">Cloud & DevOps</option>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Cyber Security">Cyber Security</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              Assessment Description & Instructions
            </label>
            <textarea
              placeholder="Outline test scope, prerequisites, and instructions for candidates..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea"
              rows={3}
            />
          </div>

          {/* Test Parameters Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="240"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Passing Threshold (%)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={passingPercentage}
                onChange={(e) => setPassingPercentage(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Tab-Switch Violation Limit
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={tabSwitchLimit}
                onChange={(e) => setTabSwitchLimit(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Access Passcode (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank for open entry"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Anti-Cheating Toggles */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
              />
              <span>Enable Negative Marking (-{negativeMarks} marks)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={fullscreenRequired}
                onChange={(e) => setFullscreenRequired(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
              />
              <span>Enforce Fullscreen Mode</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={webcamRequired}
                onChange={(e) => setWebcamRequired(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
              />
              <span>Enable AI Webcam Proctoring</span>
            </label>
          </div>
        </div>

        {/* Questions Builder Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                Questions ({questions.length}) — Total {calculateTotalMarks()} Marks
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Add single-choice, multiple-choice, true/false, or code-based questions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="btn btn-secondary"
            >
              <Plus size={16} /> Add Another Question
            </button>
          </div>

          {questions.map((q, qIndex) => (
            <div key={q.id || qIndex} className="glass-panel" style={{ padding: '1.75rem', position: 'relative' }}>
              {/* Question Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.85rem' }}>
                  Question #{qIndex + 1}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <select
                    value={q.question_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let defaultOpts = q.options;
                      let defaultAns = q.correct_answers;

                      if (newType === 'true_false') {
                        defaultOpts = ['True', 'False'];
                        defaultAns = ['True'];
                      }
                      handleUpdateQuestion(qIndex, 'question_type', newType);
                      handleUpdateQuestion(qIndex, 'options', defaultOpts);
                      handleUpdateQuestion(qIndex, 'correct_answers', defaultAns);
                    }}
                    className="select"
                    style={{ width: '170px', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                  >
                    <option value="single_choice">Single Choice (Radio)</option>
                    <option value="multi_choice">Multi-Choice (Checkbox)</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short Answer</option>
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Marks:</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={q.marks}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'marks', e.target.value)}
                      className="input"
                      style={{ width: '65px', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIndex)}
                    className="btn btn-outline-danger btn-sm"
                    title="Remove Question"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div style={{ marginBottom: '1rem' }}>
                <textarea
                  placeholder="Enter the question text..."
                  value={q.question_text}
                  onChange={(e) => handleUpdateQuestion(qIndex, 'question_text', e.target.value)}
                  className="textarea"
                  rows={2}
                  style={{ fontWeight: 600 }}
                  required
                />
              </div>

              {/* Code Snippet input (Optional) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                  <Code2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Optional Code Snippet
                </label>
                <textarea
                  placeholder="// Paste optional code reference here..."
                  value={q.code_snippet || ''}
                  onChange={(e) => handleUpdateQuestion(qIndex, 'code_snippet', e.target.value)}
                  className="textarea"
                  rows={2}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>

              {/* Options & Correct Answer Selection */}
              {q.question_type !== 'short_answer' ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Options & Correct Answers (Click badge to designate correct answers):
                    </span>
                    {q.question_type !== 'true_false' && (
                      <button
                        type="button"
                        onClick={() => handleAddOption(qIndex)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Plus size={12} /> Add Option
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map((opt, optIndex) => {
                      const isCorrect = q.correct_answers.includes(opt);
                      const letter = String.fromCharCode(65 + optIndex);

                      return (
                        <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleCorrectOption(qIndex, opt)}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              border: isCorrect ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                              background: isCorrect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                              color: isCorrect ? '#34d399' : 'var(--text-dim)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            title={isCorrect ? 'Marked as Correct' : 'Click to mark correct'}
                          >
                            {isCorrect ? <CheckCircle size={18} /> : letter}
                          </button>

                          <input
                            type="text"
                            value={opt}
                            disabled={q.question_type === 'true_false'}
                            onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                            className="input"
                            style={{ flex: 1 }}
                            required
                          />

                          {q.question_type !== 'true_false' && q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIndex, optIndex)}
                              className="btn btn-outline-danger btn-sm"
                              style={{ padding: '0.5rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Accepted Correct Answer(s) (Exact or comma-separated variants):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. O(log N), binary search"
                    value={Array.isArray(q.correct_answers) ? q.correct_answers.join(', ') : q.correct_answers}
                    onChange={(e) => {
                      const split = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      handleUpdateQuestion(qIndex, 'correct_answers', split);
                    }}
                    className="input"
                    required
                  />
                </div>
              )}

              {/* Explanation Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                  Solution Explanation (Displayed to candidates after assessment completion):
                </label>
                <input
                  type="text"
                  placeholder="Explain why this answer is correct..."
                  value={q.explanation || ''}
                  onChange={(e) => handleUpdateQuestion(qIndex, 'explanation', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleAddQuestion}
            className="btn btn-secondary"
          >
            <Plus size={16} /> Add Question
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-lg"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
          >
            <Save size={18} />
            {submitting ? 'Saving to Database...' : 'Publish Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
};
