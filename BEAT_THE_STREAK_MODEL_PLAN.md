# Beat the Streak Model - Implementation Plan

## Executive Summary

This document outlines a comprehensive model to maximize success in MLB's Beat the Streak competition. The model uses rolling statistics, advanced Statcast metrics, and pitcher-batter matchup data to predict which players have the highest probability of recording at least one hit on any given day.

---

## 1. Objective & Success Metrics

### Primary Objective
Maximize the length of consecutive correct picks (streak length) in the Beat the Streak competition.

### Key Performance Indicators (KPIs)
1. **Average streak length** achieved over multiple simulated seasons
2. **Max streak length** reached in backtesting
3. **Pick accuracy rate** (% of picks that get ≥1 hit)
4. **Risk-adjusted performance**: Maintaining high accuracy during long streaks
5. **Consistency**: Performance across different months/conditions

### Target Benchmarks
- **Minimum viable accuracy**: 65% (baseline for competition viability)
- **Target accuracy**: 70-75% (competitive performance)
- **Elite accuracy**: 78%+ (top-tier predictions)

---

## 2. Data Requirements & Feature Engineering

### 2.1 Core Data Tables (Already Available)

✅ **Player Stats**
- `fct_mlb__player_batting_stats` - Traditional batting stats
- `fct_mlb__player_season_stats` - Season aggregations with percentiles
- `fct_mlb__player_pitching_season_stats` - Pitcher season stats

✅ **Statcast Data**
- `fct_mlb__player_batted_ball_season_stats` - Exit velo, barrels, launch angles
- `fct_mlb__player_pitch_heatmap` - Pitch locations and outcomes
- `fct_mlb__pitch_zone_outcomes` - Zone-specific pitch results

✅ **Game-Level Data**
- `fct_mlb__team_game_stats` - Game-by-game team performance

### 2.2 New Tables/Views Needed

#### **Priority 1: Rolling Statistics Table**
```sql
CREATE TABLE fct_mlb__player_rolling_batting_stats AS
SELECT
  player_id,
  game_date,
  team_id,

  -- Last 7 days
  AVG(hits) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as hits_L7,
  AVG(batting_average) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as avg_L7,
  SUM(games_with_hit) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as hit_streak_L7,

  -- Last 15 days
  AVG(hits) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as hits_L15,
  AVG(batting_average) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as avg_L15,

  -- Last 30 days
  AVG(hits) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) as hits_L30,
  AVG(batting_average) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) as avg_L30,
  AVG(obp) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) as obp_L30,
  AVG(slg) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) as slg_L30,

  -- Plate discipline (last 15 days)
  AVG(strikeout_rate) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as k_rate_L15,
  AVG(walk_rate) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as bb_rate_L15,

  -- Statcast rolling (last 15 days)
  AVG(avg_exit_velo) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as exit_velo_L15,
  AVG(hard_hit_rate) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as hard_hit_rate_L15,
  AVG(barrel_rate) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) as barrel_rate_L15,

  -- Recent form indicators
  SUM(CASE WHEN hits > 0 THEN 1 ELSE 0 END) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) as games_with_hit_L5,
  SUM(hits) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as total_hits_L3

FROM fct_mlb__player_batting_game_stats -- Need to create this from existing data
```

#### **Priority 2: Pitcher vs Batter Matchup History**
```sql
CREATE TABLE fct_mlb__pitcher_batter_matchups AS
SELECT
  batter_id,
  pitcher_id,
  COUNT(*) as total_matchups,
  SUM(CASE WHEN hits > 0 THEN 1 ELSE 0 END) as games_with_hit,
  SUM(hits) as total_hits,
  SUM(at_bats) as total_at_bats,
  SUM(home_runs) as total_home_runs,
  SUM(strikeouts) as total_strikeouts,
  SAFE_DIVIDE(SUM(hits), SUM(at_bats)) as career_avg_vs_pitcher,

  -- Recent matchup performance (last 3 years)
  SUM(CASE WHEN season >= EXTRACT(YEAR FROM CURRENT_DATE()) - 3 THEN hits ELSE 0 END) as recent_hits,
  SUM(CASE WHEN season >= EXTRACT(YEAR FROM CURRENT_DATE()) - 3 THEN at_bats ELSE 0 END) as recent_at_bats,

  -- Last matchup details
  MAX(game_date) as last_matchup_date,
  ANY_VALUE(hits ORDER BY game_date DESC LIMIT 1) as last_matchup_hits

FROM fct_mlb__game_batting_stats -- Assumes game-level batting data exists
GROUP BY batter_id, pitcher_id
HAVING total_at_bats >= 5 -- Minimum sample size
```

#### **Priority 3: Daily Game Context**
```sql
CREATE TABLE fct_mlb__daily_game_context AS
SELECT
  game_id,
  game_date,
  home_team_id,
  away_team_id,
  home_probable_pitcher_id,
  away_probable_pitcher_id,
  ballpark_id,

  -- Weather (if available)
  temperature,
  wind_speed,
  wind_direction,

  -- Game context
  day_or_night,
  is_doubleheader,
  game_number_in_series,

  -- Team streaks
  home_team_win_streak,
  away_team_win_streak,

  -- Ballpark factors
  park_factor_runs,
  park_factor_hr

FROM fct_mlb__games
```

#### **Priority 4: Pitcher Rolling Stats**
Similar structure to batter rolling stats but for pitchers:
- Last 5 starts metrics (ERA, WHIP, K/9, BB/9)
- Recent pitch velocity trends
- Opponent batting average last 15 days
- Recent quality start percentage

---

## 3. Feature Engineering Strategy

### 3.1 Player Form Features (Weight: 40%)

**Recent Performance (L7, L15, L30)**
- `rolling_batting_avg_L7`, `_L15`, `_L30`
- `rolling_obp_L7`, `_L15`, `_L30`
- `rolling_slg_L15`, `_L30`
- `games_with_hit_last_5` (binary streak indicator)
- `hit_percentage_L10` (% of last 10 games with hit)
- `multi_hit_games_L15` (shows hot streaks)

**Consistency Metrics**
- `std_dev_hits_L15` (consistency indicator)
- `median_hits_L30`
- `hit_drought_games` (games since last hit, if any)

**Statcast Form**
- `avg_exit_velo_L15` (quality of contact)
- `hard_hit_rate_L15` (>95 mph exit velo %)
- `barrel_rate_L15` (optimal contact %)
- `sweet_spot_rate_L15` (launch angle 8-32°)
- `chase_rate_L15` (discipline metric)

### 3.2 Pitcher-Batter Matchup Features (Weight: 30%)

**Historical Matchup**
- `career_avg_vs_pitcher`
- `career_obp_vs_pitcher`
- `total_matchups_count`
- `recent_avg_vs_pitcher_L3Y` (last 3 years)
- `last_matchup_result` (success in most recent PA)

**Platoon Splits**
- `batter_vs_same_hand_avg` (L vs L, R vs R)
- `batter_vs_opposite_hand_avg` (L vs R, R vs L)
- `platoon_advantage` (binary: favorable matchup?)

**Pitcher Form vs Batter Type**
- `pitcher_avg_against_L_hitters_L15` (if batter is lefty)
- `pitcher_avg_against_R_hitters_L15` (if batter is righty)
- `pitcher_whip_L5_starts`
- `pitcher_k_rate_L5_starts`
- `pitcher_velo_change_L5` (velocity drop = fatigue)

**Zone-Specific Matchup**
- Extract from `fct_mlb__pitch_zone_outcomes`:
  - Pitcher's success rate in batter's hot zones
  - Batter's success rate against pitcher's primary pitch type
  - Example: "Batter hits .350 in low-outside zone, pitcher throws 40% of pitches there"

### 3.3 Contextual Features (Weight: 20%)

