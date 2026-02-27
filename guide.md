# Web App Integration Guide - Beat the Streak ML

This guide explains how to integrate the Beat the Streak ML predictions into your React web app.

---

## Overview

Your web app needs to query the **predictions cache table** in BigQuery to display daily predictions to users. The predictions are generated daily at 9 AM ET by GitHub Actions and stored in BigQuery.

### Architecture

```
GitHub Actions (Daily 9 AM ET)
  ↓
Generate Predictions (Python)
  ↓
Upload to BigQuery → ml_mlb__predictions_cache
  ↓
React Web App ← Query predictions
```

---

## BigQuery Table Schema

**Table:** `project-7dd4e548-9904-449d-9b7.mlb_modeling.ml_mlb__predictions_cache`

**Partitioned by:** `game_date` (cost optimization)
**Clustered by:** `player_id`, `team_id`

### Key Columns

| Column | Type | Description |
|--------|------|-------------|
| `player_id` | STRING | Unique player identifier |
| `player_name` | STRING | Player display name |
| `team_id` | STRING | Player's team abbreviation (e.g., "NYY") |
| `opponent_team_id` | STRING | Opponent team abbreviation |
| `game_date` | DATE | Date of game |
| `game_time` | STRING | Game start time (e.g., "7:05 PM ET") |
| `batting_order_position` | INT64 | Position in lineup (1-9, 0 if unknown) |
| `hit_probability` | FLOAT64 | Predicted probability of getting a hit (0.0 - 1.0) |
| `confidence_score` | FLOAT64 | Confidence in prediction (same as hit_probability) |
| `prediction_timestamp` | TIMESTAMP | When prediction was generated |
| `risk_aggressive` | BOOL | TRUE if probability >= 60% |
| `risk_balanced` | BOOL | TRUE if probability >= 65% |
| `risk_conservative` | BOOL | TRUE if probability >= 70% |
| `risk_very_conservative` | BOOL | TRUE if probability >= 75% |
| `risk_ultra_conservative` | BOOL | TRUE if probability >= 80% |
| `rank_overall` | INT64 | Rank by hit_probability (1 = highest) |

---

## Backend Integration (Node.js/Express)

### 1. Install BigQuery Client

```bash
npm install @google-cloud/bigquery
```

### 2. Create BigQuery Service

**File:** `services/bigQueryService.js`

```javascript
const { BigQuery } = require('@google-cloud/bigquery');

class BigQueryService {
  constructor() {
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    });
  }

  /**
   * Get today's predictions
   * @param {string} riskProfile - 'aggressive' | 'balanced' | 'conservative' | 'very_conservative' | 'ultra_conservative'
   * @param {number} limit - Number of results to return
   */
  async getTodaysPredictions(riskProfile = 'balanced', limit = 10) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Map risk profiles to columns
    const riskColumns = {
      aggressive: 'risk_aggressive',
      balanced: 'risk_balanced',
      conservative: 'risk_conservative',
      very_conservative: 'risk_very_conservative',
      ultra_conservative: 'risk_ultra_conservative'
    };

    const riskColumn = riskColumns[riskProfile] || 'risk_balanced';

    const query = `
      SELECT
        player_id,
        player_name,
        team_id,
        opponent_team_id,
        game_date,
        game_time,
        batting_order_position,
        hit_probability,
        confidence_score,
        rank_overall,
        prediction_timestamp
      FROM \`${process.env.GCP_PROJECT_ID}.mlb_modeling.ml_mlb__predictions_cache\`
      WHERE game_date = @game_date
        AND ${riskColumn} = TRUE
      ORDER BY hit_probability DESC
      LIMIT @limit
    `;

    const options = {
      query,
      params: {
        game_date: today,
        limit: limit
      }
    };

    try {
      const [rows] = await this.bigquery.query(options);
      return rows;
    } catch (error) {
      console.error('Error querying BigQuery:', error);
      throw error;
    }
  }

  /**
   * Get top pick for today
   */
  async getTopPick(riskProfile = 'balanced') {
    const predictions = await this.getTodaysPredictions(riskProfile, 1);
    return predictions[0] || null;
  }

  /**
   * Get predictions for a specific player
   */
  async getPlayerPrediction(playerId, date = null) {
    const gameDate = date || new Date().toISOString().split('T')[0];

    const query = `
      SELECT
        player_id,
        player_name,
        team_id,
        opponent_team_id,
        game_date,
        game_time,
        batting_order_position,
        hit_probability,
        confidence_score,
        rank_overall,
        risk_aggressive,
        risk_balanced,
        risk_conservative,
        risk_very_conservative,
        risk_ultra_conservative,
        prediction_timestamp
      FROM \`${process.env.GCP_PROJECT_ID}.mlb_modeling.ml_mlb__predictions_cache\`
      WHERE player_id = @player_id
        AND game_date = @game_date
    `;

    const options = {
      query,
      params: {
        player_id: playerId,
        game_date: gameDate
      }
    };

    const [rows] = await this.bigquery.query(options);
    return rows[0] || null;
  }
}

