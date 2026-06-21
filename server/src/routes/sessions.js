import express from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from './auth.js';
import { getSession, createSessionStore, hasSession } from '../sockets/sessionStore.js';
import { calculatePoints } from '../services/scoringService.js';

const router = express.Router();

// GET /api/sessions/:partyCode/teams - Get teams for a session (if teamMode is enabled)
router.get('/:partyCode/teams', async (req, res) => {
  const { partyCode } = req.params;
  const upperCode = partyCode.toUpperCase();

  try {
    const sessionRes = await query('SELECT id, quiz_id FROM sessions WHERE party_code = $1', [upperCode]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionId = sessionRes.rows[0].id;
    const quizId = sessionRes.rows[0].quiz_id;

    const quizRes = await query('SELECT settings FROM quizzes WHERE id = $1', [quizId]);
    const settings = quizRes.rows[0]?.settings || {};

    if (!settings.teamMode) {
      return res.json({ teamMode: false, teams: [] });
    }

    const teamsRes = await query('SELECT * FROM teams WHERE session_id = $1', [sessionId]);
    res.json({ teamMode: true, teams: teamsRes.rows });
  } catch (error) {
    console.error('Fetch teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sessions/:partyCode/join - Participant joins a session
router.post('/:partyCode/join', async (req, res) => {
  const { partyCode } = req.params;
  const { nickname, avatarColor, teamId } = req.body;
  const upperCode = partyCode.toUpperCase();

  if (!nickname || nickname.trim() === '') {
    return res.status(400).json({ error: 'Nickname is required' });
  }

  try {
    // 1. Get session
    const sessionRes = await query(
      "SELECT s.*, q.settings FROM sessions s JOIN quizzes q ON s.quiz_id = q.id WHERE s.party_code = $1 AND s.status != 'ended'",
      [upperCode]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Active quiz session not found with this party code' });
    }

    const session = sessionRes.rows[0];
    const settings = session.settings || {};
    const maxParticipants = settings.maxParticipants || 50;

    // Check if session is in lobby
    if (session.status !== 'lobby') {
      return res.status(400).json({ error: 'Quiz has already started.' });
    }

    // 2. Count current participants
    const countRes = await query('SELECT COUNT(*) FROM participants WHERE session_id = $1', [session.id]);
    const count = parseInt(countRes.rows[0].count, 10);
    if (count >= maxParticipants) {
      return res.status(400).json({ error: `Session is full (max ${maxParticipants} players)` });
    }

    // Check if nickname already taken in this session
    const nameCheck = await query(
      'SELECT id FROM participants WHERE session_id = $1 AND LOWER(nickname) = $2',
      [session.id, nickname.toLowerCase().trim()]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Nickname is already taken in this session' });
    }

    // 3. Optional Team Validation
    let assignedTeamId = null;
    if (settings.teamMode) {
      if (teamId) {
        // verify team exists for this session
        const teamCheck = await query('SELECT id FROM teams WHERE id = $1 AND session_id = $2', [teamId, session.id]);
        if (teamCheck.rows.length > 0) {
          assignedTeamId = teamId;
        }
      }
      // If teamMode is active but no teamId was selected, let's auto-assign to the team with fewest members
      if (!assignedTeamId) {
        const teamCountRes = await query(
          `SELECT t.id, COUNT(p.id) as member_count 
           FROM teams t 
           LEFT JOIN participants p ON t.id = p.team_id 
           WHERE t.session_id = $1 
           GROUP BY t.id 
           ORDER BY member_count ASC LIMIT 1`,
          [session.id]
        );
        if (teamCountRes.rows.length > 0) {
          assignedTeamId = teamCountRes.rows[0].id;
        }
      }
    }

    // 4. Create participant
    const insertRes = await query(
      `INSERT INTO participants (session_id, nickname, avatar_color, team_id, total_score) 
       VALUES ($1, $2, $3, $4, 0) RETURNING *`,
      [session.id, nickname.trim(), avatarColor || '#3B82F6', assignedTeamId]
    );

    const participant = insertRes.rows[0];

    // Ensure in-memory session store exists
    let store = getSession(upperCode);
    if (!store) {
      store = createSessionStore(upperCode);
    }
    store.connectedParticipantIds.add(participant.id);

    // Get Socket io and broadcast lobby-update
    const io = req.app.get('io');
    if (io) {
      // Get all current participants in session
      const participantsRes = await query(
        `SELECT p.id, p.nickname, p.avatar_color, t.name as team_name, t.color as team_color 
         FROM participants p 
         LEFT JOIN teams t ON p.team_id = t.id 
         WHERE p.session_id = $1 
         ORDER BY p.joined_at ASC`,
        [session.id]
      );
      io.to(upperCode).emit('lobby-update', {
        participants: participantsRes.rows,
        participantCount: participantsRes.rows.length
      });
    }

    res.status(201).json({
      message: 'Joined successfully',
      participantId: participant.id,
      nickname: participant.nickname,
      avatarColor: participant.avatar_color,
      teamId: participant.team_id,
      partyCode: upperCode,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sessions/:partyCode/start - Host starts the quiz
router.post('/:partyCode/start', requireAdmin, async (req, res) => {
  const { partyCode } = req.params;
  const adminId = req.admin.adminId;
  const upperCode = partyCode.toUpperCase();

  try {
    // Verify admin owns the quiz session
    const sessionRes = await query(
      `SELECT s.id, s.quiz_id, q.settings 
       FROM sessions s 
       JOIN quizzes q ON s.quiz_id = q.id 
       WHERE s.party_code = $1 AND q.admin_id = $2`,
      [upperCode, adminId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or unauthorized' });
    }

    const session = sessionRes.rows[0];

    // Check if questions exist
    const questionsRes = await query(
      'SELECT id, text, options, time_limit, points FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
      [session.quiz_id]
    );

    if (questionsRes.rows.length === 0) {
      return res.status(400).json({ error: 'Quiz has no questions.' });
    }

    // Update session status in DB
    await query(
      "UPDATE sessions SET status = 'live', current_question_index = 0, started_at = now() WHERE id = $1",
      [session.id]
    );

    // Initialize/Update in-memory liveSession
    let store = getSession(upperCode);
    if (!store) {
      store = createSessionStore(upperCode);
    }
    store.state = 'question';
    store.currentQuestionIndex = 0;
    store.questionStartedAt = Date.now();
    store.answerCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    store.answersSubmitted = {};

    const firstQuestion = questionsRes.rows[0];

    // Broadcast quiz-started to all clients
    const io = req.app.get('io');
    if (io) {
      io.to(upperCode).emit('quiz-started', {
        questionCount: questionsRes.rows.length
      });

      // Send first question event immediately
      io.to(upperCode).emit('question-start', {
        questionIndex: 0,
        questionId: firstQuestion.id,
        text: firstQuestion.text,
        options: firstQuestion.options, // array of strings
        timeLimit: firstQuestion.time_limit || session.settings.timerDefault || 20,
        questionStartedAt: store.questionStartedAt,
        totalQuestions: questionsRes.rows.length
      });
    }

    res.json({ message: 'Quiz started' });
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sessions/:partyCode/next - Admin controls game flow: advances states
router.post('/:partyCode/next', requireAdmin, async (req, res) => {
  const { partyCode } = req.params;
  const adminId = req.admin.adminId;
  const upperCode = partyCode.toUpperCase();

  try {
    // 1. Verify ownership
    const sessionRes = await query(
      `SELECT s.*, q.settings 
       FROM sessions s 
       JOIN quizzes q ON s.quiz_id = q.id 
       WHERE s.party_code = $1 AND q.admin_id = $2`,
      [upperCode, adminId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or unauthorized' });
    }

    const session = sessionRes.rows[0];
    const settings = session.settings || {};
    const store = getSession(upperCode);

    if (!store) {
      return res.status(400).json({ error: 'Active live session state not found in memory.' });
    }

    const questionsRes = await query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
      [session.quiz_id]
    );
    const questions = questionsRes.rows;
    const currentQIdx = store.currentQuestionIndex;

    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({ error: 'Real-time WebSocket server not available.' });
    }

    if (store.state === 'question') {
      // Transition: QUESTION -> REVEAL
      store.state = 'reveal';
      const question = questions[currentQIdx];

      // Broadcast answer reveal
      io.to(upperCode).emit('question-reveal', {
        questionIndex: currentQIdx,
        correctIndex: question.correct_index,
        options: question.options,
        explanation: question.explanation || null
      });

      // Get individual scores update for all participants
      // Calculate scores of participants who submitted correct answers
      const participantPoints = {}; // participantId -> points
      
      const submittedAnswers = store.answersSubmitted;
      
      // We will update points in database
      for (const [pIdStr, submission] of Object.entries(submittedAnswers)) {
        const pId = parseInt(pIdStr, 10);
        const isCorrect = submission.optionIndex === question.correct_index;
        
        // Calculate points
        // Check current streak of participant
        const streakRes = await query(
          `SELECT COUNT(*) as streak FROM answers a
           WHERE a.participant_id = $1 AND a.correct = true
           AND a.id > COALESCE((SELECT MAX(id) FROM answers WHERE participant_id = $1 AND correct = false), 0)`,
          [pId]
        );
        const streak = parseInt(streakRes.rows[0]?.streak || 0, 10);
        
        const { points } = calculatePoints(
          isCorrect, 
          submission.timeTakenMs, 
          question.time_limit || settings.timerDefault || 20, 
          streak, 
          true // streak bonus enabled
        );

        if (points > 0) {
          // Write to answers
          await query(
            `INSERT INTO answers (participant_id, question_id, option_index, time_taken_ms, correct, points_earned) 
             VALUES ($1, $2, $3, $4, true, $5)`,
            [pId, question.id, submission.optionIndex, submission.timeTakenMs, points]
          );

          // Update participant score
          await query(
            'UPDATE participants SET total_score = total_score + $1 WHERE id = $2',
            [points, pId]
          );

          participantPoints[pId] = points;
        } else {
          // Wrong answer
          await query(
            `INSERT INTO answers (participant_id, question_id, option_index, time_taken_ms, correct, points_earned) 
             VALUES ($1, $2, $3, $4, false, 0)`,
            [pId, question.id, submission.optionIndex, submission.timeTakenMs]
          );
          participantPoints[pId] = 0;
        }
      }

      // Handle team score aggregations if teamMode is active
      if (settings.teamMode) {
        // Recalculate team total scores by summing participant scores
        await query(
          `UPDATE teams t
           SET total_score = COALESCE((
             SELECT SUM(p.total_score) 
             FROM participants p 
             WHERE p.team_id = t.id
           ), 0)
           WHERE t.session_id = $1`,
          [session.id]
        );
      }

      res.json({ message: 'Answers revealed', state: store.state });

    } else if (store.state === 'reveal') {
      // Transition: REVEAL -> LEADERBOARD
      store.state = 'leaderboard';

      // Fetch top 5 participants
      const topParticipants = await query(
        `SELECT p.id, p.nickname, p.avatar_color, p.total_score, t.name as team_name 
         FROM participants p
         LEFT JOIN teams t ON p.team_id = t.id
         WHERE p.session_id = $1 
         ORDER BY p.total_score DESC LIMIT 5`,
        [session.id]
      );

      // Fetch top teams if teamMode is active
      let topTeams = [];
      if (settings.teamMode) {
        const teamsRes = await query(
          'SELECT id, name, color, total_score FROM teams WHERE session_id = $1 ORDER BY total_score DESC LIMIT 5',
          [session.id]
        );
        topTeams = teamsRes.rows;
      }

      // Emit leaderboard-update to room
      io.to(upperCode).emit('leaderboard-update', {
        leaderboard: topParticipants.rows,
        teamsLeaderboard: topTeams,
        questionIndex: currentQIdx
      });

      res.json({ message: 'Leaderboard shown', state: store.state });

    } else if (store.state === 'leaderboard') {
      // Transition: LEADERBOARD -> NEXT QUESTION or ENDED
      const nextQIdx = currentQIdx + 1;

      if (nextQIdx < questions.length) {
        // Go to next question
        store.state = 'question';
        store.currentQuestionIndex = nextQIdx;
        store.questionStartedAt = Date.now();
        store.answerCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
        store.answersSubmitted = {};

        // Update DB session index
        await query(
          'UPDATE sessions SET current_question_index = $1 WHERE id = $2',
          [nextQIdx, session.id]
        );

        const nextQuestion = questions[nextQIdx];

        io.to(upperCode).emit('question-start', {
          questionIndex: nextQIdx,
          questionId: nextQuestion.id,
          text: nextQuestion.text,
          options: nextQuestion.options,
          timeLimit: nextQuestion.time_limit || settings.timerDefault || 20,
          questionStartedAt: store.questionStartedAt,
          totalQuestions: questions.length
        });

        res.json({ message: 'Advanced to next question', state: store.state, questionIndex: nextQIdx });
      } else {
        // End the quiz session
        store.state = 'ended';
        
        await query(
          "UPDATE sessions SET status = 'ended' WHERE id = $1",
          [session.id]
        );
        
        await query(
          "UPDATE quizzes SET status = 'ended' WHERE id = $1",
          [session.quiz_id]
        );

        // Fetch podium results (top 3)
        const podiumRes = await query(
          `SELECT p.id, p.nickname, p.avatar_color, p.total_score, t.name as team_name
           FROM participants p
           LEFT JOIN teams t ON p.team_id = t.id
           WHERE p.session_id = $1
           ORDER BY p.total_score DESC LIMIT 3`,
          [session.id]
        );

        // Broadcast ended event
        io.to(upperCode).emit('quiz-ended', {
          podium: podiumRes.rows
        });

        res.json({ message: 'Quiz ended', state: store.state });
      }
    }
  } catch (error) {
    console.error('Control quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sessions/:partyCode/answer - Participant submits an answer
router.post('/:partyCode/answer', async (req, res) => {
  const { partyCode } = req.params;
  const { participantId, questionId, optionIndex } = req.body;
  const upperCode = partyCode.toUpperCase();

  if (!participantId || questionId === undefined || optionIndex === undefined) {
    return res.status(400).json({ error: 'Missing required parameters (participantId, questionId, optionIndex)' });
  }

  try {
    const store = getSession(upperCode);
    if (!store) {
      return res.status(404).json({ error: 'Active live session not found in memory.' });
    }

    if (store.state !== 'question') {
      return res.status(400).json({ error: 'Answering is not allowed at this state.' });
    }

    // Check if participant has already answered this question
    if (store.answersSubmitted[participantId] !== undefined) {
      return res.status(400).json({ error: 'You have already submitted an answer for this question.' });
    }

    // Calculate time taken server-side
    const timeTakenMs = Date.now() - store.questionStartedAt;

    // Save submission details in memory
    store.answersSubmitted[participantId] = {
      optionIndex: parseInt(optionIndex, 10),
      timeTakenMs
    };

    // Increment answer counts
    const optIdx = parseInt(optionIndex, 10);
    if (store.answerCounts[optIdx] !== undefined) {
      store.answerCounts[optIdx] += 1;
    }

    // Get Socket io and broadcast answer-count-update
    const io = req.app.get('io');
    if (io) {
      const answeredCount = Object.keys(store.answersSubmitted).length;
      io.to(upperCode).emit('answer-count-update', {
        answeredCount,
        totalConnected: store.connectedParticipantIds.size,
        answerCounts: store.answerCounts // optional: don't reveal counts to participants if you want suspense, or just broadcast counts to the room
      });
    }

    res.json({ success: true, message: 'Answer recorded.' });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/:partyCode/results - Final podium + leaderboard results
router.get('/:partyCode/results', async (req, res) => {
  const { partyCode } = req.params;
  const upperCode = partyCode.toUpperCase();

  try {
    const sessionRes = await query('SELECT id, quiz_id FROM sessions WHERE party_code = $1', [upperCode]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionId = sessionRes.rows[0].id;
    const quizId = sessionRes.rows[0].quiz_id;

    // Get all participants sorted by score
    const participantsRes = await query(
      `SELECT p.id, p.nickname, p.avatar_color, p.total_score, t.name as team_name, t.color as team_color
       FROM participants p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.session_id = $1
       ORDER BY p.total_score DESC`,
      [sessionId]
    );

    // Get team standings
    const teamsRes = await query(
      'SELECT id, name, color, total_score FROM teams WHERE session_id = $1 ORDER BY total_score DESC',
      [sessionId]
    );

    res.json({
      participants: participantsRes.rows,
      teams: teamsRes.rows
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
