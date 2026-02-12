import { useState, useEffect } from 'react';
import { fetchMLBStatcastData } from '../../../services/bigqueryService';

export function usePitchData(playerId, season) {
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;

    const loadPitches = async () => {
      setLoading(true);
      try {
        // Querying your fct_mlb__statcast_pitches table
        const data = await fetchMLBStatcastData({ playerId, season });
        setPitches(data);
      } catch (err) {
        console.error("3D Data Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPitches();
  }, [playerId, season]);

  return { pitches, loading };
}