module.exports = new BigQueryService();
```

### 3. Create API Routes

**File:** `routes/predictions.js`

```javascript
const express = require('express');
const router = express.Router();
const bigQueryService = require('../services/bigQueryService');

/**
 * GET /api/predictions/today
 * Get today's predictions
 * Query params: riskProfile, limit
 */
router.get('/today', async (req, res) => {
  try {
    const { riskProfile = 'balanced', limit = 10 } = req.query;
    const predictions = await bigQueryService.getTodaysPredictions(
      riskProfile,
      parseInt(limit)
    );

    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      riskProfile,
      count: predictions.length,
      predictions
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predictions'
    });
  }
});

/**
 * GET /api/predictions/top
 * Get top pick for today
 */
router.get('/top', async (req, res) => {
  try {
    const { riskProfile = 'balanced' } = req.query;
    const topPick = await bigQueryService.getTopPick(riskProfile);

    if (!topPick) {
      return res.json({
        success: true,
        message: 'No predictions available for today',
        topPick: null
      });
    }

    res.json({
      success: true,
      riskProfile,
      topPick
    });
  } catch (error) {
    console.error('Error fetching top pick:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top pick'
    });
  }
});

/**
 * GET /api/predictions/player/:playerId
 * Get prediction for specific player
 */
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { date } = req.query;

    const prediction = await bigQueryService.getPlayerPrediction(playerId, date);

    if (!prediction) {
      return res.json({
        success: true,
        message: 'No prediction found for this player',
        prediction: null
      });
    }

    res.json({
      success: true,
      prediction
    });
  } catch (error) {
    console.error('Error fetching player prediction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player prediction'
    });
  }
});

module.exports = router;
```

### 4. Environment Variables

**File:** `.env`

```bash
GCP_PROJECT_ID=project-7dd4e548-9904-449d-9b7
GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

---

## Frontend Integration (React)

### 1. Create API Client

**File:** `src/api/predictionsApi.js`

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const predictionsApi = {
  /**
   * Get today's predictions
   */
  async getTodaysPredictions(riskProfile = 'balanced', limit = 10) {
    const response = await fetch(
      `${API_BASE_URL}/predictions/today?riskProfile=${riskProfile}&limit=${limit}`
    );
    const data = await response.json();
    return data;
  },

  /**
   * Get top pick for today
   */
  async getTopPick(riskProfile = 'balanced') {
    const response = await fetch(
      `${API_BASE_URL}/predictions/top?riskProfile=${riskProfile}`
    );
    const data = await response.json();
    return data;
  },

  /**
   * Get prediction for specific player
   */
  async getPlayerPrediction(playerId, date = null) {
    const url = date
      ? `${API_BASE_URL}/predictions/player/${playerId}?date=${date}`
      : `${API_BASE_URL}/predictions/player/${playerId}`;

    const response = await fetch(url);
    const data = await response.json();
    return data;
  }
};
```

### 2. Create React Hook

**File:** `src/hooks/usePredictions.js`

```javascript
import { useState, useEffect } from 'react';
import { predictionsApi } from '../api/predictionsApi';

export const usePredictions = (riskProfile = 'balanced', limit = 10) => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        const response = await predictionsApi.getTodaysPredictions(riskProfile, limit);

        if (response.success) {
          setPredictions(response.predictions);
          setError(null);
        } else {
          setError('Failed to load predictions');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [riskProfile, limit]);

  return { predictions, loading, error };
};

