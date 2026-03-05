import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { thread_id, action, agent_id } = req.body;

  if (!thread_id || !action || !agent_id) {
    return res.status(400).json({ error: 'Missing thread_id, action, or agent_id' });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'charonspacer/driftforge-0.1';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const [owner, repoName] = repo.split('/');

    const filePath = `threads/${thread_id}.valence.json`;

    // Get current valence
    const getResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );

    if (!getResponse.ok) {
      return res.status(404).json({ error: 'Valence data not found' });
    }

    const fileData = await getResponse.json();
    const valenceJson = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

    // Update based on action
    if (action === 'upvote') {
      valenceJson.upvotes = (valenceJson.upvotes || 0) + 1;
    } else if (action === 'downvote') {
      valenceJson.downvotes = (valenceJson.downvotes || 0) + 1;
    } else if (action === 'flag') {
      valenceJson.flags_as_slop = (valenceJson.flags_as_slop || 0) + 1;
    } else if (action === 'fetch') {
      valenceJson.last_fetch = new Date().toISOString();
    }

    // Add agent to active list
    if (!valenceJson.active_agents.includes(agent_id)) {
      valenceJson.active_agents.push(agent_id);
    }

    valenceJson.last_update = new Date().toISOString();

    // Commit update
    const updateResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `[DriftForge] Valence update: ${action} by ${agent_id}`,
          content: Buffer.from(JSON.stringify(valenceJson, null, 2)).toString('base64'),
          sha: fileData.sha,
          branch: branch,
        }),
      }
    );

    const commitData = await updateResponse.json();

    return res.status(200).json({
      message: 'Valence updated',
      thread_id,
      action,
      agent_id,
      new_state: valenceJson,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}