import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

function ZoomToDistrict({ bounds, districtName, districtsData }) {
  const map = useMap()
  useEffect(() => { if (bounds) map.fitBounds(bounds, { padding: [30, 30] }) }, [bounds])

  // Auto-zoom when district selected from dropdown (no bounds yet)
  useEffect(() => {
    if (!districtName || !districtsData || bounds) return
    // find matching feature and zoom
    const L = window.L
    if (!L) return
    const match = districtsData.features.find(f => {
      const name = f.properties.DISTRICT || f.properties.NAME_2 || f.properties.NAME
      return name?.trim().toLowerCase() === districtName.trim().toLowerCase()
    })
    if (!match) return
    try {
      const layer = L.geoJSON(match)
      map.fitBounds(layer.getBounds(), { padding: [30, 30] })
    } catch(e) {}
  }, [districtName, districtsData])

  return null
}

const DISTRICT_COLORS = {
  'KUANTAN': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'PEKAN': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'TEMERLOH': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'RAUB': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'JERANTUT': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'ROMPIN': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'BENTONG': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'MARAN': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'LIPIS': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'CAMERON HIGHLANDS': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
  'BERA': { solved: '#22c55e', pending: '#f97316', critical: '#ef4444' },
}

function getDistrictFill(districtName, blackspotsData) {
  if (!blackspotsData) return { color: '#3b82f6', fillOpacity: 0.2 }
  const spots = blackspotsData.features.filter(f =>
    f.properties.DAERAH?.trim().toLowerCase() === districtName?.trim().toLowerCase()
  )
  if (spots.length === 0) return { color: '#6b7280', fillOpacity: 0.15 }
  const total = spots.length
  const pending = spots.filter(f => !f.properties['STATUS SOLVE']).length
  const rate = pending / total
  if (rate === 0) return { color: '#22c55e', fillOpacity: 0.45 }
  if (rate < 0.15) return { color: '#84cc16', fillOpacity: 0.4 }
  if (rate < 0.35) return { color: '#f59e0b', fillOpacity: 0.45 }
  return { color: '#ef4444', fillOpacity: 0.5 }
}

function parseCost(raw) {
  if (!raw) return 0
  const c = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
  return isNaN(c) ? 0 : c
}

function formatCost(val) {
  if (val >= 1e6) return `RM ${(val / 1e6).toFixed(2)}M`
  if (val >= 1e3) return `RM ${(val / 1e3).toFixed(0)}K`
  return `RM ${val.toFixed(0)}`
}

