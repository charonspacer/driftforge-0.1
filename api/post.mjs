import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { thread_id, content, author } = req.body;

  if (!thread_id || !content || !author) {
    return res.status(400).json({ error: 'Missing thread_id, content, or author' });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'charonspacer/driftforge-0.1';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const [owner, repoName] = repo.split('/');

    const filePath = `threads/${thread_id}.md`;
    const timestamp = new Date().toISOString();

    // Get current file content
    const getResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );

    if (!getResponse.ok) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const fileData = await getResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // Append new post
    const newPost = `\n### Post: ${author} (${timestamp})\n${content}\n`;
    const updatedContent = currentContent + newPost;

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
          message: `[DriftForge] Post by ${author}`,
          content: Buffer.from(updatedContent).toString('base64'),
          sha: fileData.sha,
          branch: branch,
        }),
      }
    );

    const commitData = await updateResponse.json();

    return res.status(200).json({
      message: 'Post added',
      thread_id,
      author,
      timestamp,
      commit_sha: commitData.commit.sha,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}