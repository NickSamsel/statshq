# Beat the Streak — Webapp Repo Plan (this repo)

> Put this file at the root of your **React webapp repo** (Stats HQ).

## Goal
Add a new MLB sub-page/tab: **Beat the Streak Analysis**.

Users should be able to:
- See **daily updated recommended picks** (ranked list)
- See **model performance** (accuracy trend, top-N hit rate)
- Track **progress to 57** with a progress bar
- (Optionally) record their daily pick and see their current streak

## Current State
- The MLB navigation already includes a tab `beat-the-streak` in `MLBStats.jsx`, but no content is rendered for it.
- Data access is centralized in `src/services/bigqueryService.js`.

## UX / Components
### Page layout (single page inside MLB tab)
1) **Header cards**
- Today’s date + model version
- Top pick probability (or top-N summary)
- Model accuracy (last 30 days)
- Streak progress (0–57) with progress bar

2) **Today’s recommendations table**
Columns (minimum):
- Rank
- Player (name, team)
- Opponent / game time
- Prob(1+ hit)
- “Why” / key factors (can be a compact list pulled from `features_json`)

3) **Performance section**
- Line chart: rolling top1 accuracy (or daily top1)
- Optional second line: top3-any-hit
- Small table: last 7 days summary

4) **Pick tracking (optional MVP+)**
- If no auth: allow “Select today’s pick” saved to `localStorage`.
- Display current streak and history list.

## Data Requirements (queries)
Add these functions to `src/services/bigqueryService.js` (names are suggestions):
- `fetchBTSRecommendations({ date, modelVersion })`
- `fetchBTSModelMetrics({ startDate, endDate, modelVersion })`
- `fetchBTSRecommendationHistory({ startDate, endDate, modelVersion })` (optional)

The UI should not need to join tables; prefer BigQuery views.

## Implementation Steps
1. Create component `src/features/mlb/beatTheStreak/BeatTheStreak.jsx`.
2. Wire it into `src/features/mlb/MLBStats.jsx` so it renders when `activeTab === 'beat-the-streak'`.
3. Add BigQuery service functions + loading/error handling consistent with `TeamExplorer`.
4. Add progress bar component (simple div-based, no new design system dependencies).
5. Add charts via existing `recharts` dependency (already used in `TeamExplorer`).
6. Add empty states (no recommendations, no metrics yet).

## State & Caching
- Cache selected `modelVersion` and last selected view in `localStorage`.
- Recommendations should default to `today` in user timezone (or use server date to avoid mismatch).

## Non-goals (for v1)
- Authentication
- Multi-user leaderboard
- Complex lineup lock UX

## Definition of Done
- Tab renders without errors and shows:
  - today recommendations
  - accuracy chart
  - 57-goal progress bar
- Works with empty data (shows friendly empty state).
