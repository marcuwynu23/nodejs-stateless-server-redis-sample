import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key';

const client = createClient({
  url: redisUrl
});

client.on('error', (err) => console.error('Redis Client Error', err));

// Middleware to authenticate JWT
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    (req as any).user = user;
    next();
  });
};

async function startServer() {
  await client.connect();

  // Login route to get a token
  app.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // In a real app, you would verify password here
    const user = { name: username };
    const accessToken = jwt.sign(user, jwtSecret, { expiresIn: '1h' });

    res.json({ accessToken });
  });

  // Protected route
  app.get('/', authenticateToken, async (req, res) => {
    try {
      const visits = await client.incr('visits');
      res.json({
        message: 'Stateless server with Redis and Auth',
        user: (req as any).user,
        visits: visits,
        hostname: process.env.HOSTNAME || 'local'
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer();