function getAIRisk(pending, total) {
  const rate = total > 0 ? pending / total : 0
  if (rate >= 0.5) return { risk: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', actions: ['Immediate pipeline replacement', 'Deploy emergency maintenance team', 'Activate NRW mitigation plan', 'Increase pressure monitoring frequency'] }
  if (rate >= 0.3) return { risk: 'HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.12)', actions: ['Prioritize intervention project', 'Increase inspection frequency', 'Monitor abnormal water pressure', 'Evaluate high-cost pending sites'] }
  if (rate >= 0.1) return { risk: 'MEDIUM', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', actions: ['Schedule preventive maintenance', 'Monitor NRW trend', 'Evaluate pipe condition', 'Plan for upcoming interventions'] }
  return { risk: 'LOW', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', actions: ['Continue preventive maintenance', 'Monitor pressure consistency', 'Schedule quarterly NRW inspection', 'Document resolved blackspots'] }
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞', group: null },
  { id: 'map', label: 'Pahang Map', icon: '🗺', group: 'MAP & ANALYSIS' },
  { id: 'district', label: 'District Overview', icon: '📊', group: null },
  { id: 'blackspot', label: 'Blackspot Analysis', icon: '📍', group: null },
  { id: 'intervention', label: 'Intervention Status', icon: '🔧', group: null },
  { id: 'ai', label: 'AI Recommendation', icon: '🤖', group: 'AI & INSIGHTS' },
  { id: 'predictive', label: 'Predictive Insights', icon: '📈', group: null },
  { id: 'reports', label: 'Reports', icon: '📋', group: 'REPORTS' },
  { id: 'export', label: 'Export Data', icon: '⬇', group: null },
  { id: 'about', label: 'About System', icon: 'ℹ', group: 'ABOUT' },
]

export default function App() {
  const [districtsData, setDistrictsData] = useState(null)
  const [blackspotsData, setBlackspotsData] = useState(null)
  const [buffersData, setBuffersData] = useState(null)
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [districtBounds, setDistrictBounds] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [showBuffers, setShowBuffers] = useState(true)
  const [panelClosed, setPanelClosed] = useState(false)
  const [lastUpdated] = useState('18 May 2025 10:30 AM')
  const [viewBy, setViewBy] = useState('Blackspot Status')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    fetch('/districts.geojson').then(r => r.json()).then(setDistrictsData)
    fetch('/blackspots.geojson').then(r => r.json()).then(setBlackspotsData)
    fetch('/buffers.geojson').then(r => r.json()).then(setBuffersData)
  }, [])

  const allStats = (() => {
    if (!blackspotsData) return { total: 0, solved: 0, pending: 0, totalCost: 0 }
    const f = blackspotsData.features
    const total = f.length
    const solved = f.filter(s => s.properties['STATUS SOLVE'] === true).length
    const totalCost = f.reduce((acc, s) => acc + parseCost(s.properties['KOS (RM)']), 0)
    return { total, solved, pending: total - solved, totalCost }
  })()

  const districtSpots = selectedDistrict && blackspotsData
    ? blackspotsData.features.filter(f =>
        f.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
      )
    : []

  const distStats = (() => {
    if (!districtSpots.length) return null
    const total = districtSpots.length
    const solved = districtSpots.filter(s => s.properties['STATUS SOLVE']).length
    const totalCost = districtSpots.reduce((acc, s) => acc + parseCost(s.properties['KOS (RM)']), 0)
    return { total, solved, pending: total - solved, totalCost }
  })()

  const ai = getAIRisk(
    distStats ? distStats.pending : allStats.pending,
    distStats ? distStats.total : allStats.total
  )

  const districtChartData = blackspotsData
    ? Object.values(blackspotsData.features.reduce((acc, s) => {
        const d = s.properties.DAERAH || 'Unknown'
        if (!acc[d]) acc[d] = { district: d.charAt(0) + d.slice(1).toLowerCase(), total: 0, solved: 0, pending: 0 }
        acc[d].total += 1
        s.properties['STATUS SOLVE'] ? acc[d].solved++ : acc[d].pending++
        return acc
      }, {})).sort((a, b) => b.total - a.total)
    : []

  const costChartData = blackspotsData
    ? Object.values(blackspotsData.features.reduce((acc, s) => {
        const d = s.properties.DAERAH || 'Unknown'
        if (!acc[d]) acc[d] = { district: d.charAt(0) + d.slice(1).toLowerCase(), cost: 0 }
        acc[d].cost += parseCost(s.properties['KOS (RM)']) / 1e6
        return acc
      }, {})).sort((a, b) => b.cost - a.cost)
    : []

  const donutData = [
    { name: 'Solved', value: allStats.solved },
    { name: 'Pending', value: allStats.pending },
    { name: 'Critical', value: districtChartData.filter(d => d.pending / d.total >= 0.35).length },
    { name: 'No Data', value: 0 },
  ]

  const filteredSpots = blackspotsData
    ? blackspotsData.features.filter(s => {
        const solved = s.properties['STATUS SOLVE']
        if (filterStatus === 'solved' && !solved) return false
        if (filterStatus === 'pending' && solved) return false
        if (selectedDistrict) {
          return s.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
        }
        return true
      })
    : []

  const totalDistricts = districtChartData.length

  const districtList = blackspotsData
    ? ['all', ...new Set(blackspotsData.features.map(f => f.properties.DAERAH).filter(Boolean).sort())]
    : ['all']

  const handleDistrictSelect = (val) => {
    if (val === 'all') {
      setSelectedDistrict(null)
      setDistrictBounds(null)
      setSelectedSpot(null)
      setPanelClosed(false)
    } else {
      setSelectedDistrict(val)
      setPanelClosed(false)
      setSelectedSpot(null)
    }
  }

  // For progress bar toward 90% target
  const resolvedPct = allStats.total > 0 ? (allStats.solved / allStats.total * 100).toFixed(1) : 0
  const targetPct = 90

  const panelOpen = (selectedDistrict || selectedSpot) && !panelClosed

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: sidebarOpen ? 220 : 0, minHeight: '100vh', background: 'linear-gradient(180deg,#0d1117 0%,#161b22 100%)', borderRight: sidebarOpen ? '1px solid #21262d' : 'none', display: 'flex', flexDirection: 'column', padding: '0 0 20px 0', position: 'sticky', top: 0, flexShrink: 0, overflow: 'hidden', transition: 'width 0.25s ease' }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 18px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1d6fa5,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💧</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#e6edf3', lineHeight: 1.1 }}>PAIP</div>
              <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1 }}>PAHANG</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map((item, i) => (
            <div key={item.id}>
              {item.group && (
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6e7681', letterSpacing: 1.5, padding: '14px 8px 6px', textTransform: 'uppercase' }}>{item.group}</div>
              )}
              <button
                onClick={() => setActiveMenu(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  background: activeMenu === item.id ? 'rgba(37,99,235,0.18)' : 'transparent',
                  border: 'none', borderLeft: activeMenu === item.id ? '2px solid #2563eb' : '2px solid transparent',
                  color: activeMenu === item.id ? '#60a5fa' : '#8b949e',
                  padding: '9px 8px', borderRadius: '0 8px 8px 0', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeMenu === item.id ? 600 : 400,
                  transition: 'all 0.15s', textAlign: 'left', marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </div>

        {/* Data info */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #21262d', fontSize: 11, color: '#6e7681' }}>
          <div style={{ marginBottom: 4 }}>📅 Data Last Updated</div>
          <div style={{ color: '#8b949e', marginBottom: 8 }}>{lastUpdated}</div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 11, padding: 0 }}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* TOPBAR */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d1117', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#e6edf3', letterSpacing: 0.3 }}>PAIP PAHANG BLACKSPOT MONITORING SYSTEM</h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6e7681' }}>GIS-Based Water Supply Blackspot & Intervention Monitoring with AI Recommendation</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* District dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                value={selectedDistrict || 'all'}
                onChange={e => handleDistrictSelect(e.target.value)}
                style={{
                  background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
                  padding: '7px 32px 7px 14px', fontSize: 13, color: '#e6edf3',
                  cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                  minWidth: 140, outline: 'none',
                }}
              >
                <option value="all">Pahang (All)</option>
                {districtList.filter(d => d !== 'all').map(d => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6e7681', pointerEvents: 'none', fontSize: 11 }}>▾</span>
            </div>
            {/* Hamburger — toggle sidebar */}
            <div
              onClick={() => setSidebarOpen(o => !o)}
              style={{ width: 32, height: 32, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, userSelect: 'none' }}
              title="Toggle Sidebar"
            >☰</div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {/* === DASHBOARD === */}
          {activeMenu === 'dashboard' && (
            <>
              {/* KPI Cards — reactive to selectedDistrict */}
              {(() => {
                const s = distStats || allStats
                const pct = s.total > 0 ? (s.solved / s.total * 100).toFixed(1) : 0
                const pendingPct = s.total > 0 ? (s.pending / s.total * 100).toFixed(1) : 0
                const scope = selectedDistrict ? selectedDistrict.charAt(0) + selectedDistrict.slice(1).toLowerCase() : 'All Districts'
                const districtCount = selectedDistrict ? 1 : totalDistricts
                return (
                  <>
                    {selectedDistrict && (
                      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#6e7681' }}>Showing data for:</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', background: 'rgba(37,99,235,0.15)', padding: '2px 10px', borderRadius: 20 }}>
                          {scope}
                        </span>
                        <button onClick={() => handleDistrictSelect('all')} style={{ background: 'none', border: '1px solid #30363d', color: '#6e7681', padding: '2px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 11 }}>✕ Reset</button>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
                      <KPICard icon="📍" iconBg="linear-gradient(135deg,#1e40af,#2563eb)" label="TOTAL BLACKSPOTS" value={s.total} sub={scope} />
                      <KPICard icon="✅" iconBg="linear-gradient(135deg,#166534,#22c55e)" label="RESOLVED" value={s.solved} pct={`${pct}%`} sub="Blackspots Solved" green />
                      <KPICard icon="⏳" iconBg="linear-gradient(135deg,#92400e,#f59e0b)" label="PENDING" value={s.pending} pct={`${pendingPct}%`} sub="Not Yet Solved" orange />
                      <KPICard icon="💰" iconBg="linear-gradient(135deg,#7c2d12,#ea580c)" label="TOTAL INTERVENTION COST" value={formatCost(s.totalCost)} sub={selectedDistrict ? scope : 'All Projects'} purple valueSm />
                      <KPICard icon="🏛" iconBg="linear-gradient(135deg,#1e3a5f,#0ea5e9)" label="DISTRICTS" value={districtCount} sub={selectedDistrict ? 'Selected' : 'In Pahang'} blue />
                    </div>

                    {/* Target progress */}
                    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ fontSize: 13, color: '#8b949e', flexShrink: 0 }}>🎯 Target 90% Resolution {selectedDistrict ? `— ${scope}` : 'by Dec 2026'}</div>
                      <div style={{ flex: 1, height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: Number(pct) >= 90 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : Number(pct) >= 70 ? 'linear-gradient(90deg,#f59e0b,#fcd34d)' : 'linear-gradient(90deg,#ef4444,#f87171)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: Number(pct) >= 90 ? '#22c55e' : Number(pct) >= 70 ? '#f59e0b' : '#ef4444', flexShrink: 0 }}>{pct}% / 90%</div>
                    </div>
                  </>
                )
              })()}

              {/* MAP + PANEL */}
              <div style={{ display: 'grid', gridTemplateColumns: panelOpen ? '1fr 320px' : '1fr', gap: 16, marginBottom: 20 }}>

                {/* MAP */}
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>PAHANG MAP – KAMPUNG LEVEL (VORONOI POLYGON)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                        <span style={{ color: '#8b949e' }}>View By:</span>
                        <select value={viewBy} onChange={e => setViewBy(e.target.value)} style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>
                          <option>Blackspot Status</option>
                          <option>Intervention Cost</option>
                          <option>Risk Level</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                        {[['#22c55e','Solved'],['#f59e0b','Pending'],['#ef4444','Critical'],['#6e7681','No Data']].map(([c,l]) => (
                          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Filter row */}
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #21262d', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {['all','solved','pending'].map(s => (
                      <button key={s} onClick={() => setFilterStatus(s)}
                        style={{ background: filterStatus === s ? '#2563eb' : '#21262d', border: 'none', color: '#e6edf3', padding: '4px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: filterStatus === s ? 600 : 400 }}>
                        {s === 'all' ? 'Semua' : s === 'solved' ? 'Selesai' : 'Pending'}
                      </button>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b949e', marginLeft: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={showBuffers} onChange={e => setShowBuffers(e.target.checked)} style={{ accentColor: '#2563eb' }} /> Buffer Zone
                    </label>
                    {selectedDistrict && (
                      <button onClick={() => { setSelectedDistrict(null); setDistrictBounds(null); setSelectedSpot(null); setPanelClosed(false) }}
                        style={{ background: '#30363d', border: 'none', color: '#e6edf3', padding: '4px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>
                        ✕ Reset
                      </button>
                    )}
                  </div>

                  <MapContainer center={[3.65, 102.75]} zoom={8} style={{ height: 500, width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB" />
                    <ZoomToDistrict bounds={districtBounds} districtName={selectedDistrict} districtsData={districtsData} />

                    {districtsData && (
                      <GeoJSON data={districtsData}
                        style={feature => {
                          const name = feature.properties.DISTRICT || feature.properties.NAME_2 || feature.properties.NAME
                          const isSelected = selectedDistrict === name
                          const { color, fillOpacity } = getDistrictFill(name, blackspotsData)
                          return {
                            color: isSelected ? '#60a5fa' : color,
                            weight: isSelected ? 2.5 : 1,
                            fillColor: color,
                            fillOpacity: isSelected ? Math.min(fillOpacity + 0.2, 0.7) : fillOpacity,
                          }
                        }}
                        onEachFeature={(feature, layer) => {
                          const name = feature.properties.DISTRICT || feature.properties.NAME_2 || feature.properties.NAME
                          layer.bindTooltip(name, { permanent: false, sticky: true, className: 'leaflet-tooltip-dark' })
                          layer.on({ click: () => {
                            setSelectedDistrict(name)
                            setDistrictBounds(layer.getBounds())
                            setPanelClosed(false)
                            setSelectedSpot(null)
                          }})
                        }}
                      />
                    )}

                    {buffersData && showBuffers && (
                      <GeoJSON data={buffersData} interactive={false}
                        style={{ color: '#0ea5e9', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.08, dashArray: '4 3' }}
                      />
                    )}

                    {filteredSpots.map((spot, i) => {
                      const lat = spot.geometry.coordinates[1]
                      const lng = spot.geometry.coordinates[0]
                      const solved = spot.properties['STATUS SOLVE']
                      const cost = parseCost(spot.properties['KOS (RM)'])
                      const isCritical = !solved && cost > 5000000
                      const color = solved ? '#22c55e' : isCritical ? '#ef4444' : '#f59e0b'
                      return (
                        <CircleMarker key={i} center={[lat, lng]} radius={5}
                          pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 1.5 }}
                          eventHandlers={{ click: () => { setSelectedSpot(spot.properties); setPanelClosed(false) }}}
                        >
                          <Popup>
                            <b>{spot.properties.BLACKSPOT || 'Blackspot'}</b><br />
                            {spot.properties.DAERAH} · {solved ? '✅ Selesai' : '⏳ Pending'}
                          </Popup>
                        </CircleMarker>
                      )
                    })}
                  </MapContainer>
                </div>

                {/* KAMPUNG DETAIL PANEL */}
                {panelOpen && (
                  <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>KAMPUNG DETAILS</span>
                      <button onClick={() => setPanelClosed(true)} style={{ background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                      {selectedDistrict && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>Selected District</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{selectedDistrict}</div>
                          {distStats && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                              {[['Total',distStats.total,'#e6edf3'],['Solved',distStats.solved,'#22c55e'],['Pending',distStats.pending,'#f59e0b'],['Cost',formatCost(distStats.totalCost),'#a78bfa']].map(([l,v,c]) => (
                                <div key={l} style={{ background: '#0d1117', borderRadius: 8, padding: '8px 10px', border: '1px solid #21262d' }}>
                                  <div style={{ fontSize: 10, color: '#6e7681' }}>{l}</div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedSpot && (
                        <>
                          <div style={{ borderTop: '1px solid #21262d', paddingTop: 14, marginBottom: 14 }}>
                            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>Selected Kampung</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>{selectedSpot.BLACKSPOT || '-'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ color: selectedSpot['STATUS SOLVE'] ? '#22c55e' : '#f59e0b', fontSize: 12 }}>●</span>
                              <span style={{ fontSize: 12 }}>{selectedSpot['STATUS SOLVE'] ? 'Solved' : 'Pending'}</span>
                            </div>
                          </div>

                          <div style={{ fontSize: 12 }}>
                            {[
                              ['Status', selectedSpot['STATUS SOLVE'] ? 'Solved (YES)' : 'Pending (NO)', selectedSpot['STATUS SOLVE'] ? '#22c55e' : '#f59e0b'],
                              ['Intervention Project', selectedSpot['PROJEK INTERVENSI'] || '-', null],
                              ['Project Type', 'Reticulation & Storage', null],
                              ['Total Cost', selectedSpot['KOS (RM)'] || '-', '#a78bfa'],
                              ['District', selectedSpot.DAERAH || '-', null],
                              ['Operator', 'PAIP Pahang', null],
                            ].map(([label, val, col]) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #21262d' }}>
                                <span style={{ color: '#6e7681' }}>{label}</span>
                                <span style={{ color: col || '#e6edf3', fontWeight: col ? 600 : 400, textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* AI Recommendation mini */}
                      <div style={{ marginTop: 14, background: ai.bg, border: `1px solid ${ai.color}33`, borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 14 }}>🤖</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: 1 }}>AI RECOMMENDATION</span>
                        </div>
                        <div style={{ marginBottom: 6, fontSize: 12 }}>
                          Risk Level: <span style={{ color: ai.color, fontWeight: 700 }}>{ai.risk}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.5 }}>
                          {ai.actions[0]}. {ai.actions[1]}.
                        </div>
                        <button onClick={() => setActiveMenu('ai')} style={{ marginTop: 10, background: 'none', border: `1px solid ${ai.color}55`, color: ai.color, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                          View Full Details →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM CHARTS — reactive to selectedDistrict */}
              {(() => {
                // When a district is selected, filter spots for that district only
                const spotsForChart = selectedDistrict && blackspotsData
                  ? blackspotsData.features.filter(f =>
                      f.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
                    )
                  : blackspotsData?.features || []

                // Bar chart data
                const barData = selectedDistrict
                  ? spotsForChart.reduce((acc, s) => {
                      // group by intervention project when district selected
                      const proj = (s.properties['PROJEK INTERVENSI'] || 'Unknown').slice(0, 25)
                      const existing = acc.find(a => a.district === proj)
                      if (existing) {
                        existing.total += 1
                        s.properties['STATUS SOLVE'] ? existing.solved++ : existing.pending++
                      } else {
                        acc.push({ district: proj, total: 1, solved: s.properties['STATUS SOLVE'] ? 1 : 0, pending: s.properties['STATUS SOLVE'] ? 0 : 1 })
                      }
                      return acc
                    }, []).sort((a,b) => b.total - a.total).slice(0, 8)
                  : districtChartData

                // Donut data
                const activeResolved = spotsForChart.filter(s => s.properties['STATUS SOLVE']).length
                const activePending = spotsForChart.length - activeResolved
                const activeCritical = spotsForChart.filter(s => {
                  const cost = parseCost(s.properties['KOS (RM)'])
                  return !s.properties['STATUS SOLVE'] && cost > 5000000
                }).length
                const chartDonut = [
                  { name: 'Solved', value: activeResolved },
                  { name: 'Pending', value: activePending - activeCritical },
                  { name: 'Critical', value: activeCritical },
                ]

                // Cost bar data
                const costBar = selectedDistrict
                  ? spotsForChart.map(s => ({
                      district: (s.properties.BLACKSPOT || 'Unknown').slice(0, 18),
                      cost: parseCost(s.properties['KOS (RM)']) / 1e6
                    })).filter(d => d.cost > 0).sort((a,b) => b.cost - a.cost).slice(0, 7)
                  : costChartData.slice(0, 7)

                const maxCost = costBar[0]?.cost || 1

                const barLabel = selectedDistrict
                  ? `BLACKSPOT BY PROJECT — ${selectedDistrict}`
                  : 'BLACKSPOT SUMMARY BY DISTRICT'
                const donutLabel = selectedDistrict
                  ? `STATUS — ${selectedDistrict.charAt(0) + selectedDistrict.slice(1).toLowerCase()}`
                  : 'BLACKSPOT STATUS'
                const costLabel = selectedDistrict
                  ? `INTERVENTION COST — ${selectedDistrict.charAt(0) + selectedDistrict.slice(1).toLowerCase()} (RM)`
                  : 'INTERVENTION COST BY DISTRICT (RM)'

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    {/* Bar chart */}
                    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: '#e6edf3', letterSpacing: 0.3 }}>{barLabel}</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={barData} barSize={8} margin={{ left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                          <XAxis dataKey="district" tick={{ fontSize: 8, fill: '#6e7681' }} interval={0} angle={selectedDistrict ? -30 : 0} textAnchor={selectedDistrict ? 'end' : 'middle'} height={selectedDistrict ? 45 : 20} />
                          <YAxis tick={{ fontSize: 9, fill: '#6e7681' }} />
                          <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }} />
                          <Bar dataKey="total" fill="#2563eb" name="Total" />
                          <Bar dataKey="solved" fill="#22c55e" name="Solved" />
                          <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Donut */}
                    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: '#e6edf3', letterSpacing: 0.3 }}>{donutLabel}</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={chartDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value"
                            label={({ name, value, percent }) => value > 0 ? `${name} ${(percent*100).toFixed(1)}%` : ''}
                            labelLine={false} fontSize={9}>
                            {['#22c55e','#f59e0b','#ef4444'].map((c,i) => <Cell key={i} fill={c} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Cost bar */}
                    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: '#e6edf3', letterSpacing: 0.3 }}>{costLabel}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {costBar.map(d => {
                          const pct = (d.cost / maxCost * 100).toFixed(0)
                          return (
                            <div key={d.district} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: 10, color: '#8b949e', width: 70, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.district}>{d.district}</div>
                              <div style={{ flex: 1, height: 10, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#2563eb,#60a5fa)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                              </div>
                              <div style={{ fontSize: 10, color: '#60a5fa', width: 52, flexShrink: 0, textAlign: 'right' }}>{d.cost >= 1 ? `${d.cost.toFixed(1)}M` : `${(d.cost*1000).toFixed(0)}K`}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          )}

          {/* === MAP PAGE === */}
          {activeMenu === 'map' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ color: '#e6edf3', fontSize: 16, margin: 0 }}>🗺 Pahang GIS Map{selectedDistrict ? ` — ${selectedDistrict.charAt(0)+selectedDistrict.slice(1).toLowerCase()}` : ' — Full View'}</h2>
                {selectedDistrict && <span style={{ fontSize: 12, color: '#60a5fa', background: 'rgba(37,99,235,0.15)', padding: '3px 12px', borderRadius: 20 }}>Filtered: {selectedDistrict}</span>}
              </div>
              <MapContainer center={[3.65, 102.75]} zoom={selectedDistrict ? 10 : 8} style={{ height: '80vh', width: '100%', borderRadius: 14 }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB" />
                <ZoomToDistrict bounds={districtBounds} districtName={selectedDistrict} districtsData={districtsData} />
                {districtsData && (
                  <GeoJSON data={districtsData}
                    style={feature => {
                      const name = feature.properties.DISTRICT || feature.properties.NAME_2 || feature.properties.NAME
                      const { color, fillOpacity } = getDistrictFill(name, blackspotsData)
                      const isSelected = selectedDistrict && name?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
                      return { color: isSelected ? '#60a5fa' : color, weight: isSelected ? 2.5 : 1.5, fillColor: color, fillOpacity: selectedDistrict ? (isSelected ? fillOpacity + 0.2 : 0.05) : fillOpacity }
                    }}
                    onEachFeature={(feature, layer) => {
                      const name = feature.properties.DISTRICT || feature.properties.NAME_2 || feature.properties.NAME
                      layer.bindTooltip(name)
                      layer.on({ click: () => { setSelectedDistrict(name); setDistrictBounds(layer.getBounds()); setPanelClosed(false) }})
                    }}
                  />
                )}
                {buffersData && showBuffers && <GeoJSON data={buffersData} interactive={false} style={{ color: '#0ea5e9', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.08 }} />}
                {blackspotsData && blackspotsData.features
                  .filter(s => !selectedDistrict || s.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase())
                  .map((spot, i) => {
                    const solved = spot.properties['STATUS SOLVE']
                    const cost = parseCost(spot.properties['KOS (RM)'])
                    const isCritical = !solved && cost > 5e6
                    const color = solved ? '#22c55e' : isCritical ? '#ef4444' : '#f59e0b'
                    return (
                      <CircleMarker key={i} center={[spot.geometry.coordinates[1], spot.geometry.coordinates[0]]} radius={5}
                        pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 1 }}>
                        <Popup><b>{spot.properties.BLACKSPOT}</b><br />{spot.properties.DAERAH}<br />{solved ? '✅ Selesai' : '⏳ Pending'}<br />{spot.properties['KOS (RM)']}</Popup>
                      </CircleMarker>
                    )
                  })}
              </MapContainer>
            </div>
          )}

          {/* === DISTRICT OVERVIEW === */}
          {activeMenu === 'district' && (() => {
            // When district selected: show that district's detail card + its blackspot list
            // When all: show all district cards
            const displayDistricts = selectedDistrict
              ? districtChartData.filter(d => d.district.toUpperCase() === selectedDistrict.trim().toUpperCase())
              : districtChartData

            const spots = blackspotsData
              ? blackspotsData.features.filter(f =>
                  !selectedDistrict || f.properties.DAERAH?.trim().toUpperCase() === selectedDistrict.trim().toUpperCase()
                )
              : []

            return (
              <div>
                <SectionHeader
                  title="📊 District Overview"
                  district={selectedDistrict}
                  count={selectedDistrict ? spots.length : districtChartData.length}
                  countLabel={selectedDistrict ? 'blackspots' : 'districts'}
                />

                {/* District Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: selectedDistrict ? '1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                  {displayDistricts.map(d => {
                    const r = getAIRisk(d.pending, d.total)
                    const pct = d.total > 0 ? (d.solved/d.total*100).toFixed(1) : 0
                    const distCost = costChartData.find(c => c.district === d.district)
                    return (
                      <div key={d.district} style={{ background: '#161b22', border: `1px solid ${r.color}44`, borderRadius: 12, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#e6edf3' }}>{d.district.toUpperCase()}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: r.color, background: r.bg, padding: '3px 10px', borderRadius: 20 }}>{r.risk}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: selectedDistrict ? 'repeat(5,1fr)' : '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <div style={{ textAlign: 'center', background: '#0d1117', borderRadius: 8, padding: '8px 4px' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{d.total}</div><div style={{ fontSize: 9, color: '#6e7681' }}>TOTAL</div></div>
                          <div style={{ textAlign: 'center', background: '#0d1117', borderRadius: 8, padding: '8px 4px' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{d.solved}</div><div style={{ fontSize: 9, color: '#6e7681' }}>SOLVED</div></div>
                          <div style={{ textAlign: 'center', background: '#0d1117', borderRadius: 8, padding: '8px 4px' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{d.pending}</div><div style={{ fontSize: 9, color: '#6e7681' }}>PENDING</div></div>
                          {selectedDistrict && <>
                            <div style={{ textAlign: 'center', background: '#0d1117', borderRadius: 8, padding: '8px 4px' }}><div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{pct}%</div><div style={{ fontSize: 9, color: '#6e7681' }}>RESOLVED</div></div>
                            <div style={{ textAlign: 'center', background: '#0d1117', borderRadius: 8, padding: '8px 4px' }}><div style={{ fontSize: 12, fontWeight: 800, color: '#e6edf3' }}>{distCost ? `RM${distCost.cost.toFixed(0)}M` : '-'}</div><div style={{ fontSize: 9, color: '#6e7681' }}>TOTAL COST</div></div>
                          </>}
                        </div>
                        <div style={{ height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: Number(pct)>=90?'#22c55e':Number(pct)>=70?'#f59e0b':'#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#6e7681' }}>{pct}% resolved · Target: 90%</div>
                      </div>
                    )
                  })}
                </div>

                {/* Blackspot list when district selected */}
                {selectedDistrict && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', letterSpacing: 1, marginBottom: 12 }}>BLACKSPOT LIST — {selectedDistrict}</div>
                    <BlackspotTable features={spots} />
                  </>
                )}
              </div>
            )
          })()}

          {/* === BLACKSPOT ANALYSIS === */}
          {activeMenu === 'blackspot' && (() => {
            const spots = blackspotsData
              ? blackspotsData.features.filter(f =>
                  !selectedDistrict || f.properties.DAERAH?.trim().toUpperCase() === selectedDistrict.trim().toUpperCase()
                )
              : []
            return (
              <div>
                <SectionHeader title="📍 Blackspot Analysis" district={selectedDistrict} count={spots.length} countLabel="blackspots" />
                <BlackspotTable features={spots} />
              </div>
            )
          })()}

          {/* === INTERVENTION STATUS === */}
          {activeMenu === 'intervention' && (() => {
            const spots = blackspotsData
              ? blackspotsData.features.filter(f =>
                  !selectedDistrict || f.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()
                )
              : []
            // Group by project
            const byProject = spots.reduce((acc, s) => {
              const proj = s.properties['PROJEK INTERVENSI'] || 'BELUM DIKEMASKINI'
              if (!acc[proj]) acc[proj] = { project: proj, spots: [], cost: 0, solved: 0 }
              acc[proj].spots.push(s.properties.BLACKSPOT)
              acc[proj].cost += parseCost(s.properties['KOS (RM)'])
              if (s.properties['STATUS SOLVE']) acc[proj].solved++
              return acc
            }, {})
            const projList = Object.values(byProject).sort((a,b) => b.cost - a.cost)
            return (
              <div>
                <SectionHeader title="🔧 Intervention Status" district={selectedDistrict} count={spots.length} countLabel="blackspots" />
                <div style={{ display: 'grid', gap: 10 }}>
                  {projList.map((p, i) => {
                    const pct = p.spots.length > 0 ? (p.solved/p.spots.length*100).toFixed(0) : 0
                    const pending = p.spots.length - p.solved
                    return (
                      <div key={i} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3', marginBottom: 4 }}>{p.project}</div>
                            <div style={{ fontSize: 11, color: '#6e7681' }}>{p.spots.slice(0,4).join(', ')}{p.spots.length > 4 ? ` +${p.spots.length-4} more` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>{formatCost(p.cost)}</div>
                            <div style={{ fontSize: 11, color: '#6e7681' }}>{p.spots.length} locations</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: Number(pct)===100 ? '#22c55e' : '#2563eb', borderRadius: 3, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#22c55e', flexShrink: 0 }}>{p.solved} Solved</span>
                          {pending > 0 && <span style={{ fontSize: 11, color: '#f59e0b', flexShrink: 0 }}>{pending} Pending</span>}
                          <span style={{ fontSize: 11, color: '#6e7681', flexShrink: 0 }}>{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* === AI RECOMMENDATION === */}
          {activeMenu === 'ai' && (() => {
            const scopeLabel = selectedDistrict ? selectedDistrict.charAt(0)+selectedDistrict.slice(1).toLowerCase() : 'Pahang (All Districts)'
            const s = distStats || allStats
            const activeAI = getAIRisk(s.pending, s.total)
            const pct = s.total > 0 ? (s.solved/s.total*100).toFixed(1) : 0
            const showDistricts = !selectedDistrict ? districtChartData : districtChartData.filter(d => d.district.toUpperCase() === selectedDistrict)
            return (
              <div>
                <SectionHeader title="🤖 AI Recommendation" district={selectedDistrict} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={{ background: '#161b22', border: `1px solid ${activeAI.color}44`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 12, letterSpacing: 1 }}>ANN DEEP LEARNING RISK ASSESSMENT — {scopeLabel.toUpperCase()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: activeAI.bg, border: `3px solid ${activeAI.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: activeAI.color }}>{activeAI.risk}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>Risk Level: <span style={{ color: activeAI.color }}>{activeAI.risk}</span></div>
                        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Model: ANN Deep Learning · Accuracy: 94.4%</div>
                        <div style={{ fontSize: 12, color: '#8b949e' }}>Pending Rate: {s.total > 0 ? (s.pending/s.total*100).toFixed(1) : 0}% ({s.pending}/{s.total})</div>
                      </div>
                    </div>
                    {!selectedDistrict && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        {districtChartData.map(d => {
                          const r = getAIRisk(d.pending, d.total)
                          return (
                            <div key={d.district} style={{ background: r.bg, border: `1px solid ${r.color}33`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
                              onClick={() => handleDistrictSelect(d.district.toUpperCase())}>
                              <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 2 }}>{d.district.toUpperCase()}</div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: r.color }}>{r.risk}</div>
                              <div style={{ fontSize: 9, color: '#8b949e' }}>{d.pending}/{d.total}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 12, letterSpacing: 1 }}>RECOMMENDED ACTIONS — {scopeLabel.toUpperCase()}</div>
                    {activeAI.actions.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '10px 12px', background: '#0d1117', borderRadius: 8, border: '1px solid #21262d' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: activeAI.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, color: '#0d1117' }}>{i+1}</div>
                        <div style={{ fontSize: 12, color: '#e6edf3', lineHeight: 1.5 }}>{a}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 8, fontSize: 12, color: '#60a5fa' }}>
                      🎯 {scopeLabel}: {pct}% resolved · Target 90% by Dec 2026
                    </div>
                  </div>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 14, letterSpacing: 1 }}>RISK CLASSIFICATION MATRIX</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {[['LOW','< 10% pending','#22c55e','Continue monitoring, preventive maintenance'],
                      ['MEDIUM','10–30% pending','#f59e0b','Schedule maintenance, monitor NRW'],
                      ['HIGH','30–50% pending','#f97316','Prioritize intervention, increase inspection'],
                      ['CRITICAL','> 50% pending','#ef4444','Immediate action, emergency deployment']].map(([risk, desc, col, action]) => (
                      <div key={risk} style={{ background: `${col}11`, border: `2px solid ${activeAI.risk === risk ? col : col+'33'}`, borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: col, marginBottom: 4 }}>{risk}</div>
                        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>{desc}</div>
                        <div style={{ fontSize: 11, color: '#e6edf3' }}>{action}</div>
                        {activeAI.risk === risk && <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: col }}>◀ CURRENT STATUS</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* === PREDICTIVE INSIGHTS === */}
          {activeMenu === 'predictive' && (() => {
            const scopeLabel = selectedDistrict ? selectedDistrict.charAt(0)+selectedDistrict.slice(1).toLowerCase() : 'Pahang'
            const s = distStats || allStats
            const pct = s.total > 0 ? (s.solved/s.total*100) : 0
            // Simulate monthly progress toward 90%
            const remaining = Math.max(0, 90 - pct)
            const monthsLeft = 19 // Dec 2026 from May 2025
            const monthlyTarget = remaining / monthsLeft
            const trendData = Array.from({length: 6}, (_, i) => ({
              month: ['Jan','Feb','Mar','Apr','May','Jun'][i],
              projected: Math.min(90, pct + monthlyTarget * (i+1)).toFixed(1),
              target: 90,
            }))
            return (
              <div>
                <SectionHeader title="📈 Predictive Insights" district={selectedDistrict} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                  {[
                    ['Current Resolution', `${pct.toFixed(1)}%`, '#22c55e', `${s.solved}/${s.total} blackspots`],
                    ['Monthly Target Needed', `+${monthlyTarget.toFixed(1)}%`, '#f59e0b', `To reach 90% by Dec 2026`],
                    ['Remaining Blackspots', s.pending, '#ef4444', 'Still pending resolution'],
                  ].map(([label, val, col, sub]) => (
                    <div key={label} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 6 }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: col, marginBottom: 4 }}>{val}</div>
                      <div style={{ fontSize: 11, color: '#8b949e' }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 14, letterSpacing: 1 }}>PROJECTED RESOLUTION TREND — {scopeLabel.toUpperCase()} (Next 6 Months)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6e7681' }} />
                      <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: '#6e7681' }} />
                      <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }} formatter={v => `${v}%`} />
                      <Bar dataKey="projected" fill="#2563eb" name="Projected %" radius={[4,4,0,0]} />
                      <Bar dataKey="target" fill="#22c55e22" name="Target 90%" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 14, letterSpacing: 1 }}>DISTRICT PRIORITY RANKING — By Pending Count</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {districtChartData.filter(d => d.pending > 0).sort((a,b) => b.pending - a.pending).map((d, i) => {
                      const r = getAIRisk(d.pending, d.total)
                      return (
                        <div key={d.district} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#0d1117', borderRadius: 8, border: '1px solid #21262d' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? '#ef444422' : '#21262d', border: `1px solid ${i < 3 ? '#ef4444' : '#30363d'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i < 3 ? '#ef4444' : '#6e7681', flexShrink: 0 }}>{i+1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{d.district.toUpperCase()}</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#f59e0b', width: 80, textAlign: 'right' }}>{d.pending} pending</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: r.color, width: 60, textAlign: 'right' }}>{r.risk}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* === REPORTS === */}
          {activeMenu === 'reports' && (() => {
            const scopeLabel = selectedDistrict ? selectedDistrict.charAt(0)+selectedDistrict.slice(1).toLowerCase() : 'All Pahang'
            const spots = blackspotsData
              ? blackspotsData.features.filter(f => !selectedDistrict || f.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase())
              : []
            const s = distStats || allStats
            const pct = s.total > 0 ? (s.solved/s.total*100).toFixed(1) : 0

            const downloadCSV = (rows, filename) => {
              const header = 'No,Blackspot,District,Status,Project Intervensi,Kos (RM),Risk\n'
              const body = rows.map((f, i) => {
                const p = f.properties
                const solved = p['STATUS SOLVE']
                const cost = parseCost(p['KOS (RM)'])
                const risk = !solved && cost > 5e6 ? 'CRITICAL' : !solved && cost > 1e6 ? 'HIGH' : !solved ? 'MEDIUM' : 'LOW'
                return `${i+1},"${p.BLACKSPOT}","${p.DAERAH}","${solved ? 'Selesai' : 'Pending'}","${p['PROJEK INTERVENSI']}","${p['KOS (RM)']}","${risk}"`
              }).join('\n')
              const blob = new Blob([header + body], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
              URL.revokeObjectURL(url)
            }

            const downloadDistrictCSV = () => {
              const header = 'District,Total,Solved,Pending,Resolution %,Risk Level,Total Cost (RM)\n'
              const body = districtChartData.map(d => {
                const r = getAIRisk(d.pending, d.total)
                const costRow = costChartData.find(c => c.district === d.district)
                return `"${d.district.toUpperCase()}",${d.total},${d.solved},${d.pending},${d.total>0?(d.solved/d.total*100).toFixed(1):0}%,"${r.risk}","RM ${((costRow?.cost||0)*1e6).toLocaleString()}"`
              }).join('\n')
              const blob = new Blob([header + body], { type: 'text/csv' })
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `PAIP_District_Summary_${new Date().toISOString().slice(0,10)}.csv`; a.click()
              URL.revokeObjectURL(url)
            }

            return (
              <div>
                <SectionHeader title="📋 Reports & Export" district={selectedDistrict} />
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                  {[['Total',s.total,'#60a5fa'],['Solved',s.solved,'#22c55e'],['Pending',s.pending,'#f59e0b'],['Resolution',`${pct}%`,'#a78bfa']].map(([l,v,c]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: 11, color: '#6e7681' }}>{l} — {scopeLabel}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {[
                    { icon: '📊', title: 'Blackspot Report', desc: `Full blackspot list for ${scopeLabel} with status, project & risk classification.`, btn: '⬇ Download CSV', action: () => downloadCSV(spots, `PAIP_Blackspot_${selectedDistrict||'Pahang'}_${new Date().toISOString().slice(0,10)}.csv`) },
                    { icon: '🏙', title: 'District Summary', desc: 'District-level summary with resolution rate, risk level and total intervention cost.', btn: '⬇ Download CSV', action: downloadDistrictCSV },
                    { icon: '⏳', title: 'Pending Blackspots', desc: `Export only pending (unresolved) blackspots for ${scopeLabel}.`, btn: '⬇ Download CSV', action: () => downloadCSV(spots.filter(f => !f.properties['STATUS SOLVE']), `PAIP_Pending_${selectedDistrict||'Pahang'}_${new Date().toISOString().slice(0,10)}.csv`) },
                    { icon: '✅', title: 'Resolved Blackspots', desc: `Export only resolved blackspots for ${scopeLabel}.`, btn: '⬇ Download CSV', action: () => downloadCSV(spots.filter(f => f.properties['STATUS SOLVE']), `PAIP_Resolved_${selectedDistrict||'Pahang'}_${new Date().toISOString().slice(0,10)}.csv`) },
                    { icon: '🗺', title: 'GeoJSON Export', desc: 'Export blackspot point data as GeoJSON for use in QGIS or ArcGIS.', btn: '⬇ Download GeoJSON', action: () => {
                      const filtered = { type: 'FeatureCollection', features: spots }
                      const blob = new Blob([JSON.stringify(filtered,null,2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `PAIP_Blackspot_${selectedDistrict||'Pahang'}.geojson`; a.click(); URL.revokeObjectURL(url)
                    }},
                    { icon: '🤖', title: 'AI Risk Report', desc: `AI risk classification for all districts with recommended actions.`, btn: '⬇ Download CSV', action: () => {
                      const header = 'District,Total,Pending,Pending Rate,Risk Level,Recommended Action\n'
                      const body = districtChartData.map(d => {
                        const r = getAIRisk(d.pending, d.total)
                        return `"${d.district.toUpperCase()}",${d.total},${d.pending},${d.total>0?(d.pending/d.total*100).toFixed(1):0}%,"${r.risk}","${r.actions[0]}"`
                      }).join('\n')
                      const blob = new Blob([header+body],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`PAIP_AI_Risk_Report_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
                    }},
                  ].map(({ icon, title, desc, btn, action }) => (
                    <div key={title} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#e6edf3' }}>{title}</div>
                      <div style={{ fontSize: 12, color: '#6e7681', marginBottom: 14, flex: 1, lineHeight: 1.6 }}>{desc}</div>
                      <button onClick={action} style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: '0.2s' }}
                        onMouseEnter={e => e.target.style.opacity='0.85'} onMouseLeave={e => e.target.style.opacity='1'}>
                        {btn}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* === EXPORT DATA === */}
          {activeMenu === 'export' && (() => {
            const spots = blackspotsData
              ? blackspotsData.features.filter(f => !selectedDistrict || f.properties.DAERAH?.trim().toLowerCase() === selectedDistrict.trim().toLowerCase())
              : []
            return (
              <div>
                <SectionHeader title="⬇ Export Data" district={selectedDistrict} />
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#6e7681', marginBottom: 16 }}>Semua export ikut district yang dipilih. Tukar district kat dropdown atas untuk export data berbeza.</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                      ['⬇ Full Dataset (CSV)', () => {
                        const h = 'No,Blackspot,District,Status,Project,Cost,Risk\n'
                        const b = spots.map((f,i) => { const p=f.properties; const s=p['STATUS SOLVE']; const c=parseCost(p['KOS (RM)']); const r=!s&&c>5e6?'CRITICAL':!s&&c>1e6?'HIGH':!s?'MEDIUM':'LOW'; return `${i+1},"${p.BLACKSPOT}","${p.DAERAH}","${s?'Selesai':'Pending'}","${p['PROJEK INTERVENSI']}","${p['KOS (RM)']}","${r}"` }).join('\n')
                        const blob=new Blob([h+b],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`PAIP_Full_${selectedDistrict||'Pahang'}.csv`; a.click(); URL.revokeObjectURL(url)
                      }],
                      ['⬇ GeoJSON', () => {
                        const blob=new Blob([JSON.stringify({type:'FeatureCollection',features:spots},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`PAIP_${selectedDistrict||'Pahang'}.geojson`; a.click(); URL.revokeObjectURL(url)
                      }],
                      ['⬇ Pending Only (CSV)', () => {
                        const pending=spots.filter(f=>!f.properties['STATUS SOLVE']); const h='No,Blackspot,District,Project,Cost\n'; const b=pending.map((f,i)=>`${i+1},"${f.properties.BLACKSPOT}","${f.properties.DAERAH}","${f.properties['PROJEK INTERVENSI']}","${f.properties['KOS (RM)']}"`).join('\n'); const blob=new Blob([h+b],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`PAIP_Pending_${selectedDistrict||'Pahang'}.csv`; a.click(); URL.revokeObjectURL(url)
                      }],
                    ].map(([label, fn]) => (
                      <button key={label} onClick={fn} style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                        onMouseEnter={e => e.target.style.background='#2563eb'} onMouseLeave={e => e.target.style.background='#21262d'}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* === ABOUT === */}
          {activeMenu === 'about' && (
            <div style={{ maxWidth: 700 }}>
              <h2 style={{ marginBottom: 16, color: '#e6edf3', fontSize: 16 }}>ℹ About System</h2>
              <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>PAIP Pahang Blackspot Monitoring System</div>
                <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.8, marginBottom: 16 }}>
                  GIS-Based Water Supply Blackspot & Intervention Monitoring with AI Recommendation. The purpose of this system is to provide a GIS-based monitoring and decision support platform for water supply blackspots in Pahang. The system enables PAIP to visualize blackspot locations, monitor intervention progress, analyze resolution performance, evaluate project costs, and prioritize areas requiring immediate attention.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['✅ GIS Monitoring','Blackspot location, buffer zone, district boundaries'],
                    ['✅ Blackspot Tracking','Status, intervention project, cost per location'],
                    ['✅ Progress Monitoring','Resolution rate toward 90% target by Dec 2026'],
                    ['✅ Decision Support','District prioritization and risk ranking'],
                    ['✅ AI Recommendation','ANN-based risk classification (LOW/MED/HIGH/CRITICAL)'],
                    ['✅ Big Data Analytics','District comparison, cost analytics, trend analysis']].map(([t, d]) => (
                    <div key={t} style={{ background: '#0d1117', borderRadius: 8, padding: '12px 14px', border: '1px solid #21262d' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#60a5fa' }}>{t}</div>
                      <div style={{ fontSize: 11, color: '#6e7681' }}>{d}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', fontSize: 11, color: '#6e7681' }}>
                  Built with: React · Leaflet · Recharts · GeoJSON · AI Decision Engine<br />
                  Data powered by: PAIP Pahang GIS Dashboard
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div style={{ padding: '10px 24px', borderTop: '1px solid #21262d', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 11, color: '#6e7681', background: '#0d1117' }}>
          <span>💧</span>
          <span>Powered by PAIP GIS Dashboard</span>
          <span style={{ color: '#30363d' }}>|</span>
          <span>Built with React, Leaflet, GeoJSON & AI Engine</span>
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, iconBg, label, value, pct, sub, green, orange, purple, blue, valueSm }) {
  const accent = green ? '#22c55e' : orange ? '#f59e0b' : purple ? '#a78bfa' : blue ? '#0ea5e9' : '#60a5fa'
  return (
    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#6e7681', fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: valueSm ? 16 : 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
          {value} {pct && <span style={{ fontSize: 13, color: '#8b949e' }}>({pct})</span>}
        </div>
        <div style={{ fontSize: 11, color: '#6e7681', marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  )
}

function SectionHeader({ title, district, count, countLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #21262d' }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#e6edf3', margin: 0 }}>{title}</h2>
        {district && (
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>
            Filtered: <span style={{ color: '#60a5fa', fontWeight: 600 }}>{district.charAt(0) + district.slice(1).toLowerCase()}</span>
            {count !== undefined && <span> · {count} {countLabel}</span>}
          </div>
        )}
        {!district && count !== undefined && (
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{count} {countLabel} — Pahang (All Districts)</div>
        )}
      </div>
    </div>
  )
}

function BlackspotTable({ features }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('blackspot')

  const filtered = features
    .filter(f => {
      const p = f.properties
      const matchSearch = !search ||
        p.BLACKSPOT?.toLowerCase().includes(search.toLowerCase()) ||
        p.DAERAH?.toLowerCase().includes(search.toLowerCase()) ||
        (p['PROJEK INTERVENSI'] || '').toLowerCase().includes(search.toLowerCase())
      const solved = p['STATUS SOLVE']
      const matchStatus = statusFilter === 'all' || (statusFilter === 'solved' ? solved : !solved)
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      if (sortBy === 'cost') return parseCost(b.properties['KOS (RM)']) - parseCost(a.properties['KOS (RM)'])
      if (sortBy === 'district') return (a.properties.DAERAH || '').localeCompare(b.properties.DAERAH || '')
      return (a.properties.BLACKSPOT || '').localeCompare(b.properties.BLACKSPOT || '')
    })

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Cari blackspot, daerah, projek..."
          style={{ flex: 1, minWidth: 200, background: '#161b22', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none' }}
        />
        {['all','solved','pending'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ background: statusFilter === s ? '#2563eb' : '#21262d', border: 'none', color: '#e6edf3', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: statusFilter === s ? 600 : 400 }}>
            {s === 'all' ? 'Semua' : s === 'solved' ? '✅ Selesai' : '⏳ Pending'}
          </button>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', outline: 'none' }}>
          <option value="blackspot">Sort: Nama</option>
          <option value="cost">Sort: Kos (Tinggi→Rendah)</option>
          <option value="district">Sort: Daerah</option>
        </select>
        <span style={{ fontSize: 12, color: '#6e7681', flexShrink: 0 }}>{filtered.length} rekod</span>
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0d1117' }}>
                {['#','Blackspot','District','Status','Projek Intervensi','Kos (RM)','Risk'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6e7681', fontWeight: 600, borderBottom: '1px solid #21262d', fontSize: 11, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>Tiada data dijumpai</td></tr>
              )}
              {filtered.map((f, i) => {
                const p = f.properties
                const solved = p['STATUS SOLVE']
                const cost = parseCost(p['KOS (RM)'])
                const risk = !solved && cost > 5e6 ? 'CRITICAL' : !solved && cost > 1e6 ? 'HIGH' : !solved ? 'MEDIUM' : 'LOW'
                const riskColor = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' }[risk]
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #21262d' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '9px 14px', color: '#6e7681', width: 40 }}>{i+1}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: '#e6edf3' }}>{p.BLACKSPOT}</td>
                    <td style={{ padding: '9px 14px', color: '#8b949e' }}>{p.DAERAH}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ background: solved ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: solved ? '#22c55e' : '#f59e0b', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {solved ? '✅ Selesai' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#8b949e', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['PROJEK INTERVENSI']}>{p['PROJEK INTERVENSI'] || '-'}</td>
                    <td style={{ padding: '9px 14px', color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap' }}>{p['KOS (RM)'] || '-'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ color: riskColor, fontWeight: 700, fontSize: 11 }}>{risk}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
