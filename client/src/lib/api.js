// ExamSphere Pro - Serverless Supabase API Layer
// Fully replaces backend Express server with direct client-to-Supabase architecture

import { supabase, isSupabaseConfigured } from './supabase.js';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_EXAMINER_KEY || 'EXAM_ADMIN_2026';
const SUPER_ADMIN_KEY = import.meta.env.VITE_SUPER_ADMIN_KEY || 'SUPER_ADMIN_2026';

// Browser-native SHA-256 password hashing
async function hashPassword(password) {
  if (!password) return '';
  const msgUint8 = new TextEncoder().encode(String(password));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// PostgreSQL UUID validator (prevents 22P02 invalid input syntax errors)
function isValidUuid(val) {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export const api = {
  // System Health / Supabase Connectivity
  async getHealth() {
    try {
      const { data, error } = await supabase.from('exams').select('id').limit(1);
      return {
        status: error ? 'degraded' : 'online',
        service: 'ExamSphere Serverless (Direct Supabase Cloud)',
        supabaseConnected: !error,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        status: 'offline',
        service: 'ExamSphere Serverless (Direct Supabase Cloud)',
        supabaseConnected: false,
        timestamp: new Date().toISOString(),
      };
    }
  },

  // --- AUTHENTICATION ---
  async login(email, password) {
    try {
      if (!email || !password) {
        return { success: false, message: 'Email and password are required' };
      }

      const formattedEmail = email.toLowerCase().trim();
      const passwordHash = await hashPassword(password);

      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', formattedEmail)
        .single();

      if (error || !user) {
        return {
          success: false,
          message: 'Invalid email or password. Please check your credentials.',
        };
      }

      if (user.password_hash && user.password_hash !== passwordHash) {
        return {
          success: false,
          message: 'Invalid email or password. Please check your credentials.',
        };
      }

      const { password_hash: _, ...safeUser } = user;
      return {
        success: true,
        message: 'Logged in successfully',
        data: {
          user: safeUser,
          token: 'token-' + safeUser.id,
        },
      };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: err.message || 'Login failed' };
    }
  },

  async register({ full_name, email, password, requested_role, admin_secret_key }) {
    try {
      if (!email || !password || !full_name) {
        return {
          success: false,
          message: 'Full name, email, and password are required',
        };
      }

      const formattedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formattedEmail)
        .maybeSingle();

      if (existingUser) {
        return {
          success: false,
          message: 'An account with this email address already exists. Please log in.',
        };
      }

      // Role authorization enforcement
      let assignedRole = 'student';
      if (requested_role === 'examiner') {
        if (!admin_secret_key || admin_secret_key.trim() !== ADMIN_SECRET) {
          return {
            success: false,
            message: 'Invalid Admin Authorization Key. Only authorized administrators can create Examiner accounts.',
          };
        }
        assignedRole = 'examiner';
      }

      const passwordHash = await hashPassword(password);
      const newProfile = {
        email: formattedEmail,
        full_name: full_name.trim(),
        role: assignedRole,
        password_hash: passwordHash,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(formattedEmail)}`,
        created_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select('id, email, full_name, role, avatar_url, created_at')
        .single();

      if (error) {
        console.error('Registration insert error:', error.message);
        return { success: false, message: 'Failed to create profile: ' + error.message };
      }

      return {
        success: true,
        message: 'Account registered successfully',
        data: {
          user: created,
          token: 'token-' + created.id,
        },
      };
    } catch (err) {
      console.error('Registration error:', err);
      return { success: false, message: err.message || 'Registration failed' };
    }
  },

  async makeExaminer(email, admin_secret_key) {
    try {
      if (admin_secret_key !== ADMIN_SECRET) {
        return { success: false, message: 'Unauthorized. Invalid Admin Key.' };
      }

      if (!email) {
        return { success: false, message: 'Target email is required' };
      }

      const formattedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'examiner' })
        .eq('email', formattedEmail)
        .select('id, email, full_name, role')
        .single();

      if (error) {
        return { success: false, message: 'Failed to promote: ' + error.message };
      }

      return {
        success: true,
        message: `User ${email} has been promoted to Examiner by Administrator.`,
        data,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // --- EXAMS CRUD ---
  async getExams(filters = {}) {
    try {
      let query = supabase.from('exams').select('*').order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.category && filters.category !== 'All') {
        query = query.eq('category', filters.category);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data: exams, error } = await query;
      if (error) throw error;

      // Enrich with question count
      const enriched = await Promise.all(
        (exams || []).map(async (exam) => {
          const { data: questions } = await supabase
            .from('questions')
            .select('id')
            .eq('exam_id', exam.id);
          return {
            ...exam,
            question_count: (questions || []).length,
          };
        })
      );

      return { success: true, count: enriched.length, data: enriched };
    } catch (err) {
      console.error('getExams error:', err);
      return { success: false, message: err.message, data: [] };
    }
  },

  async getExamById(id, role = 'student') {
    try {
      const { data: exam, error } = await supabase
        .from('exams')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !exam) {
        return { success: false, message: 'Exam not found' };
      }

      const { data: rawQuestions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', id)
        .order('order_index', { ascending: true });

      if (qErr) throw qErr;

      let questions = rawQuestions || [];

      // Anti-Cheat: Redact correct answers & explanations if taken by a student
      if (role !== 'examiner' && role !== 'admin' && role !== 'super_admin') {
        questions = questions.map((q) => {
          const { correct_answers: _, explanation: __, ...sanitized } = q;
          return sanitized;
        });
      }

      return {
        success: true,
        data: {
          ...exam,
          questions,
          question_count: questions.length,
        },
      };
    } catch (err) {
      console.error('getExamById error:', err);
      return { success: false, message: err.message };
    }
  },

  async createExam(examData) {
    try {
      if (!examData.title) {
        return { success: false, message: 'Title is required' };
      }

      const newExam = {
        title: examData.title,
        description: examData.description || '',
        category: examData.category || 'General',
        duration_minutes: Number(examData.duration_minutes) || 30,
        total_marks: Number(examData.total_marks) || 100,
        passing_percentage: Number(examData.passing_percentage) || 50,
        negative_marking: Boolean(examData.negative_marking),
        negative_marks_per_question: Number(examData.negative_marks_per_question) || 0,
        shuffle_questions: examData.shuffle_questions !== false,
        shuffle_options: examData.shuffle_options !== false,
        tab_switch_limit: Number(examData.tab_switch_limit) || 3,
        fullscreen_required: examData.fullscreen_required !== false,
        webcam_required: Boolean(examData.webcam_required),
        allow_calculator: Boolean(examData.allow_calculator),
        access_code: examData.access_code || null,
        status: examData.status || 'published',
        created_by: isValidUuid(examData.created_by) ? examData.created_by : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabase
        .from('exams')
        .insert([newExam])
        .select()
        .single();

      if (error) throw error;

      // Insert any initial questions
      if (Array.isArray(examData.questions) && examData.questions.length > 0) {
        const questionPayloads = examData.questions.map((q, i) => ({
          exam_id: created.id,
          question_text: q.question_text,
          question_type: q.question_type || 'single_choice',
          options: q.options || [],
          correct_answers: q.correct_answers || [],
          explanation: q.explanation || '',
          marks: Number(q.marks) || 1,
          negative_marks: Number(q.negative_marks) || 0,
          difficulty: q.difficulty || 'medium',
          code_snippet: q.code_snippet || null,
          order_index: i + 1,
          created_at: new Date().toISOString(),
        }));

        await supabase.from('questions').insert(questionPayloads);
      }

      return { success: true, data: created, message: 'Exam created successfully' };
    } catch (err) {
      console.error('createExam error:', err);
      return { success: false, message: err.message };
    }
  },

  async updateExam(id, updateData) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, message: 'Exam updated successfully' };
    } catch (err) {
      console.error('updateExam error:', err);
      return { success: false, message: err.message };
    }
  },

  async deleteExam(id) {
    try {
      // Clean up relations first
      await supabase.from('questions').delete().eq('exam_id', id);
      await supabase.from('exam_attempts').delete().eq('exam_id', id);
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      return { success: true, message: 'Exam deleted successfully' };
    } catch (err) {
      console.error('deleteExam error:', err);
      return { success: false, message: err.message };
    }
  },

  async addQuestion(examId, questionData) {
    try {
      const newQuestion = {
        exam_id: examId,
        question_text: questionData.question_text,
        question_type: questionData.question_type || 'single_choice',
        options: questionData.options || [],
        correct_answers: questionData.correct_answers || [],
        explanation: questionData.explanation || '',
        marks: Number(questionData.marks) || 1,
        negative_marks: Number(questionData.negative_marks) || 0,
        difficulty: questionData.difficulty || 'medium',
        code_snippet: questionData.code_snippet || null,
        order_index: Number(questionData.order_index) || 0,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('questions')
        .insert([newQuestion])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, message: 'Question added' };
    } catch (err) {
      console.error('addQuestion error:', err);
      return { success: false, message: err.message };
    }
  },

  async deleteQuestion(id) {
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      return { success: true, message: 'Question deleted' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // --- ATTEMPTS & PROCTORING ENGINE ---
  async startAttempt(examId, student) {
    try {
      const { data: exam, error: examErr } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examErr || !exam) {
        return { success: false, message: 'Exam not found' };
      }

      const newAttempt = {
        exam_id: examId,
        student_id: isValidUuid(student?.id) ? student.id : null,
        student_name: student?.full_name || 'Anonymous Student',
        student_email: student?.email || 'student@examsphere.io',
        started_at: new Date().toISOString(),
        submitted_at: null,
        time_spent_seconds: 0,
        score: 0,
        total_marks: Number(exam.total_marks) || 100,
        percentage: 0,
        passed: false,
        answers: {},
        violations_count: 0,
        violations_log: [],
        status: 'in_progress',
        feedback: '',
        created_at: new Date().toISOString(),
      };

      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .insert([newAttempt])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: attempt,
        exam: {
          id: exam.id,
          title: exam.title,
          duration_minutes: exam.duration_minutes,
          total_marks: exam.total_marks,
          tab_switch_limit: exam.tab_switch_limit,
          fullscreen_required: exam.fullscreen_required,
          webcam_required: exam.webcam_required,
        },
      };
    } catch (err) {
      console.error('startAttempt error:', err);
      return { success: false, message: err.message };
    }
  },

  async logViolation(attemptId, violationType, message) {
    try {
      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();

      if (error || !attempt) {
        return { success: false, message: 'Attempt not found' };
      }

      const { data: exam } = await supabase
        .from('exams')
        .select('tab_switch_limit')
        .eq('id', attempt.exam_id)
        .single();

      const limit = exam ? exam.tab_switch_limit || 3 : 3;
      const newViolationsCount = (attempt.violations_count || 0) + 1;
      const newLog = [
        ...(attempt.violations_log || []),
        {
          type: violationType || 'tab_switch',
          message: message || 'Proctoring rule violation detected',
          timestamp: new Date().toISOString(),
          violation_number: newViolationsCount,
        },
      ];

      const isDisqualified = newViolationsCount > limit;
      const status = isDisqualified ? 'disqualified' : attempt.status;

      const { data: updated, error: updateErr } = await supabase
        .from('exam_attempts')
        .update({
          violations_count: newViolationsCount,
          violations_log: newLog,
          status,
        })
        .eq('id', attemptId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return {
        success: true,
        violations_count: newViolationsCount,
        limit,
        isDisqualified,
        data: updated,
      };
    } catch (err) {
      console.error('logViolation error:', err);
      return { success: false, message: err.message };
    }
  },

  async submitAttempt(attemptId, answers = {}, timeSpentSeconds = 0) {
    try {
      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();

      if (error || !attempt) {
        return { success: false, message: 'Attempt not found' };
      }

      const { data: exam } = await supabase
        .from('exams')
        .select('*')
        .eq('id', attempt.exam_id)
        .single();

      if (!exam) {
        return { success: false, message: 'Associated exam not found' };
      }

      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', exam.id);

      const qList = questions || [];

      // Automated Evaluation Engine
      let totalCalculatedMarks = 0;
      let earnedScore = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let unattemptedCount = 0;

      const questionBreakdown = qList.map((q) => {
        const questionMarks = Number(q.marks) || 1;
        const negativeMarks = exam.negative_marking
          ? Number(q.negative_marks || exam.negative_marks_per_question || 0)
          : 0;
        totalCalculatedMarks += questionMarks;

        const studentAns = answers[q.id];

        if (
          studentAns === undefined ||
          studentAns === null ||
          (Array.isArray(studentAns) && studentAns.length === 0) ||
          studentAns === ''
        ) {
          unattemptedCount++;
          return {
            question_id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            student_answer: null,
            correct_answers: q.correct_answers,
            explanation: q.explanation,
            is_correct: false,
            is_attempted: false,
            marks_awarded: 0,
            possible_marks: questionMarks,
          };
        }

        let isCorrect = false;

        if (q.question_type === 'single_choice' || q.question_type === 'true_false') {
          const selected = Array.isArray(studentAns) ? studentAns[0] : studentAns;
          const target = Array.isArray(q.correct_answers) ? q.correct_answers[0] : q.correct_answers;
          isCorrect = String(selected).trim().toLowerCase() === String(target).trim().toLowerCase();
        } else if (q.question_type === 'multi_choice') {
          const studentArr = Array.isArray(studentAns)
            ? studentAns.map((s) => String(s).trim().toLowerCase())
            : [String(studentAns).trim().toLowerCase()];
          const targetArr = Array.isArray(q.correct_answers)
            ? q.correct_answers.map((s) => String(s).trim().toLowerCase())
            : [String(q.correct_answers).trim().toLowerCase()];

          const hasAll = targetArr.every((ans) => studentArr.includes(ans));
          const hasNoExtra = studentArr.every((ans) => targetArr.includes(ans));
          isCorrect = hasAll && hasNoExtra;
        } else {
          const studentStr = String(studentAns).trim().toLowerCase();
          const targetArr = Array.isArray(q.correct_answers) ? q.correct_answers : [q.correct_answers];
          isCorrect = targetArr.some((t) => String(t).trim().toLowerCase() === studentStr);
        }

        let awarded = 0;
        if (isCorrect) {
          awarded = questionMarks;
          earnedScore += awarded;
          correctCount++;
        } else {
          awarded = -negativeMarks;
          earnedScore += awarded;
          incorrectCount++;
        }

        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          student_answer: studentAns,
          correct_answers: q.correct_answers,
          explanation: q.explanation,
          is_correct: isCorrect,
          is_attempted: true,
          marks_awarded: awarded,
          possible_marks: questionMarks,
        };
      });

      const finalScore = Math.max(0, Number(earnedScore.toFixed(2)));
      const maxMarks = totalCalculatedMarks || exam.total_marks || 100;
      const percentage = Number(((finalScore / maxMarks) * 100).toFixed(2));
      const passed = percentage >= Number(exam.passing_percentage);

      let feedback = '';
      if (percentage >= 90) feedback = 'Outstanding performance! Exemplary mastery of the subject matter.';
      else if (percentage >= 75) feedback = 'Great work! Solid grasp of concepts with minor gaps.';
      else if (passed) feedback = 'Passed! You met the certification requirements. Review explanations to improve.';
      else feedback = 'Needs improvement. Please review the detailed question explanations below and retake.';

      const submissionUpdate = {
        answers,
        submitted_at: new Date().toISOString(),
        time_spent_seconds: Number(timeSpentSeconds) || 0,
        score: finalScore,
        total_marks: maxMarks,
        percentage,
        passed,
        status: 'completed',
        feedback,
      };

      const { data: updated, error: updateErr } = await supabase
        .from('exam_attempts')
        .update(submissionUpdate)
        .eq('id', attemptId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return {
        success: true,
        message: 'Exam submitted successfully',
        data: {
          ...updated,
          exam_title: exam.title,
          passing_percentage: exam.passing_percentage,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          unattempted_count: unattemptedCount,
          total_questions: qList.length,
          breakdown: questionBreakdown,
        },
      };
    } catch (err) {
      console.error('submitAttempt error:', err);
      return { success: false, message: err.message };
    }
  },

  async getAttemptResult(id) {
    try {
      const { data: attempt, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !attempt) {
        return { success: false, message: 'Attempt not found' };
      }

      const { data: exam } = await supabase
        .from('exams')
        .select('*')
        .eq('id', attempt.exam_id)
        .single();

      const { data: questions } = exam
        ? await supabase.from('questions').select('*').eq('exam_id', exam.id)
        : { data: [] };

      const qList = questions || [];

      // Reconstruct breakdown
      const breakdown = qList.map((q) => {
        const studentAns = attempt.answers ? attempt.answers[q.id] : null;
        let isCorrect = false;

        if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
          if (q.question_type === 'single_choice' || q.question_type === 'true_false') {
            const selected = Array.isArray(studentAns) ? studentAns[0] : studentAns;
            const target = Array.isArray(q.correct_answers) ? q.correct_answers[0] : q.correct_answers;
            isCorrect = String(selected).trim().toLowerCase() === String(target).trim().toLowerCase();
          } else if (q.question_type === 'multi_choice') {
            const sArr = Array.isArray(studentAns)
              ? studentAns.map((s) => String(s).trim().toLowerCase())
              : [String(studentAns).trim().toLowerCase()];
            const tArr = Array.isArray(q.correct_answers)
              ? q.correct_answers.map((s) => String(s).trim().toLowerCase())
              : [String(q.correct_answers).trim().toLowerCase()];
            isCorrect = tArr.every((a) => sArr.includes(a)) && sArr.every((a) => tArr.includes(a));
          } else {
            const sStr = String(studentAns).trim().toLowerCase();
            const tArr = Array.isArray(q.correct_answers) ? q.correct_answers : [q.correct_answers];
            isCorrect = tArr.some((t) => String(t).trim().toLowerCase() === sStr);
          }
        }

        return {
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          student_answer: studentAns,
          correct_answers: q.correct_answers,
          explanation: q.explanation,
          is_correct: isCorrect,
          marks: q.marks,
          difficulty: q.difficulty,
        };
      });

      return {
        success: true,
        data: {
          ...attempt,
          exam: exam
            ? {
                title: exam.title,
                category: exam.category,
                passing_percentage: exam.passing_percentage,
              }
            : null,
          breakdown,
        },
      };
    } catch (err) {
      console.error('getAttemptResult error:', err);
      return { success: false, message: err.message };
    }
  },

  async getStudentHistory(email) {
    try {
      const formattedEmail = (email || '').toLowerCase().trim();
      const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('student_email', formattedEmail)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Enrich with exam details
      const enriched = await Promise.all(
        (attempts || []).map(async (att) => {
          const { data: exam } = await supabase
            .from('exams')
            .select('title, category, duration_minutes')
            .eq('id', att.exam_id)
            .maybeSingle();

          return {
            ...att,
            exam_title: exam ? exam.title : 'Assessment',
            exam_category: exam ? exam.category : 'General',
          };
        })
      );

      return { success: true, count: enriched.length, data: enriched };
    } catch (err) {
      console.error('getStudentHistory error:', err);
      return { success: false, message: err.message, data: [] };
    }
  },

  // --- ANALYTICS ENGINE ---
  async getDashboardAnalytics() {
    try {
      const { data: exams, error: examsErr } = await supabase.from('exams').select('id, status');
      if (examsErr) throw examsErr;

      const { data: attempts, error: attErr } = await supabase
        .from('exam_attempts')
        .select('student_email, status, passed, violations_count, score, started_at, exam_id');
      if (attErr) throw attErr;

      const examList = exams || [];
      const attemptList = attempts || [];

      const totalStudents = new Set(attemptList.map((a) => a.student_email)).size;
      const completedAttempts = attemptList.filter((a) => a.status === 'completed');
      const totalPassed = completedAttempts.filter((a) => a.passed).length;
      const passRate =
        completedAttempts.length > 0
          ? Math.round((totalPassed / completedAttempts.length) * 100)
          : 0;
      const totalViolations = attemptList.reduce(
        (acc, curr) => acc + (curr.violations_count || 0),
        0
      );

      // Recent attempts enriched
      const { data: rawRecent } = await supabase
        .from('exam_attempts')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);

      const recentAttempts = await Promise.all(
        (rawRecent || []).map(async (att) => {
          const { data: ex } = await supabase
            .from('exams')
            .select('title')
            .eq('id', att.exam_id)
            .maybeSingle();
          return {
            ...att,
            exam_title: ex?.title || 'Assessment',
          };
        })
      );

      const { data: rawExams } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      return {
        success: true,
        data: {
          totalExams: examList.length,
          publishedExams: examList.filter((e) => e.status === 'published').length,
          totalAttempts: attemptList.length,
          completedAttempts: completedAttempts.length,
          totalStudents: totalStudents || 0,
          overallPassRate: passRate,
          totalViolations,
          isSupabaseConnected: true,
          recentAttempts,
          exams: rawExams || [],
        },
      };
    } catch (err) {
      console.error('getDashboardAnalytics error:', err);
      return { success: false, message: err.message };
    }
  },

  async getExamAnalytics(examId) {
    try {
      const { data: exam, error: examErr } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examErr || !exam) {
        return { success: false, message: 'Exam not found' };
      }

      const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', examId)
        .order('started_at', { ascending: false });

      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId);

      const attList = attempts || [];
      const qList = questions || [];

      const totalAttempts = attList.length;
      const completed = attList.filter((a) => a.status === 'completed');
      const disqualified = attList.filter((a) => a.status === 'disqualified');

      let avgScore = 0;
      let highestScore = 0;
      let lowestScore = 100;
      let passedCount = 0;
      let totalTimeSpent = 0;

      if (completed.length > 0) {
        let scoreSum = 0;
        completed.forEach((a) => {
          const s = Number(a.score) || 0;
          scoreSum += s;
          if (s > highestScore) highestScore = s;
          if (s < lowestScore) lowestScore = s;
          if (a.passed) passedCount++;
          totalTimeSpent += a.time_spent_seconds || 0;
        });
        avgScore = Number((scoreSum / completed.length).toFixed(2));
      } else {
        lowestScore = 0;
      }

      // Per-question accuracy analytics
      const questionStats = qList.map((q) => {
        let correctAnswersForQ = 0;
        let attemptedAnswersForQ = 0;

        completed.forEach((att) => {
          const ans = att.answers ? att.answers[q.id] : null;
          if (ans !== undefined && ans !== null && ans !== '') {
            attemptedAnswersForQ++;
            const target = Array.isArray(q.correct_answers) ? q.correct_answers : [q.correct_answers];
            const studentAns = Array.isArray(ans) ? ans : [ans];
            const match =
              target.length === studentAns.length &&
              target.every((t) => studentAns.includes(t));
            if (match) correctAnswersForQ++;
          }
        });

        const accuracyRate =
          attemptedAnswersForQ > 0
            ? Math.round((correctAnswersForQ / attemptedAnswersForQ) * 100)
            : 0;

        return {
          id: q.id,
          question_text: q.question_text,
          difficulty: q.difficulty,
          marks: q.marks,
          attempted_count: attemptedAnswersForQ,
          correct_count: correctAnswersForQ,
          accuracy_rate: accuracyRate,
        };
      });

      return {
        success: true,
        data: {
          exam: {
            id: exam.id,
            title: exam.title,
            category: exam.category,
            total_marks: exam.total_marks,
            passing_percentage: exam.passing_percentage,
          },
          summary: {
            total_attempts: totalAttempts,
            completed_count: completed.length,
            disqualified_count: disqualified.length,
            passed_count: passedCount,
            pass_rate: completed.length > 0 ? Math.round((passedCount / completed.length) * 100) : 0,
            average_score: avgScore,
            highest_score: highestScore,
            lowest_score: lowestScore,
            average_time_seconds:
              completed.length > 0 ? Math.round(totalTimeSpent / completed.length) : 0,
          },
          question_stats: questionStats,
          submissions: attList,
        },
      };
    } catch (err) {
      console.error('getExamAnalytics error:', err);
      return { success: false, message: err.message };
    }
  },

  // --- SUPER ADMIN MANAGEMENT ---
  async getAdminUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return {
        success: true,
        count: (data || []).length,
        data: data || [],
      };
    } catch (err) {
      console.error('getAdminUsers error:', err);
      return { success: false, message: err.message, data: [] };
    }
  },

  async createExaminer(examinerData) {
    try {
      const { full_name, email, password } = examinerData;
      if (!full_name || !email || !password) {
        return {
          success: false,
          message: 'Full name, email, and password are required to create an examiner account.',
        };
      }

      const formattedEmail = email.toLowerCase().trim();
      const passwordHash = await hashPassword(password);

      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', formattedEmail)
        .maybeSingle();

      if (existing) {
        const { data: updated, error: updateErr } = await supabase
          .from('profiles')
          .update({
            role: 'examiner',
            full_name: full_name.trim(),
            password_hash: passwordHash,
          })
          .eq('email', formattedEmail)
          .select('id, email, full_name, role, avatar_url, created_at')
          .single();

        if (updateErr) throw updateErr;

        return {
          success: true,
          message: `Existing user ${formattedEmail} has been updated to Examiner in Supabase!`,
          data: updated,
        };
      }

      const newExaminer = {
        email: formattedEmail,
        full_name: full_name.trim(),
        role: 'examiner',
        password_hash: passwordHash,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(formattedEmail)}`,
        created_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabase
        .from('profiles')
        .insert([newExaminer])
        .select('id, email, full_name, role, avatar_url, created_at')
        .single();

      if (error) throw error;

      return {
        success: true,
        message: `Examiner ${created.full_name} (${created.email}) created and authorized in Supabase!`,
        data: created,
      };
    } catch (err) {
      console.error('createExaminer error:', err);
      return { success: false, message: err.message };
    }
  },

  async updateUserRole(userId, newRole) {
    try {
      if (!userId || !newRole) {
        return { success: false, message: 'userId and newRole are required' };
      }

      if (!['student', 'examiner', 'admin', 'super_admin'].includes(newRole)) {
        return { success: false, message: 'Invalid role' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select('id, email, full_name, role')
        .single();

      if (error) throw error;

      return {
        success: true,
        message: `User role updated to ${newRole} in Supabase`,
        data,
      };
    } catch (err) {
      console.error('updateUserRole error:', err);
      return { success: false, message: err.message };
    }
  },

  async deleteUser(id) {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return { success: true, message: 'User deleted from Supabase database' };
    } catch (err) {
      console.error('deleteUser error:', err);
      return { success: false, message: err.message };
    }
  },

  async claimSuperAdmin(data) {
    try {
      const { email, password, full_name, super_admin_key } = data;

      if (!super_admin_key || super_admin_key.trim() !== SUPER_ADMIN_KEY) {
        return {
          success: false,
          message: 'Invalid Super Admin Master Key. Access denied.',
        };
      }

      if (!email || !password) {
        return { success: false, message: 'Email and password required' };
      }

      const formattedEmail = email.toLowerCase().trim();
      const passwordHash = await hashPassword(password);

      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', formattedEmail)
        .maybeSingle();

      let superAdminUser;
      if (existing) {
        const { data: updated, error } = await supabase
          .from('profiles')
          .update({
            role: 'super_admin',
            password_hash: passwordHash,
            full_name: full_name ? full_name.trim() : existing.full_name,
          })
          .eq('email', formattedEmail)
          .select('id, email, full_name, role, avatar_url, created_at')
          .single();

        if (error) throw error;
        superAdminUser = updated;
      } else {
        const { data: created, error } = await supabase
          .from('profiles')
          .insert([
            {
              email: formattedEmail,
              full_name: full_name ? full_name.trim() : 'Super Administrator',
              role: 'super_admin',
              password_hash: passwordHash,
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(formattedEmail)}`,
              created_at: new Date().toISOString(),
            },
          ])
          .select('id, email, full_name, role, avatar_url, created_at')
          .single();

        if (error) throw error;
        superAdminUser = created;
      }

      return {
        success: true,
        message: 'Super Admin account authenticated and authorized in Supabase!',
        data: {
          user: superAdminUser,
          token: 'sa-token-' + superAdminUser.id,
        },
      };
    } catch (err) {
      console.error('claimSuperAdmin error:', err);
      return { success: false, message: err.message };
    }
  },
};