export const useTopPick = (riskProfile = 'balanced') => {
  const [topPick, setTopPick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopPick = async () => {
      try {
        setLoading(true);
        const response = await predictionsApi.getTopPick(riskProfile);

        if (response.success) {
          setTopPick(response.topPick);
          setError(null);
        } else {
          setError('Failed to load top pick');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTopPick();
  }, [riskProfile]);

  return { topPick, loading, error };
};
```

### 3. Create Predictions Component

**File:** `src/components/TodaysPredictions.jsx`

```jsx
import React, { useState } from 'react';
import { usePredictions } from '../hooks/usePredictions';

const TodaysPredictions = () => {
  const [riskProfile, setRiskProfile] = useState('balanced');
  const [limit, setLimit] = useState(10);
  const { predictions, loading, error } = usePredictions(riskProfile, limit);

  if (loading) {
    return <div className="loading">Loading predictions...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!predictions || predictions.length === 0) {
    return (
      <div className="no-predictions">
        <h2>No Predictions Available</h2>
        <p>No games scheduled for today or predictions haven't been generated yet.</p>
      </div>
    );
  }

  return (
    <div className="predictions-container">
      <header className="predictions-header">
        <h1>Today's Beat the Streak Predictions</h1>
        <p className="subtitle">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="risk-profile">Risk Profile:</label>
          <select
            id="risk-profile"
            value={riskProfile}
            onChange={(e) => setRiskProfile(e.target.value)}
          >
            <option value="aggressive">Aggressive (≥60%)</option>
            <option value="balanced">Balanced (≥65%)</option>
            <option value="conservative">Conservative (≥70%)</option>
            <option value="very_conservative">Very Conservative (≥75%)</option>
            <option value="ultra_conservative">Ultra Conservative (≥80%)</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="limit">Show Top:</label>
          <select
            id="limit"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      <div className="predictions-grid">
        {predictions.map((prediction, index) => (
          <PredictionCard
            key={prediction.player_id}
            prediction={prediction}
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
};

const PredictionCard = ({ prediction, rank }) => {
  const probability = (prediction.hit_probability * 100).toFixed(1);

  return (
    <div className="prediction-card">
      <div className="rank-badge">#{rank}</div>

      <div className="player-info">
        <h3 className="player-name">{prediction.player_name}</h3>
        <p className="team-matchup">
          {prediction.team_id} vs {prediction.opponent_team_id}
        </p>
        <p className="game-time">{prediction.game_time}</p>
      </div>

      <div className="probability-section">
        <div className="probability-value">{probability}%</div>
        <div className="probability-label">Hit Probability</div>
        <div className="probability-bar">
          <div
            className="probability-fill"
            style={{ width: `${probability}%` }}
          />
        </div>
      </div>

      {prediction.batting_order_position > 0 && (
        <div className="lineup-position">
          Batting {prediction.batting_order_position}
        </div>
      )}
    </div>
  );
};

export default TodaysPredictions;
```

---

## Performance Optimizations

### Backend Caching

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

router.get('/today', async (req, res) => {
  const cacheKey = `predictions_${riskProfile}_${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const predictions = await bigQueryService.getTodaysPredictions(riskProfile, limit);
  cache.set(cacheKey, predictions);

  res.json(predictions);
});
```

### Frontend Caching with React Query

```bash
npm install @tanstack/react-query
```

```javascript
import { useQuery } from '@tanstack/react-query';

export const usePredictions = (riskProfile, limit) => {
  return useQuery({
    queryKey: ['predictions', riskProfile, limit],
    queryFn: () => predictionsApi.getTodaysPredictions(riskProfile, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
};
```

---

## Security Best Practices

1. **Never expose GCP credentials in frontend** - Keep service account keys on backend only
2. **Rate limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   app.use('/api/predictions', limiter);
   ```

3. **CORS configuration**:
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:3000'
   }));
   ```

4. **Input validation**:
   ```javascript
   const { query, validationResult } = require('express-validator');

   router.get('/today',
     query('riskProfile').isIn(['aggressive', 'balanced', 'conservative']),
     query('limit').isInt({ min: 1, max: 100 }),
     (req, res) => {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       // ... handle request
     }
   );
   ```

---

## API Endpoints Summary

**Key Endpoints:**
- `GET /api/predictions/today` - Today's predictions by risk profile
- `GET /api/predictions/top` - Top pick for today
- `GET /api/predictions/player/:playerId` - Player-specific prediction

**Example Response:**

```json
{
  "success": true,
  "date": "2025-06-15",
  "riskProfile": "balanced",
  "count": 10,
  "predictions": [
    {
      "player_id": "660271",
      "player_name": "Juan Soto",
      "team_id": "NYY",
      "opponent_team_id": "BOS",
      "game_date": "2025-06-15",
      "game_time": "7:05 PM ET",
      "batting_order_position": 2,
      "hit_probability": 0.752,
      "confidence_score": 0.752,
      "rank_overall": 1,
      "prediction_timestamp": "2025-06-15T13:00:00Z"
    }
  ]
}
```

---

## Summary

**Backend (Node.js/Express):**
- BigQuery service to query predictions table
- REST API endpoints for predictions
- Caching to reduce BigQuery costs
- Rate limiting and CORS

**Frontend (React):**
- API client to fetch predictions
- Custom hooks for data fetching
- UI components to display predictions
- Responsive design
- React Query for caching

Your web app is now ready to display ML-powered Beat the Streak predictions! 🎯⚾
