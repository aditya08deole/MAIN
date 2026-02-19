import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { Home, Dashboard, AllNodes, Admin, NodeDetails, EvaraTank, EvaraDeep, EvaraFlow, Login } from './pages';
import AIAssistant from './pages/AIAssistant';
import AdminLayout from './layouts/AdminLayout';
// import SuperAdminOverview from './pages/SuperAdminOverview';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
// import AdminNodes from './pages/admin/AdminNodes';
import AdminConfig from './pages/admin/AdminConfig';
import RegionsOverview from './pages/admin/hierarchy/RegionsOverview';
import RegionCustomers from './pages/admin/hierarchy/RegionCustomers';
import CustomerDetails from './pages/admin/hierarchy/CustomerDetails';

import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastProvider';

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes (Data stays fresh)
            gcTime: 1000 * 60 * 30, // 30 minutes (Cache garbage collection)
            retry: 1,
            refetchOnWindowFocus: false, // Prevent multiple fetches on tab switch
        },
    },
});

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
        <QueryClientProvider client={queryClient}>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
            {splashDone && (
                <AuthProvider>
                    <ToastProvider>
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

                                    {/* Admin Routes (Super Admin & Distributor) */}
                                    <Route element={<ProtectedRoute allowedRoles={['superadmin', 'distributor']} />}>
                                        <Route path="/superadmin" element={<AdminLayout />}>
                                            <Route index element={<Navigate to="dashboard" replace />} />
                                            <Route path="dashboard" element={<AdminDashboard />} />
                                            <Route path="customers" element={<AdminCustomers />} />

                                            {/* Hierarchy Routes */}
                                            <Route path="regions" element={<RegionsOverview />} />
                                            <Route path="regions/:regionId" element={<RegionCustomers />} />
                                            <Route path="customers/:customerId" element={<CustomerDetails />} />

                                            {/* Legacy route redirects */}
                                            <Route path="communities/:communityId" element={<Navigate to="../regions" replace />} />

                                            {/* Legacy route redirects or keep if needed */}
                                            <Route path="nodes" element={<Navigate to="regions" replace />} />

                                            <Route path="config" element={<AdminConfig />} />
                                        </Route>
                                    </Route>
                                </Route>

                                {/* Catch-all redirect to Dashboard */}
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                        </Router>
                    </ToastProvider>
                </AuthProvider>
            )}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}

export default App;
