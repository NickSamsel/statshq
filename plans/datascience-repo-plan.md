# Beat the Streak — Data Science / Model Repo Plan

> Put this file at the root of your **model / data science repo**.

## Goal
Train, evaluate, and run daily inference for a Beat the Streak model that estimates $P(\text{1+ hit})$ for hitters on a given day, and publishes:
- Ranked daily recommendations
- Daily/rolling evaluation metrics
- Model version + metadata for reproducibility

## Outputs (must match DB contract)
- Daily reco rows: `bts_recommendations_daily`
- Scoring inputs or joins: `bts_player_game_outcomes` or compatible sources
- Aggregated metrics: `bts_model_metrics_daily`

## Modeling Scope
### Prediction target
- Binary: hitter gets at least one hit in the game.

### Candidate features (examples)
- Batter skill: rolling BA/xBA, K%, BB%, hard-hit%, contact%, platoon splits
- Pitcher: K%, BB%, xwOBA allowed, handedness, pitch mix (optional)
- Context: park factors, weather (optional), home/away, projected lineup slot
- Recent form: last 7/14/30 games (careful about leakage)

### Model types
Start simple and robust:
- Gradient boosted trees (LightGBM/XGBoost) or logistic regression baseline
- Calibrate probabilities (isotonic or Platt) if needed

## Evaluation
- Backtest by date (time-based split).
- Primary metrics for UI:
  - Top1 accuracy (did the #1 reco get a hit?)
  - Top3 any-hit (did any of top 3 get a hit?)
  - Brier score (calibration)

## Daily Inference Pipeline
1. Build today’s candidate hitter slate (expected starters).
2. Generate features using only information available before first pitch.
3. Score candidates -> probabilities.
4. Produce ranked recommendations (top N).
5. Write results to BigQuery via the DB repo pipeline (or direct write, but keep schema stable).

## Versioning
- `model_version` string included in every output row.
- Store training config + feature set hash + training date in an artifact registry (could be a table or a JSON artifact in GCS).

## Reliability
- Idempotent writes for a given `recommendation_date` + `model_version`.
- Smoke checks:
  - number of recommendations >= N
  - probabilities in [0,1]
  - no missing player identifiers

## Milestones
1. Define baseline model + backtest notebook/script.
2. Define feature pipeline and ensure no leakage.
3. Implement daily inference script with CLI args:
   - `--date`, `--model-version`, `--top-n`
4. Add evaluation job that updates metrics after games complete.
5. Add monitoring + runbook.

## Definition of Done
- Daily job outputs stable reco table rows.
- Metrics computed daily and match the webapp charts.
- Model versioning makes prior days reproducible.
