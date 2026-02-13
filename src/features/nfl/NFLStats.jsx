import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchNFLData } from '../../services/bigqueryService'

function NFLStats() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const result = await fetchNFLData()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading NFL stats...</div>
  if (error) return <div className="error">Error loading data: {error}</div>

  return (
    <div className="page-container">
      <h1 className="page-title">NFL Statistics</h1>
      
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)' }} axisLine={{ stroke: '#333' }} tickLine={{ stroke: '#333' }} />
            <YAxis tick={{ fill: 'var(--muted)' }} axisLine={{ stroke: '#333' }} tickLine={{ stroke: '#333' }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(0, 0, 0, 0.95)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '10px',
                color: 'var(--text)'
              }}
              labelStyle={{ color: 'var(--muted)' }}
              itemStyle={{ color: 'var(--text)' }}
            />
            <Legend wrapperStyle={{ color: 'var(--muted)' }} />
            <Bar dataKey="value" fill="var(--accent-cyan)" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p>No data available. Please configure your BigQuery connection.</p>
      )}
    </div>
  )
}

export default NFLStats