**Ballpark Factors**
- `park_factor_hits` (is this a hitter-friendly park?)
- `park_factor_by_hand` (some parks favor lefties/righties)
- `historic_batting_avg_in_park` (player's history at this venue)

**Lineup Position**
- `batting_order_position` (1-2 = more PAs)
- `avg_plate_appearances_by_lineup_spot`

**Game Situation**
- `day_game_vs_night_game` (some players perform better in day games)
- `home_vs_away` (player's split)
- `vs_division_opponent` (familiarity)
- `days_rest` (how many days since last game)
- `is_doubleheader` (fatigue factor)

**Team Offensive Environment**
- `team_runs_per_game_L15`
- `team_obp_L15`
- `team_position_in_standings` (motivation factor)

### 3.4 Seasonal Context Features (Weight: 10%)

**Season-to-Date Performance**
- `season_batting_avg`
- `season_batting_avg_percentile` (vs league)
- `season_obp_percentile`
- `season_games_played` (playing time indicator)
- `season_pa` (sample size confidence)

**Career Baseline**
- `career_batting_avg`
- `career_obp`
- `years_in_mlb` (experience factor)
- `all_star_selections` (talent tier proxy)

---

## 4. Model Architecture

### 4.1 Ensemble Approach (Recommended)

Build three complementary models and ensemble their predictions:

#### **Model 1: Gradient Boosted Trees (XGBoost/LightGBM)**
- **Purpose**: Capture non-linear relationships and feature interactions
- **Strengths**:
  - Excellent at handling missing data
  - Naturally captures feature interactions (e.g., hot hitter vs weak pitcher)
  - Strong baseline performance
- **Input**: All 60-80 engineered features
- **Output**: Probability of getting ≥1 hit
- **Weight in ensemble**: 50%

#### **Model 2: Logistic Regression with Engineered Interactions**
- **Purpose**: Provide interpretable baseline with explicit interactions
- **Key interactions to engineer**:
  - `rolling_avg_L7 * pitcher_era_L5`
  - `platoon_advantage * career_vs_hand_avg`
  - `exit_velo_L15 * park_factor_hits`
  - `games_with_hit_L5 * (1 - pitcher_whip_L5)` (hot hitter vs weak pitcher)
- **Strengths**:
  - Interpretable coefficients
  - Stable predictions
  - Good calibration
- **Weight in ensemble**: 25%

#### **Model 3: Deep Neural Network (Optional - Advanced)**
- **Purpose**: Capture complex temporal patterns
- **Architecture**:
  - Input layer: Feature vector (60-80 features)
  - Hidden layers: [128, 64, 32] neurons with ReLU + dropout
  - Output layer: Sigmoid activation (probability)
- **Special inputs**: Sequence data
  - Last 10 games' performance vector (LSTM/GRU layer)
  - Pitch location heatmap embeddings (2D CNN for spatial patterns)
- **Weight in ensemble**: 25%

### 4.2 Ensemble Combination Strategy

```python
# Weighted average with dynamic adjustment
def ensemble_prediction(xgb_prob, lr_prob, nn_prob, streak_length):
    base_weights = [0.50, 0.25, 0.25]  # XGB, LR, NN

    # Increase weight on stable models during long streaks
    if streak_length >= 20:
        adjusted_weights = [0.40, 0.40, 0.20]  # Favor interpretable LR
    elif streak_length >= 10:
        adjusted_weights = [0.45, 0.30, 0.25]
    else:
        adjusted_weights = base_weights

    ensemble_prob = (
        adjusted_weights[0] * xgb_prob +
        adjusted_weights[1] * lr_prob +
        adjusted_weights[2] * nn_prob
    )

    return ensemble_prob
```

---

## 5. Risk-Adjusted Selection Strategy

### 5.1 Streak-Based Risk Profiles

The model should adjust conservatism based on current streak length:

| Streak Range | Risk Profile | Min Probability Threshold | Strategy |
|--------------|--------------|---------------------------|----------|
| 0-5 games | **Aggressive** | 60% | Maximize expected hits, take calculated risks |
| 6-15 games | **Balanced** | 65% | Balance upside with consistency |
| 16-30 games | **Conservative** | 70% | Prioritize high-confidence picks |
| 31-45 games | **Very Conservative** | 75% | Only elite matchups |
| 46+ games | **Ultra Conservative** | 80% | Historical success + perfect conditions |

### 5.2 Pick Selection Algorithm

```python
def select_daily_pick(predictions_df, current_streak):
    # Step 1: Apply streak-based threshold
    threshold = get_threshold_by_streak(current_streak)
    candidates = predictions_df[predictions_df['hit_probability'] >= threshold]

    # Step 2: Apply quality filters
    candidates = candidates[
        (candidates['games_played_L7'] >= 4) &  # Must be active
        (candidates['season_pa'] >= 50) &  # Minimum sample size
        (candidates['batting_order'] <= 6)  # Reasonable PAs expected
    ]

    # Step 3: Confidence scoring
    candidates['confidence_score'] = (
        candidates['hit_probability'] * 0.6 +  # Base probability
        candidates['model_agreement'] * 0.2 +  # All 3 models agree?
        candidates['sample_size_confidence'] * 0.1 +  # Enough data?
        candidates['recent_consistency'] * 0.1  # Low variance?
    )

    # Step 4: Risk adjustment for high streaks
    if current_streak >= 20:
        # Penalize variance
        candidates['confidence_score'] *= (1 - candidates['std_dev_hits_L15'] * 0.3)

    # Step 5: Select top pick
    top_pick = candidates.nlargest(1, 'confidence_score')

    return top_pick
```

### 5.3 Tiebreaker Criteria (When Multiple Players Near Equal Probability)

1. **Playing time certainty**: Starter > Platoon player
2. **Sample size**: More PAs in window = more confidence
3. **Recent consistency**: Prefer steady performer over streaky
4. **Matchup sample size**: 20+ PAs vs pitcher > 5 PAs
5. **Game time**: Earlier game = can pivot if scratch/weather

---

## 6. Model Training Strategy

### 6.1 Training Data Preparation

**Historical Training Window**
- Use last 5 seasons (2020-2024) for training
- Holdout 2025 season for final validation

**Target Variable Creation**
```sql
SELECT
  player_id,
  game_date,
  CASE WHEN hits >= 1 THEN 1 ELSE 0 END as got_hit,  -- Binary target
  hits as num_hits  -- Auxiliary target for regression
FROM fct_mlb__player_batting_game_stats
```

**Train/Validation/Test Split**
- 70% training (2020-2022 seasons)
- 15% validation (2023 season)
- 15% test (2024 season)
- Use **temporal split** (not random) to prevent data leakage

### 6.2 Feature Importance Analysis

After training, analyze top features for each model:

```python
# XGBoost feature importance
import xgboost as xgb

xgb_model.get_score(importance_type='gain')

# Expected top features:
# 1. rolling_avg_L7
# 2. rolling_avg_L15
# 3. games_with_hit_L5
# 4. platoon_advantage
# 5. career_avg_vs_pitcher
# 6. pitcher_whip_L5
# 7. exit_velo_L15
# 8. park_factor_hits
# 9. batting_order_position
# 10. hard_hit_rate_L15
```

### 6.3 Hyperparameter Tuning

**XGBoost Tuning (using Optuna or GridSearchCV)**
```python
param_grid = {
    'max_depth': [4, 6, 8],
    'learning_rate': [0.01, 0.05, 0.1],
    'n_estimators': [200, 500, 1000],
    'min_child_weight': [1, 3, 5],
    'subsample': [0.7, 0.8, 0.9],
    'colsample_bytree': [0.7, 0.8, 0.9],
    'gamma': [0, 0.1, 0.2]
}
```

**Optimization Metric**: Custom "Streak Score"
- Not just accuracy, but simulate 162-game season
- Maximize `average_max_streak_length`

```python
def streak_score_metric(y_true, y_pred_proba, threshold=0.65):
    """
    Simulate Beat the Streak scoring over a season.
    Prioritize reducing hitless predictions (streak killers).
    """
    picks = y_pred_proba >= threshold
    results = y_true[picks]

    # Calculate streak lengths
    streaks = []
    current_streak = 0
    for hit in results:
        if hit == 1:
            current_streak += 1
        else:
            streaks.append(current_streak)
            current_streak = 0
    streaks.append(current_streak)

    # Scoring: maximize average of top 5 streaks
    top_streaks = sorted(streaks, reverse=True)[:5]
    return np.mean(top_streaks)
```

---

## 7. Evaluation & Backtesting Framework

### 7.1 Backtesting Methodology

**Simulated Season Approach**
1. Start with streak = 0
2. For each game day in 2024 season:
   - Use only data available *before* that date (no lookahead bias)
   - Generate predictions for all players in action
   - Select top pick using algorithm
   - Record result (hit or no hit)
   - Update streak accordingly
3. Track: max streak, average accuracy, streak distribution

**Key Metrics to Track**
```python
backtest_results = {
    'total_picks': 162,  # Full season
    'correct_picks': 115,  # Hits
    'accuracy': 0.710,  # 71%
    'max_streak': 18,
    'average_streak': 4.2,
    'median_streak': 3,
    'streaks_10_plus': 3,  # Count of 10+ game streaks
    'longest_drought': 4,  # Longest gap between streaks

    # Calibration
    'predicted_prob_when_hit': 0.72,
    'predicted_prob_when_no_hit': 0.61,
    'brier_score': 0.185,  # Lower is better

    # By streak range
    'accuracy_streak_0_5': 0.68,
    'accuracy_streak_6_15': 0.73,
    'accuracy_streak_16_plus': 0.78
}
```

### 7.2 Calibration Analysis

Ensure predicted probabilities match actual hit rates:

```python
# Calibration plot
from sklearn.calibration import calibration_curve

prob_true, prob_pred = calibration_curve(
    y_true, y_pred_proba, n_bins=10, strategy='quantile'
)

# Goal: Points should fall on diagonal (perfect calibration)
# If model overconfident: Calibrate with Platt scaling or isotonic regression
```

### 7.3 Error Analysis

Analyze false negatives (picks that went hitless) to identify patterns:

```python
false_negatives = predictions_df[
    (predictions_df['prediction'] == 1) &
    (predictions_df['actual_hit'] == 0)
]

# Common failure modes to investigate:
# 1. Hot hitter vs elite pitcher (model overweighted form)
# 2. Day game after night game (fatigue not captured)
# 3. Return from injury (rust factor missing)
# 4. Weather postponement/late scratch (external factor)
# 5. Pitcher change (bullpen game not anticipated)
```

---

## 8. Daily Prediction Pipeline

### 8.1 Daily Data Refresh Workflow

**Morning Routine (9:00 AM ET daily)**

```python
def daily_pipeline():
    # Step 1: Refresh rolling stats (incorporate yesterday's games)
    update_rolling_batting_stats()
    update_rolling_pitching_stats()

    # Step 2: Fetch today's game slate
    todays_games = get_todays_mlb_schedule()

    # Step 3: Get probable pitchers (check MLB API)
    probable_pitchers = get_probable_pitchers(todays_games)

    # Step 4: Identify eligible batters
    # - Starting lineup announced (typically 2-4 hours before game)
    # - Not on IL
    # - Not in platoon sitting vs same-handed pitcher
    eligible_batters = get_starting_lineups(todays_games)

    # Step 5: Generate feature matrix for all eligible batters
    feature_matrix = build_feature_matrix(eligible_batters, probable_pitchers)

    # Step 6: Run ensemble models
    predictions = ensemble_predict(feature_matrix)

    # Step 7: Apply selection algorithm
    top_pick = select_daily_pick(predictions, current_streak)

    # Step 8: Output recommendation
    return {
        'player_id': top_pick['player_id'],
        'player_name': top_pick['player_name'],
        'opponent': top_pick['opponent'],
        'pitcher_name': top_pick['pitcher_name'],
        'hit_probability': top_pick['hit_probability'],
        'confidence_score': top_pick['confidence_score'],
        'game_time': top_pick['game_time'],
        'reasoning': generate_explanation(top_pick)
    }
```

### 8.2 Real-Time Monitoring

**During Game Day**
- Monitor for lineup changes (injuries, rest days announced late)
- Track weather delays/postponements
- If top pick scratched: auto-select next best pick
- Post-game: Update streak and retrain if needed

### 8.3 Model Retraining Schedule

**Frequency**: Monthly during season
- Incorporate last 30 days of new data
- Retrain on rolling 3-year window
- Validate on holdout set before deploying

**Triggers for Emergency Retrain**:
- Model accuracy drops below 60% over 10-day window
- Major rule change (e.g., pitch clock introduced)
- Significant drift in feature distributions

---

## 9. Advanced Enhancements (Phase 2)

### 9.1 Pitcher-Specific Modeling

Some pitchers are "hit-killers" (elite stuff, low BABIP). Build pitcher profiles:
- **Ace tier**: Require 80%+ confidence to pick against
- **Average tier**: Standard model
- **Weak tier**: Boost batter confidence 5-10%

### 9.2 Weather Integration

Add weather data (temperature, wind, humidity) from API:
- Hot weather + wind out = boost hit probability
- Cold weather + wind in = reduce probability
- Dome games = ignore weather

### 9.3 Umpire Strike Zone Adjustments

Different umpires have different strike zones:
- Large zone = favor pitcher (reduce hit prob)
- Small zone = favor hitter (increase hit prob)
- Data source: Umpire Scorecards or Statcast umpire data

### 9.4 Fatigue Modeling

Track pitcher and batter workload:
- **Pitcher**: Days rest, recent pitch count, mid-season velocity drop
- **Batter**: Games played last 7 days, travel schedule (West to East coast)

### 9.5 Transfer Learning from Minor Leagues

For rookies with limited MLB data, use their AAA stats:
- Adjust for competition level (multiply AAA stats by 0.85)
- Use similar players' MLB transition curves

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)

**Week 1: Data Engineering**
- [ ] Create `fct_mlb__player_batting_game_stats` table (game-level batting data)
- [ ] Build `fct_mlb__player_rolling_batting_stats` table
- [ ] Build `fct_mlb__pitcher_rolling_stats` table
- [ ] Create `fct_mlb__pitcher_batter_matchups` table
- [ ] Set up daily data refresh pipeline

**Week 2: Feature Engineering**
- [ ] Engineer all 60-80 features outlined in Section 3
- [ ] Create feature calculation functions
- [ ] Validate feature quality (null rates, distributions)
- [ ] Build feature importance baseline (correlation analysis)

**Week 3: Baseline Modeling**
- [ ] Prepare training data (2020-2023)
- [ ] Train Logistic Regression baseline
- [ ] Train XGBoost model
- [ ] Evaluate on 2024 test set
- [ ] Establish baseline metrics

### Phase 2: Advanced Modeling (Weeks 4-5)

**Week 4: Ensemble & Optimization**
- [ ] Build ensemble combination logic
- [ ] Implement streak-based risk profiles
- [ ] Build selection algorithm
- [ ] Hyperparameter tuning (Optuna)
- [ ] Calibration analysis

**Week 5: Backtesting**
- [ ] Build backtesting framework
- [ ] Run full 2024 season simulation
- [ ] Error analysis on false negatives
- [ ] Refine feature engineering based on errors
- [ ] Iterate model improvements

### Phase 3: Production System (Week 6)

**Week 6: Daily Pipeline**
- [ ] Build daily data refresh job (cron)
- [ ] Integrate MLB API for lineups/pitchers
- [ ] Create prediction generation script
- [ ] Build simple dashboard for daily picks
- [ ] Set up alerts/notifications

### Phase 4: Monitoring & Iteration (Ongoing)

- [ ] Track daily accuracy and streak performance
- [ ] Monthly model retraining
- [ ] Quarterly feature engineering review
- [ ] Continuous backtesting on new data

---

## 11. Technical Stack Recommendations

### Data Processing
- **SQL (BigQuery)**: Rolling stats calculation, feature engineering
- **Python (pandas)**: Data manipulation, feature matrix construction
- **dbt (optional)**: Transform layer for clean data modeling

### Machine Learning
- **scikit-learn**: Logistic Regression, preprocessing, evaluation
- **XGBoost / LightGBM**: Gradient boosting models
- **TensorFlow / PyTorch**: Neural network (if pursuing Phase 2)
- **Optuna**: Hyperparameter optimization

### Daily Pipeline
- **Airflow / Prefect**: Orchestration for daily jobs
- **MLB-StatsAPI (Python)**: Fetch lineups, pitchers, schedules
- **Cloud Functions / Lambda**: Serverless prediction endpoint

### Monitoring & Visualization
- **Streamlit / Dash**: Quick dashboard for daily picks
- **Weights & Biases / MLflow**: Model experiment tracking
- **Google Sheets API**: Simple output for daily picks

---

## 11.5. Repository Structure & Separation

### Why Separate Repository?

**Recommended Approach**: Create a new repository `beat-the-streak-ml` separate from `statshq`.

**Benefits**:
1. **Clean separation of concerns**: ML pipeline vs dashboard application
2. **Independent deployment cycles**: Deploy models without affecting UI
3. **Model versioning**: Track experiments, model versions, and training data separately
4. **Team collaboration**: ML engineers can work independently from frontend developers
5. **Security**: Keep training data and model artifacts separate from public-facing app
6. **CI/CD**: Different testing and deployment strategies for ML vs web apps

### Proposed Repository Structure

```
beat-the-streak-ml/
├── README.md
├── requirements.txt
├── setup.py
├── .gitignore
├── .env.example
│
├── config/
│   ├── config.yaml                 # Model hyperparameters, feature lists
│   ├── bigquery_config.yaml        # BigQuery dataset/table names
│   └── vertex_ai_config.yaml       # Vertex AI deployment settings
│
├── data/
│   ├── raw/                        # Raw data exports (not in git)
│   ├── processed/                  # Processed feature matrices (not in git)
│   └── schemas/
│       └── feature_schema.yaml     # Feature definitions and types
│
├── sql/
│   ├── 01_rolling_stats.sql        # Rolling batting stats table
│   ├── 02_pitcher_rolling.sql      # Rolling pitching stats table
│   ├── 03_matchup_history.sql      # Pitcher-batter matchup table
│   ├── 04_daily_context.sql        # Daily game context
│   └── 05_feature_extraction.sql   # Main feature query
│
├── src/
│   ├── __init__.py
│   │
│   ├── data/
│   │   ├── __init__.py
│   │   ├── bigquery_client.py      # BigQuery connection utilities
│   │   ├── data_loader.py          # Load training data from BigQuery
│   │   ├── feature_engineering.py  # Feature calculation functions
│   │   └── mlb_api_client.py       # MLB Stats API for lineups/schedules
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base_model.py           # Abstract base model class
│   │   ├── xgboost_model.py        # XGBoost implementation
│   │   ├── logistic_model.py       # Logistic Regression implementation
│   │   ├── neural_net_model.py     # Neural network (optional)
│   │   └── ensemble.py             # Ensemble combination logic
│   │
│   ├── training/
│   │   ├── __init__.py
│   │   ├── train.py                # Main training script
│   │   ├── evaluate.py             # Model evaluation
│   │   ├── hyperparameter_tuning.py # Optuna tuning
│   │   └── backtesting.py          # Backtest simulation
│   │
│   ├── prediction/
│   │   ├── __init__.py
│   │   ├── predictor.py            # Load model and generate predictions
│   │   ├── risk_adjustment.py      # Streak-based risk profiles
│   │   └── pick_selector.py        # Daily pick selection algorithm
│   │
│   ├── deployment/
│   │   ├── __init__.py
│   │   ├── vertex_ai_deploy.py     # Vertex AI deployment scripts
│   │   ├── model_registry.py       # Track model versions
│   │   └── prediction_service.py   # Vertex AI custom prediction handler
│   │
│   └── utils/
│       ├── __init__.py
│       ├── logging_config.py
│       ├── metrics.py              # Custom metrics (streak score, etc.)
│       └── helpers.py
│
├── notebooks/
│   ├── 01_eda.ipynb                # Exploratory data analysis
│   ├── 02_feature_analysis.ipynb   # Feature importance and correlation
│   ├── 03_model_experiments.ipynb  # Model experimentation
│   └── 04_error_analysis.ipynb     # False negative analysis
│
├── tests/
│   ├── test_data_loader.py
│   ├── test_features.py
│   ├── test_models.py
│   └── test_prediction.py
│
├── scripts/
│   ├── setup_bigquery_tables.sh    # Run all SQL setup scripts
│   ├── daily_pipeline.py           # Daily prediction generation
│   ├── retrain_model.py            # Monthly retraining job
│   └── export_to_vertex_ai.py      # Export model to Vertex AI format
│
├── models/                         # Saved models (not in git, except .gitkeep)
│   ├── .gitkeep
│   ├── xgboost_v1.0.0.pkl
│   ├── logistic_v1.0.0.pkl
│   └── ensemble_v1.0.0.pkl
│
├── vertex_ai/
│   ├── Dockerfile                  # Container for Vertex AI serving
│   ├── predictor.py                # Custom prediction logic
│   ├── requirements.txt            # Prediction dependencies
│   └── cloudbuild.yaml             # Build config for container
│
└── outputs/                        # Prediction outputs (not in git)
    ├── daily_predictions/
    │   └── 2025-04-15_predictions.json
    └── backtest_results/
        └── 2024_full_season_backtest.csv
```

---

## 11.6. Local Training Workflow

### Step 1: Environment Setup

**1.1 Create New Repository**
```bash
# On your local machine or Codespace
cd ~/projects
mkdir beat-the-streak-ml
cd beat-the-streak-ml
git init
```

**1.2 Create Python Virtual Environment**
```bash
# Using Python 3.10+
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip
```

**1.3 Install Dependencies**

Create `requirements.txt`:
```
# Data Processing
pandas==2.1.4
numpy==1.26.3
pyarrow==14.0.2
google-cloud-bigquery==3.14.1
python-dotenv==1.0.0

# Machine Learning
scikit-learn==1.4.0
xgboost==2.0.3
lightgbm==4.2.0
optuna==3.5.0
shap==0.44.1  # Model explainability

# MLB Data
mlb-statsapi==1.6.3

# Vertex AI
google-cloud-aiplatform==1.42.1
google-cloud-storage==2.14.0

# Utilities
pyyaml==6.0.1
click==8.1.7
tqdm==4.66.1

# Monitoring & Logging
mlflow==2.9.2
wandb==0.16.2  # Optional: Weights & Biases for experiment tracking

# Testing
pytest==7.4.4
pytest-cov==4.1.0

# Notebooks
jupyter==1.0.0
matplotlib==3.8.2
seaborn==0.13.1
```

Install:
```bash
pip install -r requirements.txt
```

**1.4 Configure Environment Variables**

Create `.env` file:
```bash
# Google Cloud
GCP_PROJECT_ID=your-project-id
GCP_DATASET=mlb
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json
GCS_BUCKET=beat-the-streak-models

# Vertex AI
VERTEX_AI_REGION=us-central1
VERTEX_AI_ENDPOINT_NAME=beat-the-streak-predictor

# Model Settings
MODEL_VERSION=1.0.0
TRAINING_WINDOW_YEARS=5
MIN_PREDICTION_CONFIDENCE=0.65

# MLflow / Weights & Biases (optional)
MLFLOW_TRACKING_URI=http://localhost:5000
WANDB_PROJECT=beat-the-streak
```

### Step 2: Create BigQuery Tables

**2.1 Run SQL Setup Scripts**

Create `scripts/setup_bigquery_tables.sh`:
```bash
#!/bin/bash
set -e

echo "Setting up BigQuery tables for Beat the Streak model..."

PROJECT_ID=$GCP_PROJECT_ID
DATASET=mlb

# Run each SQL script
echo "Creating rolling batting stats table..."
bq query --use_legacy_sql=false < sql/01_rolling_stats.sql

echo "Creating pitcher rolling stats table..."
bq query --use_legacy_sql=false < sql/02_pitcher_rolling.sql

echo "Creating pitcher-batter matchup table..."
bq query --use_legacy_sql=false < sql/03_matchup_history.sql

echo "Creating daily game context table..."
bq query --use_legacy_sql=false < sql/04_daily_context.sql

echo "BigQuery tables created successfully!"
```

Run:
```bash
chmod +x scripts/setup_bigquery_tables.sh
./scripts/setup_bigquery_tables.sh
```

### Step 3: Train Models Locally

**3.1 Main Training Script**

Create `src/training/train.py`:
```python
import os
import pickle
from datetime import datetime
import yaml
from google.cloud import bigquery
import pandas as pd
from sklearn.model_selection import train_test_split
import xgboost as xgb
from sklearn.linear_model import LogisticRegression

from src.data.data_loader import load_training_data
from src.data.feature_engineering import engineer_features
from src.utils.metrics import calculate_streak_score


def train_models(config_path='config/config.yaml'):
    """Main training pipeline"""

    # Load config
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    print("Loading training data from BigQuery...")
    # Load data (2020-2024)
    df = load_training_data(
        start_year=2020,
        end_year=2024
    )

    print(f"Loaded {len(df)} training examples")

    # Feature engineering
    print("Engineering features...")
    X, y = engineer_features(df)

    # Train/validation/test split (temporal)
    train_cutoff = '2022-12-31'
    val_cutoff = '2023-12-31'

    train_mask = df['game_date'] <= train_cutoff
    val_mask = (df['game_date'] > train_cutoff) & (df['game_date'] <= val_cutoff)
    test_mask = df['game_date'] > val_cutoff

    X_train, y_train = X[train_mask], y[train_mask]
    X_val, y_val = X[val_mask], y[val_mask]
    X_test, y_test = X[test_mask], y[test_mask]

    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # Train XGBoost
    print("\nTraining XGBoost model...")
    xgb_model = xgb.XGBClassifier(
        n_estimators=config['xgboost']['n_estimators'],
        max_depth=config['xgboost']['max_depth'],
        learning_rate=config['xgboost']['learning_rate'],
        subsample=config['xgboost']['subsample'],
        colsample_bytree=config['xgboost']['colsample_bytree'],
        random_state=42,
        eval_metric='logloss'
    )

    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=10
    )

    # Train Logistic Regression
    print("\nTraining Logistic Regression model...")
    lr_model = LogisticRegression(
        C=config['logistic']['C'],
        max_iter=1000,
        random_state=42
    )
    lr_model.fit(X_train, y_train)

    # Evaluate on test set
    print("\nEvaluating models on test set...")
    xgb_preds = xgb_model.predict_proba(X_test)[:, 1]
    lr_preds = lr_model.predict_proba(X_test)[:, 1]

    # Calculate metrics
    from sklearn.metrics import accuracy_score, roc_auc_score, log_loss

    print(f"\nXGBoost Metrics:")
    print(f"  Accuracy: {accuracy_score(y_test, xgb_preds >= 0.5):.3f}")
    print(f"  ROC-AUC: {roc_auc_score(y_test, xgb_preds):.3f}")
    print(f"  Log Loss: {log_loss(y_test, xgb_preds):.3f}")

    print(f"\nLogistic Regression Metrics:")
    print(f"  Accuracy: {accuracy_score(y_test, lr_preds >= 0.5):.3f}")
    print(f"  ROC-AUC: {roc_auc_score(y_test, lr_preds):.3f}")
    print(f"  Log Loss: {log_loss(y_test, lr_preds):.3f}")

    # Save models
    print("\nSaving models...")
    version = config['model_version']
    os.makedirs('models', exist_ok=True)

    with open(f'models/xgboost_v{version}.pkl', 'wb') as f:
        pickle.dump(xgb_model, f)

    with open(f'models/logistic_v{version}.pkl', 'wb') as f:
        pickle.dump(lr_model, f)

    # Save feature names
    feature_names = X.columns.tolist()
    with open(f'models/feature_names_v{version}.pkl', 'wb') as f:
        pickle.dump(feature_names, f)

    print(f"\nModels saved to models/ directory")

    return xgb_model, lr_model


if __name__ == '__main__':
    train_models()
```

**3.2 Run Training**
```bash
python src/training/train.py
```

**3.3 Run Backtesting**
```bash
python src/training/backtesting.py --year 2024 --output outputs/backtest_results/
```

---

## 11.7. Vertex AI Deployment (Step-by-Step)

### Overview

Deploy your trained models to **Vertex AI** for:
- **Scalable serving**: Auto-scaling prediction endpoints
- **Model versioning**: Track and rollback model versions
- **Monitoring**: Built-in prediction logging and drift detection
- **Integration**: Easy API access from StatshQ backend

### Architecture

```
Local Training → GCS Bucket → Vertex AI Model Registry → Vertex AI Endpoint → StatshQ API
```

---

### Step 1: Prepare Model for Vertex AI

**1.1 Create Custom Predictor Class**

Vertex AI needs a custom predictor that implements `predict()` method.

Create `vertex_ai/predictor.py`:
```python
import os
import pickle
import pandas as pd
from google.cloud import bigquery
from typing import Dict, List, Any


class BeatTheStreakPredictor:
    """Custom prediction handler for Vertex AI"""

    def __init__(self, model_dir: str):
        """
        Load models and feature names from model directory

        Args:
            model_dir: Path to directory containing model artifacts
        """
        self.model_dir = model_dir

        # Load models
        with open(os.path.join(model_dir, 'xgboost.pkl'), 'rb') as f:
            self.xgb_model = pickle.load(f)

        with open(os.path.join(model_dir, 'logistic.pkl'), 'rb') as f:
            self.lr_model = pickle.load(f)

        # Load feature names
        with open(os.path.join(model_dir, 'feature_names.pkl'), 'rb') as f:
            self.feature_names = pickle.load(f)

        # BigQuery client for feature fetching
        self.bq_client = bigquery.Client()

    def predict(self, instances: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate predictions for input instances

        Args:
            instances: List of input dictionaries with keys:
                - player_id: str
                - game_date: str (YYYY-MM-DD)
                - opponent_pitcher_id: str
                - current_streak: int (optional)

        Returns:
            List of prediction dictionaries
        """
        predictions = []

        for instance in instances:
            # Extract input
            player_id = instance['player_id']
            game_date = instance['game_date']
            pitcher_id = instance.get('opponent_pitcher_id')
            current_streak = instance.get('current_streak', 0)

            # Fetch features from BigQuery
            features_df = self._fetch_features(player_id, game_date, pitcher_id)

            if features_df is None or len(features_df) == 0:
                # No features available, return default
                predictions.append({
                    'player_id': player_id,
                    'hit_probability': None,
                    'confidence_score': None,
                    'error': 'Insufficient data'
                })
                continue

            # Ensure feature order matches training
            X = features_df[self.feature_names]

            # Generate predictions
            xgb_prob = self.xgb_model.predict_proba(X)[0, 1]
            lr_prob = self.lr_model.predict_proba(X)[0, 1]

            # Ensemble (weighted average)
            ensemble_prob = 0.6 * xgb_prob + 0.4 * lr_prob

            # Risk adjustment based on streak
            adjusted_prob = self._risk_adjust(ensemble_prob, current_streak)

            # Calculate confidence score
            model_agreement = 1 - abs(xgb_prob - lr_prob)
            confidence_score = ensemble_prob * 0.7 + model_agreement * 0.3

            predictions.append({
                'player_id': player_id,
                'hit_probability': float(ensemble_prob),
                'adjusted_probability': float(adjusted_prob),
                'confidence_score': float(confidence_score),
                'xgb_probability': float(xgb_prob),
                'lr_probability': float(lr_prob),
                'model_agreement': float(model_agreement)
            })

        return predictions

    def _fetch_features(self, player_id: str, game_date: str, pitcher_id: str) -> pd.DataFrame:
        """Fetch features from BigQuery for given player/game/pitcher"""
        query = f"""
        SELECT *
        FROM `{os.environ['GCP_PROJECT_ID']}.mlb.fct_mlb__beat_the_streak_features`
        WHERE player_id = @player_id
          AND game_date = @game_date
          AND pitcher_id = @pitcher_id
        LIMIT 1
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("player_id", "STRING", player_id),
                bigquery.ScalarQueryParameter("game_date", "DATE", game_date),
                bigquery.ScalarQueryParameter("pitcher_id", "STRING", pitcher_id),
            ]
        )

        try:
            df = self.bq_client.query(query, job_config=job_config).to_dataframe()
            return df
        except Exception as e:
            print(f"Error fetching features: {e}")
            return None

    def _risk_adjust(self, probability: float, streak: int) -> float:
        """Apply risk adjustment based on current streak"""
        if streak >= 30:
            return probability * 0.95  # Very conservative
        elif streak >= 20:
            return probability * 0.97
        elif streak >= 10:
            return probability * 0.99
        else:
            return probability  # No adjustment
```

**1.2 Create Dockerfile for Vertex AI**

Create `vertex_ai/Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy predictor code
COPY predictor.py .

# Copy model artifacts (will be mounted at runtime)
# Models are stored in /model directory in Vertex AI
ENV MODEL_DIR=/model

# Expose port for predictions
EXPOSE 8080

# Run predictor service
CMD ["python", "-m", "google.cloud.aiplatform.prediction.serving"]
```

Create `vertex_ai/requirements.txt`:
```
google-cloud-aiplatform==1.42.1
google-cloud-bigquery==3.14.1
pandas==2.1.4
numpy==1.26.3
xgboost==2.0.3
scikit-learn==1.4.0
```

---

### Step 2: Upload Model to Google Cloud Storage

**2.1 Package Model Artifacts**

Create `scripts/package_for_vertex_ai.py`:
```python
import os
import pickle
import shutil
from datetime import datetime


def package_model(model_version='1.0.0', output_dir='vertex_ai_package'):
    """
    Package trained models for Vertex AI deployment
    """
    print(f"Packaging model version {model_version} for Vertex AI...")

    # Create package directory
    os.makedirs(output_dir, exist_ok=True)

    # Copy model files
    shutil.copy(f'models/xgboost_v{model_version}.pkl', f'{output_dir}/xgboost.pkl')
    shutil.copy(f'models/logistic_v{model_version}.pkl', f'{output_dir}/logistic.pkl')
    shutil.copy(f'models/feature_names_v{model_version}.pkl', f'{output_dir}/feature_names.pkl')

    # Create metadata file
    metadata = {
        'version': model_version,
        'created_at': datetime.now().isoformat(),
        'framework': 'xgboost + scikit-learn',
        'description': 'Beat the Streak ensemble model'
    }

    with open(f'{output_dir}/metadata.json', 'w') as f:
        import json
        json.dump(metadata, f, indent=2)

    print(f"Model packaged in {output_dir}/")
    return output_dir


if __name__ == '__main__':
    package_model()
```

Run:
```bash
python scripts/package_for_vertex_ai.py
```

**2.2 Upload to GCS**

```bash
# Set variables
PROJECT_ID=your-project-id
BUCKET_NAME=beat-the-streak-models
MODEL_VERSION=1.0.0

# Create GCS bucket (if not exists)
gsutil mb -p $PROJECT_ID gs://$BUCKET_NAME

# Upload model artifacts
gsutil -m cp -r vertex_ai_package/* gs://$BUCKET_NAME/models/v${MODEL_VERSION}/

# Verify upload
gsutil ls gs://$BUCKET_NAME/models/v${MODEL_VERSION}/
```

---

### Step 3: Deploy Model to Vertex AI

**3.1 Upload Model to Vertex AI Model Registry**

Create `scripts/deploy_to_vertex_ai.py`:
```python
import os
from google.cloud import aiplatform


def deploy_model_to_vertex_ai(
    project_id: str,
    region: str,
    model_display_name: str,
    model_version: str,
    gcs_model_uri: str,
    serving_container_image_uri: str = None
):
    """
    Deploy model to Vertex AI

    Args:
        project_id: GCP project ID
        region: GCP region (e.g., 'us-central1')
        model_display_name: Display name for model
        model_version: Model version string
        gcs_model_uri: GCS path to model artifacts (gs://bucket/path/)
        serving_container_image_uri: Custom container image (optional)
    """

    # Initialize Vertex AI
    aiplatform.init(project=project_id, location=region)

    print(f"Uploading model {model_display_name} v{model_version} to Vertex AI...")

    # Use pre-built XGBoost container if no custom container specified
    if serving_container_image_uri is None:
        # Use pre-built scikit-learn container (works with XGBoost too)
        serving_container_image_uri = (
            f"{region}-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-0:latest"
        )

    # Upload model to Model Registry
    model = aiplatform.Model.upload(
        display_name=model_display_name,
        artifact_uri=gcs_model_uri,
        serving_container_image_uri=serving_container_image_uri,
        serving_container_predict_route="/predict",
        serving_container_health_route="/health",
        description=f"Beat the Streak model v{model_version}",
        labels={
            'version': model_version.replace('.', '_'),
            'type': 'ensemble',
            'framework': 'xgboost-sklearn'
        }
    )

    print(f"Model uploaded successfully!")
    print(f"  Model resource name: {model.resource_name}")
    print(f"  Model ID: {model.name}")

    return model


def create_endpoint(
    project_id: str,
    region: str,
    endpoint_display_name: str
):
    """Create Vertex AI endpoint for serving predictions"""

    aiplatform.init(project=project_id, location=region)

    print(f"Creating endpoint {endpoint_display_name}...")

    endpoint = aiplatform.Endpoint.create(
        display_name=endpoint_display_name,
        description="Beat the Streak prediction endpoint",
        labels={'purpose': 'beat-the-streak'}
    )

    print(f"Endpoint created successfully!")
    print(f"  Endpoint resource name: {endpoint.resource_name}")

    return endpoint


def deploy_model_to_endpoint(
    model: aiplatform.Model,
    endpoint: aiplatform.Endpoint,
    machine_type: str = "n1-standard-4",
    min_replica_count: int = 1,
    max_replica_count: int = 3
):
    """Deploy model to endpoint with auto-scaling"""

    print(f"Deploying model to endpoint...")

    model.deploy(
        endpoint=endpoint,
        deployed_model_display_name="beat-the-streak-v1",
        machine_type=machine_type,
        min_replica_count=min_replica_count,
        max_replica_count=max_replica_count,
        accelerator_type=None,  # No GPU needed
        traffic_percentage=100,  # Route 100% traffic to this version
        sync=True  # Wait for deployment to complete
    )

    print(f"Model deployed successfully!")
    print(f"  Endpoint ID: {endpoint.name}")
    print(f"  Endpoint URI: https://{endpoint.name}")

    return endpoint


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--project-id', required=True)
    parser.add_argument('--region', default='us-central1')
    parser.add_argument('--model-version', default='1.0.0')
    parser.add_argument('--gcs-uri', required=True, help='gs://bucket/models/v1.0.0/')
    parser.add_argument('--endpoint-name', default='beat-the-streak-endpoint')

    args = parser.parse_args()

    # Step 1: Upload model
    model = deploy_model_to_vertex_ai(
        project_id=args.project_id,
        region=args.region,
        model_display_name='beat-the-streak-model',
        model_version=args.model_version,
        gcs_model_uri=args.gcs_uri
    )

    # Step 2: Create or get endpoint
    try:
        endpoints = aiplatform.Endpoint.list(
            filter=f'display_name="{args.endpoint_name}"'
        )
        if endpoints:
            endpoint = endpoints[0]
            print(f"Using existing endpoint: {endpoint.resource_name}")
        else:
            endpoint = create_endpoint(
                project_id=args.project_id,
                region=args.region,
                endpoint_display_name=args.endpoint_name
            )
    except Exception as e:
        print(f"Creating new endpoint due to: {e}")
        endpoint = create_endpoint(
            project_id=args.project_id,
            region=args.region,
            endpoint_display_name=args.endpoint_name
        )

    # Step 3: Deploy model to endpoint
    deploy_model_to_endpoint(
        model=model,
        endpoint=endpoint,
        min_replica_count=1,
        max_replica_count=3
    )

    print("\n" + "="*60)
    print("DEPLOYMENT COMPLETE!")
    print("="*60)
    print(f"Endpoint ID: {endpoint.name}")
    print(f"Use this endpoint ID in your StatshQ API to make predictions")
```

**3.2 Run Deployment**

```bash
# Set environment variables
export PROJECT_ID=your-project-id
export REGION=us-central1
export MODEL_VERSION=1.0.0
export GCS_URI=gs://beat-the-streak-models/models/v${MODEL_VERSION}/

# Deploy to Vertex AI
python scripts/deploy_to_vertex_ai.py \
  --project-id $PROJECT_ID \
  --region $REGION \
  --model-version $MODEL_VERSION \
  --gcs-uri $GCS_URI \
  --endpoint-name beat-the-streak-endpoint
```

**Expected output**:
```
Uploading model beat-the-streak-model v1.0.0 to Vertex AI...
Model uploaded successfully!
  Model resource name: projects/123456/locations/us-central1/models/7890
  Model ID: 7890

Creating endpoint beat-the-streak-endpoint...
Endpoint created successfully!
  Endpoint resource name: projects/123456/locations/us-central1/endpoints/4567

Deploying model to endpoint...
Model deployed successfully!
  Endpoint ID: 4567
  Endpoint URI: https://4567-prediction-dot-us-central1.aiplatform.googleapis.com

============================================================
DEPLOYMENT COMPLETE!
============================================================
Endpoint ID: 4567
Use this endpoint ID in your StatshQ API to make predictions
```

---

### Step 4: Test Vertex AI Endpoint

**4.1 Test with Python**

Create `scripts/test_vertex_ai_endpoint.py`:
```python
from google.cloud import aiplatform


def test_prediction(endpoint_id: str, project_id: str, region: str):
    """Test Vertex AI endpoint with sample data"""

    aiplatform.init(project=project_id, location=region)

    # Get endpoint
    endpoint = aiplatform.Endpoint(endpoint_id)

    # Sample prediction request
    instances = [
        {
            'player_id': '660271',  # Juan Soto
            'game_date': '2025-04-15',
            'opponent_pitcher_id': '665871',  # Kyle Muller
            'current_streak': 5
        }
    ]

    print("Sending prediction request...")
    predictions = endpoint.predict(instances=instances)

    print("\nPrediction results:")
    for pred in predictions.predictions:
        print(f"  Hit Probability: {pred['hit_probability']:.3f}")
        print(f"  Confidence Score: {pred['confidence_score']:.3f}")
        print(f"  XGBoost Prob: {pred['xgb_probability']:.3f}")
        print(f"  Logistic Prob: {pred['lr_probability']:.3f}")

    return predictions


if __name__ == '__main__':
    test_prediction(
        endpoint_id='4567',  # From deployment output
        project_id='your-project-id',
        region='us-central1'
    )
```

Run:
```bash
python scripts/test_vertex_ai_endpoint.py
```

**4.2 Test with REST API**

```bash
# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Make prediction request
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/endpoints/${ENDPOINT_ID}:predict \
  -d '{
    "instances": [
      {
        "player_id": "660271",
        "game_date": "2025-04-15",
        "opponent_pitcher_id": "665871",
        "current_streak": 5
      }
    ]
  }'
```

---

### Step 5: Model Versioning & Rollback

**5.1 Deploy New Model Version**

When retraining, deploy as new version:
```bash
# Train new model
python src/training/train.py

# Package v1.1.0
python scripts/package_for_vertex_ai.py --version 1.1.0

# Upload to GCS
gsutil -m cp -r vertex_ai_package/* gs://$BUCKET_NAME/models/v1.1.0/

# Deploy to Vertex AI (will create new model version)
python scripts/deploy_to_vertex_ai.py \
  --model-version 1.1.0 \
  --gcs-uri gs://$BUCKET_NAME/models/v1.1.0/
```

**5.2 Traffic Splitting (Canary Deployment)**

Test new version with 10% traffic:
```python
from google.cloud import aiplatform

# Split traffic: 90% v1.0.0, 10% v1.1.0
endpoint.update(
    traffic_split={
        'beat-the-streak-v1.0.0': 90,
        'beat-the-streak-v1.1.0': 10
    }
)
```

**5.3 Rollback to Previous Version**

```python
# Route 100% traffic back to v1.0.0
endpoint.update(
    traffic_split={
        'beat-the-streak-v1.0.0': 100,
        'beat-the-streak-v1.1.0': 0
    }
)
```

---

## 11.8. Integration with StatshQ Dashboard

### Option 1: Direct Vertex AI Integration (Recommended)

**Add endpoint to StatshQ backend** (`server/index.js`):

```javascript
const { PredictionServiceClient } = require('@google-cloud/aiplatform');

// Initialize Vertex AI client
const predictionClient = new PredictionServiceClient({
  apiEndpoint: 'us-central1-aiplatform.googleapis.com'
});

const ENDPOINT_PATH = predictionClient.endpointPath(
  process.env.GCP_PROJECT_ID,
  'us-central1',
  process.env.VERTEX_AI_ENDPOINT_ID
);

// New endpoint: Get daily Beat the Streak pick
app.get('/api/mlb/beat-the-streak/daily-pick', async (req, res) => {
  try {
    const { currentStreak = 0 } = req.query;

    // Step 1: Get today's games from BigQuery
    const gamesQuery = `
      SELECT
        g.game_id,
        g.game_date,
        g.home_team_id,
        g.away_team_id,
        g.home_probable_pitcher_id,
        g.away_probable_pitcher_id,
        b.player_id,
        b.full_name as player_name,
        b.batting_order
      FROM \`${process.env.GCP_PROJECT_ID}.mlb.fct_mlb__todays_games\` g
      JOIN \`${process.env.GCP_PROJECT_ID}.mlb.fct_mlb__starting_lineups\` b
        ON g.game_id = b.game_id
      WHERE g.game_date = CURRENT_DATE()
        AND b.batting_order <= 6  -- Top 6 in lineup
      ORDER BY b.batting_order`;

    const [candidates] = await bigquery.query(gamesQuery);

    if (candidates.length === 0) {
      return res.json({
        error: 'No games today',
        pick: null
      });
    }

    // Step 2: Get predictions from Vertex AI for all candidates
    const instances = candidates.map(c => ({
      player_id: c.player_id,
      game_date: c.game_date,
      opponent_pitcher_id: c.home_probable_pitcher_id || c.away_probable_pitcher_id,
      current_streak: parseInt(currentStreak)
    }));

    const [response] = await predictionClient.predict({
      endpoint: ENDPOINT_PATH,
      instances: instances
    });

    const predictions = response.predictions;

    // Step 3: Select best pick (highest confidence score)
    let bestPick = null;
    let maxConfidence = 0;

    predictions.forEach((pred, idx) => {
      if (pred.confidence_score > maxConfidence) {
        maxConfidence = pred.confidence_score;
        bestPick = {
          ...candidates[idx],
          ...pred
        };
      }
    });

    // Step 4: Return recommendation
    res.json({
      date: new Date().toISOString().split('T')[0],
      current_streak: currentStreak,
      recommended_pick: {
        player_id: bestPick.player_id,
        player_name: bestPick.player_name,
        opponent: bestPick.opponent_team_name,
        pitcher_name: bestPick.pitcher_name,
        hit_probability: bestPick.hit_probability,
        confidence_score: bestPick.confidence_score,
        game_time: bestPick.game_time,
        reasoning: `${bestPick.player_name} has ${(bestPick.hit_probability * 100).toFixed(1)}% probability of getting a hit. Confidence: ${(bestPick.confidence_score * 100).toFixed(1)}%`
      },
      top_5_alternatives: predictions
        .map((p, i) => ({ ...candidates[i], ...p }))
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(1, 6)
    });

  } catch (err) {
    console.error('Beat the Streak prediction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get prediction for specific player
app.get('/api/mlb/beat-the-streak/predict/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { gameDate, pitcherId, currentStreak = 0 } = req.query;

    const instances = [{
      player_id: playerId,
      game_date: gameDate || new Date().toISOString().split('T')[0],
      opponent_pitcher_id: pitcherId,
      current_streak: parseInt(currentStreak)
    }];

    const [response] = await predictionClient.predict({
      endpoint: ENDPOINT_PATH,
      instances: instances
    });

    res.json(response.predictions[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Update `.env`**:
```bash
VERTEX_AI_ENDPOINT_ID=4567
```

---

### Option 2: Scheduled Daily Predictions (Cloud Scheduler + Cloud Functions)

For automated daily picks, use Cloud Functions:

**Create `cloud-function/main.py`**:
```python
from google.cloud import aiplatform, bigquery
import functions_framework


@functions_framework.http
def generate_daily_pick(request):
    """
    Cloud Function triggered daily by Cloud Scheduler
    Generates Beat the Streak pick and stores in BigQuery
    """
    project_id = os.environ['GCP_PROJECT_ID']
    endpoint_id = os.environ['VERTEX_AI_ENDPOINT_ID']

    # Get today's eligible batters
    bq_client = bigquery.Client()
    candidates_query = """
        SELECT player_id, game_date, opponent_pitcher_id
        FROM `project.mlb.todays_candidates`
        WHERE game_date = CURRENT_DATE()
    """
    candidates = list(bq_client.query(candidates_query))

    # Get predictions
    aiplatform.init(project=project_id, location='us-central1')
    endpoint = aiplatform.Endpoint(endpoint_id)

    instances = [dict(row) for row in candidates]
    predictions = endpoint.predict(instances=instances).predictions

    # Select best pick
    best_pick = max(predictions, key=lambda x: x['confidence_score'])

    # Store in BigQuery
    table_id = f'{project_id}.mlb.beat_the_streak_daily_picks'
    rows_to_insert = [{
        'prediction_date': datetime.now().date(),
        'player_id': best_pick['player_id'],
        'hit_probability': best_pick['hit_probability'],
        'confidence_score': best_pick['confidence_score']
    }]

    bq_client.insert_rows_json(table_id, rows_to_insert)

    return {'status': 'success', 'pick': best_pick}
```

**Deploy**:
```bash
gcloud functions deploy generate-daily-pick \
  --runtime python310 \
  --trigger-http \
  --entry-point generate_daily_pick \
  --region us-central1
```

**Schedule with Cloud Scheduler**:
```bash
gcloud scheduler jobs create http beat-the-streak-daily \
  --schedule="0 10 * * *" \
  --uri="https://us-central1-PROJECT_ID.cloudfunctions.net/generate-daily-pick" \
  --time-zone="America/New_York"
```

---

### Frontend Integration

**Add Beat the Streak dashboard page** (`src/features/mlb/BeatTheStreak.jsx`):

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function BeatTheStreak() {
  const [dailyPick, setDailyPick] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailyPick();
  }, [currentStreak]);

  const fetchDailyPick = async () => {
    try {
      const response = await axios.get(
        `http://localhost:8080/api/mlb/beat-the-streak/daily-pick?currentStreak=${currentStreak}`
      );
      setDailyPick(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching daily pick:', error);
      setLoading(false);
    }
  };

  if (loading) return <div>Loading today's pick...</div>;
  if (!dailyPick?.recommended_pick) return <div>No games today</div>;

  const pick = dailyPick.recommended_pick;

  return (
    <div className="beat-the-streak-dashboard">
      <h1>Beat the Streak - Daily Pick</h1>

      <div className="streak-tracker">
        <label>Current Streak:</label>
        <input
          type="number"
          value={currentStreak}
          onChange={(e) => setCurrentStreak(parseInt(e.target.value))}
        />
      </div>

      <div className="daily-pick-card">
        <h2>🎯 Today's Recommended Pick</h2>
        <div className="player-info">
          <h3>{pick.player_name}</h3>
          <p>vs {pick.opponent} - {pick.pitcher_name}</p>
          <p>Game Time: {pick.game_time}</p>
        </div>

        <div className="prediction-stats">
          <div className="stat">
            <label>Hit Probability</label>
            <div className="value">{(pick.hit_probability * 100).toFixed(1)}%</div>
          </div>
          <div className="stat">
            <label>Confidence Score</label>
            <div className="value">{(pick.confidence_score * 100).toFixed(1)}%</div>
          </div>
        </div>

        <div className="reasoning">
          <p>{pick.reasoning}</p>
        </div>
      </div>

      <div className="alternatives">
        <h3>Alternative Picks</h3>
        <ul>
          {dailyPick.top_5_alternatives?.map(alt => (
            <li key={alt.player_id}>
              {alt.player_name} - {(alt.hit_probability * 100).toFixed(1)}%
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## 12. Risk Mitigation Strategies

### Data Quality Risks
- **Missing game data**: Have fallback to season averages
- **Late scratches**: Monitor lineup changes, have backup picks
- **Probable pitcher TBD**: Default to team's average pitcher stats

### Model Risks
- **Overfitting**: Use cross-validation, regularization
- **Concept drift**: Monthly retraining, performance monitoring
- **Sample size**: Require minimum PAs for predictions

### Operational Risks
- **API downtime**: Cache yesterday's data as fallback
- **Model bugs**: Manual review of top pick each day
- **Streak pressure**: Stick to model, avoid emotional overrides

---

## 13. Success Validation Checklist

Before deploying to live competition:

- [ ] Backtesting achieves 70%+ accuracy over full 2024 season
- [ ] At least one 15+ game streak in backtest
- [ ] Model calibrated (predicted probs match actual hit rates)
- [ ] Daily pipeline runs successfully for 14 consecutive days
- [ ] Error analysis shows no systematic blind spots
- [ ] Ensemble outperforms individual models by 3%+
- [ ] All data quality checks pass
- [ ] Manual review of 20 picks shows reasonable selections

---

## 14. Conclusion & Expected Outcomes

### Expected Performance (Conservative Estimates)

**Base Model (Logistic Regression)**
- Accuracy: 67-69%
- Max streak in 162 games: 12-15
- Competitive but not elite

**Ensemble Model with Risk Management**
- Accuracy: 71-74%
- Max streak in 162 games: 18-22
- Top 5-10% of all participants

**Optimized Model with Advanced Features (Phase 2)**
- Accuracy: 75-77%
- Max streak in 162 games: 24-28
- Top 1-2% of all participants

### Key Success Factors

1. **Data Quality**: Rolling stats and matchup data are critical
2. **Risk Management**: Streak-based conservatism prevents costly errors
3. **Consistency**: Avoiding long droughts matters more than rare 30+ streaks
4. **Iteration**: Continuous improvement based on real results

### Final Recommendation

Start with Phase 1-2 (XGBoost + Logistic Regression ensemble) to achieve 70-74% accuracy. This is competitive and achievable within 6 weeks. Advanced features (weather, umpires, fatigue) provide incremental gains but require more engineering effort - add these in Phase 2 once base model is validated.

The model should be viewed as a **decision support tool**, not a guarantee. Even at 75% accuracy, you'll face hitless picks - the key is maximizing streak length over a full season, not perfection on any single day.

---

## Appendix A: Sample Prediction Output

```json
{
  "prediction_date": "2025-04-15",
  "current_streak": 12,
  "risk_profile": "Conservative",

  "recommended_pick": {
    "player_id": "660271",
    "player_name": "Juan Soto",
    "team": "NYY",
    "opponent": "OAK",
    "pitcher_name": "Kyle Muller",
    "game_time": "19:05 ET",

    "prediction": {
      "hit_probability": 0.742,
      "confidence_score": 0.851,
      "model_agreement": 0.92,
      "xgb_prob": 0.755,
      "lr_prob": 0.738,
      "nn_prob": 0.733
    },

    "key_factors": {
      "rolling_avg_L7": 0.389,
      "games_with_hit_L5": 5,
      "platoon_advantage": true,
      "career_vs_pitcher": "2-for-5, 1 HR",
      "pitcher_era_L5": 5.23,
      "park_factor": 1.08,
      "batting_order": 3,
      "exit_velo_L15": 93.2
    },

    "reasoning": "Juan Soto is on a 5-game hitting streak with a .389 average over last 7 days. Faces LHP Kyle Muller (5.23 ERA last 5 starts) with strong platoon advantage (.298 career vs LHP). Batting 3rd in hitter-friendly Yankee Stadium. 74.2% hit probability with high model agreement."
  },

  "alternate_picks": [
    {
      "player_name": "Mookie Betts",
      "hit_probability": 0.728,
      "key_factor": "Elite exit velo (95.1 mph) L15"
    },
    {
      "player_name": "Freddie Freeman",
      "hit_probability": 0.719,
      "key_factor": "Career .395 vs RHP at home"
    }
  ]
}
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-13
**Author**: Claude (Beat the Streak Model Design)
