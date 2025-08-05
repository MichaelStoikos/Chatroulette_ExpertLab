require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { 
    origin: [
      'https://michaelstoikos.github.io',
      'https://chatrouletteexpertlab-production.up.railway.app',
      'https://chatroulette-expert-lab.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ], 
    credentials: true 
  }
});

const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'Chatroulette';
let db;
const sessions = new Map();
const connectedUsers = new Map();
const waitingUsers = [];
const previousMatches = new Map();

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db(dbName);
    await db.createCollection('users');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB error, auth disabled:', err);
    db = null;
  }
}
connectToMongo();

// Authentication middleware
const authenticateUser = (req, res, next) => {
  const sessionId = req.headers['authorization'];
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(403).json({ error: 'Invalid session' });
  }
  
  req.user = session;
  next();
};

app.use(cors({ 
  origin: [
    'https://michaelstoikos.github.io',
    'https://chatrouletteexpertlab-production.up.railway.app',
    'https://chatroulette-expert-lab.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ], 
  credentials: true 
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/chatroulette/dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: db ? 'connected' : 'not connected'
  });
});

// Authentication routes
app.post('/api/register', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not available. Please set up MongoDB.' });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      username,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      lastSeen: new Date()
    };

    const result = await db.collection('users').insertOne(user);

    // Create simple session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session
    sessions.set(sessionId, {
      userId: result.insertedId,
      username,
      email
    });

    res.json({
      sessionId,
      user: {
        id: result.insertedId,
        username,
        email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not available. Please set up MongoDB.' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last seen
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastSeen: new Date() } }
    );

    // Create simple session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session
    sessions.set(sessionId, {
      userId: user._id,
      username: user.username,
      email: user.email
    });

    res.json({
      sessionId,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/profile', authenticateUser, async (req, res) => {
  try {
    const user = await db.collection('users').findOne(
      { _id: req.user.userId },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// SIGNALING & MATCHING
io.on('connection', socket => {
  socket.on('authenticate', async sessionId => {
    const session = sessions.get(sessionId);
    if (!session) return socket.emit('authError', { message: 'Invalid session' });
    const user = db ? await db.collection('users').findOne({ _id: session.userId }) : null;
    if (!user && db) return socket.emit('authError', { message: 'User not found' });

    socket.userId = session.userId;
    socket.username = session.username;
    connectedUsers.set(socket.id, {
      id: socket.id,
      userId: session.userId,
      username: session.username,
      status: 'waiting'
    });
    if (db) await db.collection('users').updateOne({ _id: session.userId }, { $set: { lastSeen: new Date() } });
    socket.emit('authenticated', { user: { id: session.userId, username: session.username, email: session.email } });
  });

  socket.on('findMatch', () => {
    if (!socket.userId) return socket.emit('error', { message: 'Not authenticated' });
    const userState = connectedUsers.get(socket.id);
    userState.status = 'waiting';
    waitingUsers.push(socket);
    if (waitingUsers.length >= 2) {
      const a = waitingUsers.shift();
      const b = waitingUsers.shift();
      const roomId = `room_${a.id}_${b.id}`;
      a.join(roomId);
      b.join(roomId);
      connectedUsers.get(a.id).status = 'inCall';
      connectedUsers.get(b.id).status = 'inCall';
      connectedUsers.get(a.id).roomId = roomId;
      connectedUsers.get(b.id).roomId = roomId;

      const mark = (s1, s2) => {
        if (!previousMatches.has(s1.userId)) previousMatches.set(s1.userId, new Set());
        if (!previousMatches.has(s2.userId)) previousMatches.set(s2.userId, new Set());
        previousMatches.get(s1.userId).add(s2.userId);
        previousMatches.get(s2.userId).add(s1.userId);
      };
      mark(a, b);

      a.emit('matchFound', { 
        roomId, 
        users: [a.id, b.id], 
        usernames: [a.username, b.username],
        isCaller: true 
      });
      b.emit('matchFound', { 
        roomId, 
        users: [a.id, b.id], 
        usernames: [a.username, b.username],
        isCaller: false 
      });
    }
  });

  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', {
      offer,
      from: socket.id
    });
  });
  
  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', {
      answer,
      from: socket.id
    });
  });
  
  socket.on('iceCandidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('iceCandidate', {
      candidate,
      from: socket.id
    });
  });

  socket.on('disconnect', () => {
    const idx = waitingUsers.findIndex(s => s.id === socket.id);
    if (idx > -1) waitingUsers.splice(idx, 1);
    const user = connectedUsers.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('partnerLeft');
    connectedUsers.delete(socket.id);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/chatroulette/dist/index.html'));
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 3001}`);
  console.log(`📊 MongoDB: ${db ? 'Connected' : 'Not connected (auth disabled)'}`);
  console.log(`🌐 CORS: Enabled for all origins`);
});
