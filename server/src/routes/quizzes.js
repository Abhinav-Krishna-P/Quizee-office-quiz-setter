import express from 'express';
import multer from 'multer';
import { query } from '../db/index.js';
import { requireAdmin } from './auth.js';
import { extractQuizFromPDF } from '../services/geminiService.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Generate a unique 6-character alphanumeric party code
function generatePartyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters like O, 0, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/quizzes - List quizzes created by admin
router.get('/', requireAdmin, async (req, res) => {
  const adminId = req.admin.adminId;
  try {
    const result = await query(
      'SELECT * FROM quizzes WHERE admin_id = $1 ORDER BY created_at DESC',
      [adminId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch quizzes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/quizzes/:id - Get quiz details + questions
router.get('/:id', requireAdmin, async (req, res) => {
  const adminId = req.admin.adminId;
  const { id } = req.params;

  try {
    const quizResult = await query(
      'SELECT * FROM quizzes WHERE id = $1 AND admin_id = $2',
      [id, adminId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsResult = await query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
      [id]
    );

    const quiz = quizResult.rows[0];
    quiz.questions = questionsResult.rows;
    res.json(quiz);
  } catch (error) {
    console.error('Fetch quiz details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/quizzes - Create a draft quiz
router.post('/', requireAdmin, async (req, res) => {
  const adminId = req.admin.adminId;
  const { title, settings } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const defaultSettings = {
    timerDefault: 20, // 20 seconds
    teamMode: false,
    numTeams: 2,
    teamNames: ['Team Red', 'Team Blue'],
    randomizeOrder: false,
    randomizeOptions: false,
    maxParticipants: 50,
    ...settings
  };

  try {
    const result = await query(
      'INSERT INTO quizzes (admin_id, title, settings) VALUES ($1, $2, $3) RETURNING *',
      [adminId, title, JSON.stringify(defaultSettings)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/quizzes/:id - Update settings and questions
router.put('/:id', requireAdmin, async (req, res) => {
  const adminId = req.admin.adminId;
  const { id } = req.params;
  const { title, settings, questions } = req.body;

  try {
    // 1. Verify quiz ownership
    const quizCheck = await query(
      'SELECT * FROM quizzes WHERE id = $1 AND admin_id = $2',
      [id, adminId]
    );

    if (quizCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // 2. Update settings and title
    const currentQuiz = quizCheck.rows[0];
    const newTitle = title !== undefined ? title : currentQuiz.title;
    const newSettings = settings !== undefined ? { ...currentQuiz.settings, ...settings } : currentQuiz.settings;

    await query(
      'UPDATE quizzes SET title = $1, settings = $2 WHERE id = $3',
      [newTitle, JSON.stringify(newSettings), id]
    );

    // 3. Update questions (if provided in payload)
    if (questions && Array.isArray(questions)) {
      if (questions.length > 30) {
        return res.status(400).json({ error: 'Quizzes are capped at a maximum of 30 questions.' });
      }

      // We'll delete and re-insert in a transaction for simplicity of re-ordering & edits
      await query('BEGIN');
      try {
        await query('DELETE FROM questions WHERE quiz_id = $1', [id]);

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await query(
            `INSERT INTO questions (quiz_id, position, text, image_url, options, correct_index, time_limit, points) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              i, // position
              q.text || q.question, // support both schemas
              q.image_url || null,
              JSON.stringify(q.options),
              q.correct_index !== undefined ? q.correct_index : q.correctIndex,
              q.time_limit || newSettings.timerDefault,
              q.points || 1000
            ]
          );
        }
        await query('COMMIT');
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }
    }

    res.json({ message: 'Quiz updated successfully' });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/quizzes/:id/extract-pdf - Upload PDF -> AI extract questions
router.post('/:id/extract-pdf', requireAdmin, upload.single('pdf'), async (req, res) => {
  const adminId = req.admin.adminId;
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }

  try {
    // Verify quiz ownership
    const quizCheck = await query(
      'SELECT * FROM quizzes WHERE id = $1 AND admin_id = $2',
      [id, adminId]
    );
    if (quizCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const questions = await extractQuizFromPDF(req.file.buffer, apiKey);
    res.json({ questions });
  } catch (error) {
    console.error('PDF extraction route error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract questions from PDF' });
  }
});

// POST /api/quizzes/:id/publish - Create a quiz session & open lobby
router.post('/:id/publish', requireAdmin, async (req, res) => {
  const adminId = req.admin.adminId;
  const { id } = req.params;

  try {
    // 1. Verify quiz ownership and check if questions exist
    const quizCheck = await query(
      'SELECT * FROM quizzes WHERE id = $1 AND admin_id = $2',
      [id, adminId]
    );
    if (quizCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsCheck = await query(
      'SELECT COUNT(*) FROM questions WHERE quiz_id = $1',
      [id]
    );
    if (parseInt(questionsCheck.rows[0].count, 10) === 0) {
      return res.status(400).json({ error: 'Quiz must have at least one question to publish.' });
    }

    // 2. Generate a unique party code that is not currently active in sessions
    let partyCode;
    let attempts = 0;
    while (attempts < 10) {
      partyCode = generatePartyCode();
      const codeCheck = await query(
        "SELECT COUNT(*) FROM sessions WHERE party_code = $1 AND status != 'ended'",
        [partyCode]
      );
      if (parseInt(codeCheck.rows[0].count, 10) === 0) {
        break;
      }
      attempts++;
    }

    if (!partyCode) {
      return res.status(500).json({ error: 'Failed to generate a unique party code. Please try again.' });
    }

    // 3. Mark quiz status as published, write party code
    await query(
      "UPDATE quizzes SET status = 'published', party_code = $1 WHERE id = $2",
      [partyCode, id]
    );

    // 4. Create session row
    const sessionResult = await query(
      `INSERT INTO sessions (quiz_id, party_code, status, current_question_index) 
       VALUES ($1, $2, 'lobby', 0) 
       ON CONFLICT (party_code) DO UPDATE 
       SET status = 'lobby', current_question_index = 0, started_at = NULL, quiz_id = $1
       RETURNING *`,
      [id, partyCode]
    );

    const session = sessionResult.rows[0];

    // 5. Create teams if teamMode is true
    const settings = quizCheck.rows[0].settings;
    if (settings.teamMode && Array.isArray(settings.teamNames)) {
      // Clear old teams for this session (if recycling code)
      await query('DELETE FROM teams WHERE session_id = $1', [session.id]);
      
      const colors = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899']; // standard colors
      for (let i = 0; i < Math.min(settings.numTeams || 2, settings.teamNames.length); i++) {
        await query(
          'INSERT INTO teams (session_id, name, color) VALUES ($1, $2, $3)',
          [session.id, settings.teamNames[i], colors[i % colors.length]]
        );
      }
    }

    res.json({
      partyCode,
      sessionId: session.id,
      status: session.status
    });
  } catch (error) {
    console.error('Publish quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
