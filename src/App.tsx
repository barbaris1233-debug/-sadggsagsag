import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ContactTable from './components/ContactTable';
import ActionBar from './components/ActionBar';
import ImportModal from './components/ImportModal';
import ExcludeModal from './components/ExcludeModal';
import TokensModal from './components/TokensModal';

export default function App() {
  const [importOpen,  setImportOpen]  = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);
  const [tokensOpen,  setTokensOpen]  = useState(false);

  return (
    <div className="h-screen w-screen flex bg-[#050505] text-white overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onImport={() => setImportOpen(true)}
          onExclude={() => setExcludeOpen(true)}
          onTokens={() => setTokensOpen(true)}
        />
        <ContactTable />
      </div>
      <ActionBar />
      <ImportModal  open={importOpen}  onClose={() => setImportOpen(false)} />
      <ExcludeModal open={excludeOpen} onClose={() => setExcludeOpen(false)} />
      <TokensModal  open={tokensOpen}  onClose={() => setTokensOpen(false)} />
    </div>
  );
}
