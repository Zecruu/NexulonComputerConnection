import { HashRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { RoleSelect } from './pages/RoleSelect';
import { CustomerHelp } from './pages/CustomerHelp';
import { SupportPortal } from './pages/SupportPortal';
import { Admin } from './pages/Admin';
import { Viewer } from './pages/Viewer';

const CLERK_KEY = 'pk_test_ZHJpdmluZy1zd2luZS05Ni5jbGVyay5hY2NvdW50cy5kZXYk';

export default function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      afterSignOutUrl="#/"
    >
      <HashRouter>
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/help" element={<CustomerHelp />} />
          <Route path="/portal" element={<SupportPortal />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/viewer" element={<Viewer />} />
        </Routes>
      </HashRouter>
    </ClerkProvider>
  );
}
