# Stats HQ

A React-based sports data visualization platform that connects to BigQuery to display statistics from NHL, MLB, NFL, and NBA.

## Features

- 🏒 NHL Statistics
- ⚾ MLB Statistics  
- 🏈 NFL Statistics
- 🏀 NBA Statistics
- 📊 Interactive data visualizations using Recharts
- 🔌 BigQuery integration for real-time data
- 🐳 Docker support for easy deployment

## Prerequisites

- Node.js 20 or higher
- Docker (for containerized deployment)
- Google Cloud BigQuery account and credentials
- npm or yarn

## Getting Started

### Quick Start

**👉 For detailed BigQuery setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**

The application consists of two parts:
1. **Frontend** (React + Vite) - The dashboard interface
2. **Backend API** (Node.js + Express) - Connects to BigQuery

### Local Development

#### 1. Set up environment variables:
```bash
cp env.example .env
```

Edit `.env` with your Google Cloud Project ID and credentials path.

#### 2. Install dependencies:

**Backend:**
```bash
cd server
npm install
cd ..
```

**Frontend:**
```bash
npm install
```

#### 3. Start both services:

**Terminal 1 - Backend API:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The frontend will be at `http://localhost:5173` and backend at `http://localhost:8080`

### Docker Deployment

Run both frontend and backend with Docker Compose:

```bash
# Make sure your .env file is configured and gcp-key.json is in the server/ directory
docker-compose up -d
```

The app will be available at `http://localhost`

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## Project Structure

```
statshq/
├── src/                 # Frontend React application
│   ├── components/      # React components
│   │   ├── Dashboard.jsx
│   │   ├── NHLStats.jsx
│   │   ├── MLBStats.jsx
│   │   ├── NFLStats.jsx
│   │   └── NBAStats.jsx
│   ├── services/        # API client services
│   │   └── bigqueryService.js
│   ├── App.jsx          # Main app component
│   ├── App.css          # App styles
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── server/              # Backend API server
│   ├── index.js         # Express server with BigQuery integration
│   ├── package.json     # Backend dependencies
│   ├── Dockerfile       # Backend Docker configuration
│   └── README.md        # Backend documentation
├── Dockerfile           # Frontend Docker configuration
├── docker-compose.yml   # Multi-container orchestration
├── nginx.conf           # Nginx configuration for production
├── vite.config.js       # Vite configuration
├── SETUP_GUIDE.md       # Detailed setup instructions
└── package.json         # Frontend dependencies and scripts
```

## BigQuery Integration

The backend API server (`server/index.js`) connects to Google BigQuery and exposes REST endpoints for your sports data.

**Architecture:**
```
React Frontend → Express API Server → Google BigQuery
```

**See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete BigQuery setup instructions.**

### API Endpoints

The backend exposes the following endpoints:

- `GET /api/nhl` - NHL team statistics
- `GET /api/mlb` - MLB team statistics
- `GET /api/nfl` - NFL team statistics
- `GET /api/nba` - NBA team statistics
- `GET /health` - Health check

### Customize Your Queries

Edit the SQL queries in `server/index.js` to match your BigQuery dataset structure:

```javascript
// Example endpoint: GET /api/nhl
SELECT 
  team_name as name,
  wins as value
FROM `your-project.sports_data.nhl_teams`
ORDER BY wins DESC
LIMIT 10
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Recharts** - Data visualization
- **Axios** - HTTP client
- **BigQuery** - Data warehouse
- **Docker** - Containerization
- **Nginx** - Production web server

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
