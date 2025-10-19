const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Schema
const SessionSchema = new mongoose.Schema({
  task: { type: String, required: true },
  duration: { type: Number, required: true },
  type: { type: String, default: 'focus' },
  timestamp: { type: Date, default: Date.now },
  date: String,
  userId: { type: String, default: 'default_user' }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true, default: 'default_user' },
  name: { type: String, default: 'Guest' },
  totalFocus: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  level: { type: Number, default: 1 }
});

const Session = mongoose.model('Session', SessionSchema);
const User = mongoose.model('User', UserSchema);

// API Routes

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ timestamp: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new session
app.post('/api/sessions', async (req, res) => {
  try {
    const session = new Session({
      ...req.body,
      date: new Date().toLocaleDateString()
    });
    await session.save();
    
    // Update user stats
    let user = await User.findOne({ userId: 'default_user' });
    if (!user) {
      user = new User();
    }
    user.totalFocus += req.body.duration;
    user.level = Math.floor(user.totalFocus / 1500) + 1;
    await user.save();
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString();
    const sessions = await Session.find();
    const user = await User.findOne({ userId: 'default_user' }) || new User();
    
    const todaySessions = sessions.filter(s => s.date === today);
    const todayTotal = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    
    // Last 7 days data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      const daySessions = sessions.filter(s => s.date === dateStr);
      const totalMinutes = daySessions.reduce((sum, s) => sum + s.duration, 0);
      
      last7Days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sessions: daySessions.length,
        minutes: totalMinutes
      });
    }
    
    // Task breakdown
    const taskBreakdown = {};
    sessions.forEach(s => {
      taskBreakdown[s.task] = (taskBreakdown[s.task] || 0) + 1;
    });
    
    res.json({
      todayTotal,
      todaySessions: todaySessions.length,
      weeklyData: last7Days,
      totalSessions: sessions.length,
      taskBreakdown: Object.entries(taskBreakdown).map(([task, count]) => ({ task, count })),
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user data
app.get('/api/user', async (req, res) => {
  try {
    let user = await User.findOne({ userId: 'default_user' });
    if (!user) {
      user = new User();
      await user.save();
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    res.json({ message: 'Session deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pomodoro';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});