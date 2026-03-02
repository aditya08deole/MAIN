import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { Home, Dashboard, AllNodes, Admin, NodeDetails, EvaraTankAnalytics, EvaraDeepAnalytics, EvaraFlowAnalytics, Login } from './pages';
import AdminLayout from './layouts/AdminLayout';
// import SuperAdminOverview from './pages/SuperAdminOverview';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
// import AdminNodes from './pages/admin/AdminNodes';
import AdminConfig from './pages/admin/AdminConfig';
import ZonesOverview from './pages/admin/hierarchy/ZonesOverview';
import ZoneCommunities from './pages/admin/hierarchy/ZoneCommunities';
import ZoneCustomers from './pages/admin/hierarchy/ZoneCustomers';
import CommunityCustomers from './pages/admin/hierarchy/CommunityCustomers';
import CustomerDetails from './pages/admin/hierarchy/CustomerDetails';

import { AuthProvider } from './context/AuthContext';
import { TenancyProvider } from './context/TenancyContext';
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

import SplashScreen from './components/ui/SplashScreen';

const GlobalBackground = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    const isMap = location.pathname.startsWith('/map');
    return (
        <div className={isMap ? '' : 'app-global-bg'}>
            {!isMap && (
                <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#3A7AFE]/10 blur-[160px] animate-blob mix-blend-multiply opacity-50"></div>
                    <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#CFEDE6]/20 blur-[180px] animate-blob animation-delay-2000 mix-blend-multiply opacity-40"></div>
                    <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-[#D7ECFF]/20 blur-[160px] animate-blob animation-delay-4000 mix-blend-multiply opacity-30"></div>
                    {/* Additional overlay blur to enhance glass textures */}
                    <div className="absolute inset-0 backdrop-blur-[12px] z-0"></div>
                </div>
            )}
            <div className="relative z-10 w-full min-h-screen">
                {children}
            </div>
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
                    <TenancyProvider>
                        <ToastProvider>
                            <Router>
                                <GlobalBackground>
                                    <Routes>
                                        <Route path="/" element={<Navigate to="/map" replace />} />
                                        <Route path="/login" element={<Login />} />

                                        <Route element={<ProtectedRoute />}>
                                            <Route element={<MainLayout />}>
                                                <Route path="/map" element={<Home />} />
                                                <Route path="/dashboard" element={<Dashboard />} />
                                                <Route path="/nodes" element={<AllNodes />} />
                                                <Route path="/node/:id" element={<NodeDetails />} />
                                                <Route path="/evaratank" element={<EvaraTankAnalytics />} />
                                                <Route path="/evaratank/:id" element={<EvaraTankAnalytics />} />
                                                <Route path="/evaradeep" element={<EvaraDeepAnalytics />} />
                                                <Route path="/evaradeep/:id" element={<EvaraDeepAnalytics />} />
                                                <Route path="/evaraflow" element={<EvaraFlowAnalytics />} />
                                                <Route path="/evaraflow/:id" element={<EvaraFlowAnalytics />} />
                                                <Route path="/admin" element={<Admin />} />
                                            </Route>

                                            {/* Admin Routes (Super Admin) */}
                                            <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
                                                <Route path="/superadmin" element={<AdminLayout />}>
                                                    <Route index element={<Navigate to="dashboard" replace />} />
                                                    <Route path="dashboard" element={<AdminDashboard />} />
                                                    <Route path="customers" element={<AdminCustomers />} />

                                                    {/* Hierarchy Routes */}
                                                    <Route path="zones" element={<ZonesOverview />} />
                                                    <Route path="zones/:regionId" element={<ZoneCommunities />} />
                                                    <Route path="communities/:communityId" element={<CommunityCustomers />} />
                                                    <Route path="customers/:customerId" element={<CustomerDetails />} />
                                                    <Route path="zones/:regionId/customers" element={<ZoneCustomers />} />

                                                    {/* Legacy route redirects or keep if needed */}
                                                    <Route path="nodes" element={<Navigate to="zones" replace />} />

                                                    <Route path="config" element={<AdminConfig />} />
                                                </Route>
                                            </Route>
                                        </Route>

                                        {/* Catch-all redirect to Map */}
                                    </Routes>
                                </GlobalBackground>
                            </Router>
                        </ToastProvider>
                    </TenancyProvider>
                </AuthProvider>
            )}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}

export default App;
