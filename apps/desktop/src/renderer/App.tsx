import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Viewer } from './pages/Viewer';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/viewer" element={<Viewer />} />
      </Routes>
    </HashRouter>
  );
}
