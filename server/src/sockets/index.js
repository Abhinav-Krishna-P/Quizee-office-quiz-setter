import { getSession, createSessionStore } from './sessionStore.js';
import { query } from '../db/index.js';

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Join Session Room (Host or Participant)
    socket.on('join-session', async ({ participantId, nickname, partyCode, isHost }) => {
      if (!partyCode) {
        return socket.emit('error', { message: 'Party code is required' });
      }

      const upperCode = partyCode.toUpperCase();
      socket.join(upperCode);
      socket.partyCode = upperCode;
      socket.participantId = participantId;
      socket.isHost = !!isHost;

      console.log(`Socket ${socket.id} joined room ${upperCode} as ${isHost ? 'Host' : 'Participant'}`);

      // Ensure session exists in-memory
      let store = getSession(upperCode);
      if (!store) {
        store = createSessionStore(upperCode);
      }

      if (!isHost && participantId) {
        store.connectedParticipantIds.add(parseInt(participantId, 10));

        // Sync player status by checking DB
        try {
          const participantCheck = await query(
            'SELECT p.id, p.nickname, p.avatar_color, t.name as team_name, t.color as team_color FROM participants p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = $1',
            [participantId]
          );

          if (participantCheck.rows.length > 0) {
            // Re-emit lobby update to all clients to show active presence
            const participantsRes = await query(
              `SELECT p.id, p.nickname, p.avatar_color, t.name as team_name, t.color as team_color 
               FROM participants p 
               LEFT JOIN teams t ON p.team_id = t.id 
               WHERE p.session_id = (SELECT session_id FROM participants WHERE id = $1)
               ORDER BY p.joined_at ASC`,
              [participantId]
            );
            io.to(upperCode).emit('lobby-update', {
              participants: participantsRes.rows,
              participantCount: participantsRes.rows.length
            });
          }
        } catch (err) {
          console.error('Error fetching participant during socket join:', err);
        }
      }

      // Replay current state to the joining/reconnecting client
      try {
        const sessionRes = await query(
          'SELECT s.id, s.quiz_id, s.status, s.current_question_index FROM sessions s WHERE s.party_code = $1',
          [upperCode]
        );

        if (sessionRes.rows.length > 0) {
          const dbSession = sessionRes.rows[0];
          
          // Re-sync memory state with DB state if memory was cleared/restarted
          if (store.state === 'lobby' && dbSession.status === 'live') {
            store.state = 'question';
            store.currentQuestionIndex = dbSession.current_question_index;
            store.questionStartedAt = Date.now(); // fallback timestamp
          }

          if (store.state === 'question') {
            // Fetch current question
            const questionsRes = await query(
              'SELECT id, text, options, time_limit FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
              [dbSession.quiz_id]
            );
            const question = questionsRes.rows[store.currentQuestionIndex];
            if (question) {
              socket.emit('reconnect-state', {
                state: 'question',
                questionIndex: store.currentQuestionIndex,
                questionId: question.id,
                text: question.text,
                options: question.options,
                timeLimit: question.time_limit || 20,
                questionStartedAt: store.questionStartedAt,
                totalQuestions: questionsRes.rows.length,
                hasSubmitted: store.answersSubmitted[participantId] !== undefined,
                submittedOptionIndex: store.answersSubmitted[participantId]?.optionIndex !== undefined ? store.answersSubmitted[participantId].optionIndex : -1
              });
            }
          } else if (store.state === 'reveal') {
            const questionsRes = await query(
              'SELECT id, text, options, correct_index FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
              [dbSession.quiz_id]
            );
            const question = questionsRes.rows[store.currentQuestionIndex];
            if (question) {
              socket.emit('reconnect-state', {
                state: 'reveal',
                questionIndex: store.currentQuestionIndex,
                correctIndex: question.correct_index,
                options: question.options,
                totalQuestions: questionsRes.rows.length
              });
            }
          } else if (store.state === 'leaderboard') {
            socket.emit('reconnect-state', {
              state: 'leaderboard',
              questionIndex: store.currentQuestionIndex
            });
          } else if (store.state === 'ended') {
            socket.emit('reconnect-state', {
              state: 'ended'
            });
          } else {
            // Lobby state
            socket.emit('reconnect-state', {
              state: 'lobby'
            });
          }
        }
      } catch (err) {
        console.error('Error fetching session for reconnect:', err);
      }
    });

    // Client Disconnect Handler
    socket.on('disconnect', async () => {
      console.log('Socket disconnected:', socket.id);
      const { partyCode, participantId, isHost } = socket;

      if (partyCode) {
        const store = getSession(partyCode);
        if (store && participantId) {
          store.connectedParticipantIds.delete(parseInt(participantId, 10));

          // Broadcast participant-disconnected update to lobby or active game
          try {
            const sessionRes = await query('SELECT id FROM sessions WHERE party_code = $1', [partyCode]);
            if (sessionRes.rows.length > 0) {
              const sessionId = sessionRes.rows[0].id;
              const participantsRes = await query(
                `SELECT p.id, p.nickname, p.avatar_color, t.name as team_name, t.color as team_color 
                 FROM participants p 
                 LEFT JOIN teams t ON p.team_id = t.id 
                 WHERE p.session_id = $1
                 ORDER BY p.joined_at ASC`,
                [sessionId]
              );
              io.to(partyCode).emit('lobby-update', {
                participants: participantsRes.rows,
                participantCount: participantsRes.rows.length
              });
            }
          } catch (err) {
            console.error('Error handling socket disconnect logic:', err);
          }
        }
      }
    });
  });
}
