import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { Home, Dashboard, AllNodes, Admin, NodeDetails, EvaraTank, EvaraDeep, EvaraFlow, Login } from './pages';
import AIAssistant from './pages/AIAssistant';
import SuperAdminOverview from './pages/SuperAdminOverview';

import { AuthProvider } from './context/AuthContext';

const SplashScreen = ({ onDone }: { onDone: () => void }) => {
    const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

    useEffect(() => {
        // Trigger animation start slightly after mount to ensure transition happens
        // Sequence:
        // 0ms: Mount (opacity 0, scale 0.5)
        // 50ms: Set 'hold' -> transitions to (opacity 1, scale 1) over 0.8s
        // 1200ms: Set 'out' -> transitions to (opacity 0) over 0.5s
        // 1700ms: Done

        const t1 = setTimeout(() => setPhase('hold'), 50);
        const t2 = setTimeout(() => setPhase('out'), 1200);
        const t3 = setTimeout(onDone, 1700);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [onDone]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '20px',
            opacity: phase === 'out' ? 0 : 1,
            pointerEvents: phase === 'out' ? 'none' : 'auto',
            transition: 'opacity 0.5s ease',
        }}>
            <img
                src="/evara-logo.png"
                alt="EvaraTech"
                style={{
                    height: '180px',
                    objectFit: 'contain',
                    opacity: phase === 'in' ? 0 : 1,
                    transform: phase === 'in' ? 'scale(0.8)' : 'scale(1)',
                    transition: 'opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy zoom
                    willChange: 'opacity, transform'
                }}
            />
            <h1 style={{
                margin: 0,
                fontSize: '32px',
                fontWeight: '700',
                letterSpacing: '-0.5px', // Tighter tracking like the image
                opacity: phase === 'in' ? 0 : 1,
                transform: phase === 'in' ? 'scale(0.8) translateY(20px)' : 'scale(1) translateY(0)',
                transition: 'opacity 0.8s ease-out 0.1s, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
                willChange: 'opacity, transform',
                fontFamily: '"Interact", sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '0px'
            }}>
                <span style={{ color: '#0077b6' }}>Evara</span>
                <span style={{ color: '#22c55e' }}>Tech</span>
            </h1>
        </div>
    );
};

function App() {
    const [splashDone, setSplashDone] = useState(false);

    return (
        <>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
            {splashDone && (
                <AuthProvider>
                    <Router>
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/login" element={<Login />} />

                            <Route element={<ProtectedRoute />}>
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
                                </Route>

                                {/* Super Admin Only */}
                                <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
                                    <Route element={<MainLayout />}>
                                        <Route path="/superadmin" element={<SuperAdminOverview />} />
                                    </Route>
                                </Route>
                            </Route>

                            {/* Catch-all redirect to Dashboard */}
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </Router>
                </AuthProvider>
            )}
        </>
    );
}

export default App;
