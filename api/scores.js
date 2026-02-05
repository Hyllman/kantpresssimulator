import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            // Get top 10 scores. ZRANGE returns array of members. 
            // withScores: true returns [member1, score1, member2, score2...]
            const scores = await kv.zrange('kantpress_scores', 0, 9, {
                rev: true,
                withScores: true
            });

            // Format to [{name, score}, ...]
            const formatted = [];
            for (let i = 0; i < scores.length; i += 2) {
                formatted.push({
                    name: scores[i],
                    score: scores[i + 1]
                });
            }

            return res.status(200).json(formatted);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch scores' });
        }
    } else if (req.method === 'POST') {
        try {
            const { name, score } = req.body;

            // Simple validation
            if (!name || typeof score !== 'number') {
                return res.status(400).json({ error: 'Invalid input' });
            }

            // Add to sorted set. ZADD key score member
            // Member must be unique? If same name plays twice, it updates the score.
            // To allow duplicates, we might append a timestamp or ID to the name key, 
            // but display only the name. For simplicity, let's use "Name#Timestamp" as member.
            const member = `${name}#${Date.now()}`;

            await kv.zadd('kantpress_scores', { score, member });

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to save score' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
