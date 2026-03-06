import type { VercelRequest, VercelResponse } from '@vercel/node';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Force load env from .env or .env.local
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Use REDIS_URL from your env
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || '';

if (!REDIS_URL) {
    console.error('[API] ERROR: No REDIS_URL or KV_URL found in environment variables.');
}

const redis = new Redis(REDIS_URL, {
    // Prevent ioredis from hanging if the connection is dead
    connectTimeout: 5000,
    maxRetriesPerRequest: 1
});

// Explicitly handle ioredis connection errors to prevent terminal crashes
redis.on('error', (err: any) => {
    if (err.code === 'ECONNREFUSED') {
        // Suppress the wall of text in the terminal if it's just a connection issue
        console.warn('[Redis] Connection refused. Check if the URL in .env.local is correct.');
    } else {
        console.error('[Redis] Connection Error:', err);
    }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!REDIS_URL) {
        return res.status(500).json({
            error: 'Redis configuration missing. Please ensure REDIS_URL is set in your Vercel project or .env.local file.'
        });
    }
    try {
        if (req.method === 'GET') {
            const { all, key } = req.query;

            if (all === 'true') {
                const sessionKeys = await redis.keys('session:*');
                const metadataKeys = await redis.keys('metadata:*');
                return res.status(200).json([...sessionKeys, ...metadataKeys]);
            }

            if (key) {
                const data = await redis.get(key as string);
                return res.status(200).json(data ? JSON.parse(data) : []);
            }
        }

        if (req.method === 'POST') {
            const { key, value } = req.body;
            if (!key) return res.status(400).json({ error: 'Missing key' });

            await redis.set(key, JSON.stringify(value));
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            const { key, all } = req.query;

            if (all === 'true') {
                const sessionKeys = await redis.keys('session:*');
                const metadataKeys = await redis.keys('metadata:*');
                const allKeys = [...sessionKeys, ...metadataKeys];
                if (allKeys.length > 0) {
                    await redis.del(...allKeys);
                }
                return res.status(200).json({ success: true, count: allKeys.length });
            }

            if (!key) return res.status(400).json({ error: 'Missing key' });

            await redis.del(key as string);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Redis API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
