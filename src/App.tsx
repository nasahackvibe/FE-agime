import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import HomePage from '@/pages/HomePage'
import MapPage from '@/pages/MapPage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import './App.css'

function AppContent() {
  const location = useLocation()
  const showNavigation = location.pathname !== '/map'

  return (
    <div className={showNavigation ? "min-h-screen" : ""}>
      {showNavigation && <Navigation />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
