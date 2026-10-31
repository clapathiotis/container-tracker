import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Track from './pages/Track'
import Admin from './pages/Admin'
import Account from './pages/Account'
import PublicOrderTrack from './pages/PublicOrderTrack'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:slug" element={<Track />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/o/:token" element={<PublicOrderTrack />} />\n        <Route path="*" element={<Navigate to="/account" replace />} />
      </Routes>
    </HashRouter>
  )
}
