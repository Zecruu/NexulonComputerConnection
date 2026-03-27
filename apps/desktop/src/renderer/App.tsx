import { HashRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { RoleSelect } from './pages/RoleSelect';
import { CustomerHelp } from './pages/CustomerHelp';
import { SupportPortal } from './pages/SupportPortal';
import { Viewer } from './pages/Viewer';

// Clerk publishable key — set via env var or hardcode for the app
// IMPORTANT: Replace with your actual Clerk publishable key
const CLERK_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_REPLACE_WITH_YOUR_CLERK_KEY';

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
          <Route path="/viewer" element={<Viewer />} />
        </Routes>
      </HashRouter>
    </ClerkProvider>
  );
}
