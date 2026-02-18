import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { Home, Dashboard, AllNodes, Admin, NodeDetails, EvaraTank, EvaraDeep, EvaraFlow, Login } from './pages';
import AIAssistant from './pages/AIAssistant';
import SuperAdminOverview from './pages/SuperAdminOverview';
import { AuthProvider } from './context/AuthContext';

const SplashScreen = ({ onDone }: { onDone: () => void }) => {
    const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

    useEffect(() => {
        // fade-in → hold → fade-out
        const t1 = setTimeout(() => setPhase('hold'), 900);
        const t2 = setTimeout(() => setPhase('out'), 3000);
        const t3 = setTimeout(onDone, 3800);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [onDone]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '20px',
            opacity: phase === 'out' ? 0 : 1,
            transition: phase === 'in' ? 'opacity 0.6s ease' : phase === 'out' ? 'opacity 0.55s ease' : 'none',
        }}>
            <img
                src="/evara-logo.png"
                alt="EvaraTech"
                style={{
                    height: '140px',
                    objectFit: 'contain',
                    opacity: phase === 'in' ? 0 : 1,
                    transform: phase === 'in' ? 'scale(0.02)' : 'scale(1)',
                    transition: 'opacity 0.7s ease, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            />
            <div style={{
                width: '160px', height: '3px',
                background: '#f1f5f9',
                borderRadius: '99px',
                overflow: 'hidden',
                opacity: phase === 'in' ? 0 : 1,
                transition: 'opacity 0.3s ease 0.4s',
            }}>
                <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #2563eb, #0ea5e9)',
                    borderRadius: '99px',
                    animation: 'splash-bar 2.2s ease forwards',
                }} />
            </div>
            <style>{`
                @keyframes splash-bar {
                    from { width: 0% }
                    to   { width: 100% }
                }
            `}</style>
        </div>
    );
};

function App() {
    const [splashDone, setSplashDone] = useState(false);

    return (
        <>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<Login />} />

                    <Route element={<MainLayout />}>
                        <Route path="/home" element={<Home />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/nodes" element={<AllNodes />} />
                        <Route path="/node/:id" element={<NodeDetails />} />
                        <Route path="/evaratank" element={<EvaraTank />} />
                        <Route path="/evaradeep" element={<EvaraDeep />} />
                        <Route path="/evaraflow" element={<EvaraFlow />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/ai" element={<AIAssistant />} />
                        <Route path="/superadmin" element={<SuperAdminOverview />} />
                    </Route>

                    {/* Catch-all redirect to Dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
        </>
    );
}

export default App;
