#!/usr/bin/env node
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Load environment variables
if (!process.env.CODESPACES) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const bigqueryConfig = {
  projectId: process.env.GCP_PROJECT_ID,
};

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  bigqueryConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const bigquery = new BigQuery(bigqueryConfig);
const DATASET = 'mlb';

const tables = [
  'dim_mlb__teams',
  'dim_mlb__players',
  'dim_mlb__divisions',
  'dim_mlb__leagues',
  'fct_mlb__games',
  'fct_mlb__player_batting_stats',
  'fct_mlb__player_pitching_stats',
  'fct_mlb__statcast_batted_balls'
];

async function getSchema(tableName) {
  try {
    const [metadata] = await bigquery
      .dataset(DATASET)
      .table(tableName)
      .getMetadata();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Table: ${tableName}`);
    console.log(`${'='.repeat(60)}`);
    console.log(JSON.stringify(metadata.schema.fields, null, 2));
  } catch (error) {
    console.error(`Error fetching schema for ${tableName}:`, error.message);
  }
}

async function main() {
  console.log(`Project: ${process.env.GCP_PROJECT_ID}`);
  console.log(`Dataset: ${DATASET}\n`);
  
  for (const table of tables) {
    await getSchema(table);
  }
}

main().catch(console.error);
