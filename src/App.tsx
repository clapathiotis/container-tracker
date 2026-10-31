import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Track from './pages/Track'
import Admin from './pages/Admin'
import Account from './pages/Account'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:slug" element={<Track />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </HashRouter>
  )
}
