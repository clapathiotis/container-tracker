import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Track from './pages/Track'
import Admin from './pages/Admin'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:slug" element={<Track />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </HashRouter>
  )
}
