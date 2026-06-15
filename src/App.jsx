import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import CommandCenter from './pages/CommandCenter';

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/" element={<CommandCenter />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
