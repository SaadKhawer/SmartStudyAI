const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createGroup, joinGroup, getMyGroups, getGroupDetail,
  startQuizBattle, submitBattleAnswer, createChallenge,
  getDiscussionQuestions, leaveGroup
} = require('../controllers/studyGroupController');

router.post('/create', authenticate, createGroup);
router.post('/join', authenticate, joinGroup);
router.get('/my-groups', authenticate, getMyGroups);
router.get('/:id', authenticate, getGroupDetail);
router.post('/:id/quiz-battle', authenticate, startQuizBattle);
router.post('/:id/battle-answer', authenticate, submitBattleAnswer);
router.post('/:id/challenge', authenticate, createChallenge);
router.get('/:id/discussion', authenticate, getDiscussionQuestions);
router.post('/:id/leave', authenticate, leaveGroup);

module.exports = router;
