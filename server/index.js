const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));

app.use(express.json());

// Initialize BigQuery client
// Note: In production (Cloud Run/GKE), you can omit keyFilename and use Workload Identity
const bigqueryConfig = {
  projectId: process.env.GCP_PROJECT_ID,
};

// Only use keyFilename if running locally or with explicit credentials
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  bigqueryConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const bigquery = new BigQuery(bigqueryConfig);

// Helper function to run BigQuery queries
async function runQuery(query) {
  const [rows] = await bigquery.query({
    query: query,
    location: 'US',
  });
  return rows;
}

// NHL endpoint
app.get('/api/nhl', async (req, res) => {
  try {
    // Replace with your actual BigQuery table and query
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nhl_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NHL data:', error);
    res.status(500).json({ error: 'Failed to fetch NHL data', message: error.message });
  }
});

// MLB endpoint
app.get('/api/mlb', async (req, res) => {
  try {
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.mlb_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB data:', error);
    res.status(500).json({ error: 'Failed to fetch MLB data', message: error.message });
  }
});

// NFL endpoint
app.get('/api/nfl', async (req, res) => {
  try {
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nfl_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NFL data:', error);
    res.status(500).json({ error: 'Failed to fetch NFL data', message: error.message });
  }
});

// NBA endpoint
app.get('/api/nba', async (req, res) => {
  try {
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nba_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBA data:', error);
    res.status(500).json({ error: 'Failed to fetch NBA data', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 BigQuery project: ${process.env.GCP_PROJECT_ID}`);
});
