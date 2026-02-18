import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import { Home, Dashboard, AllNodes, Admin, NodeDetails, EvaraTank, EvaraDeep, EvaraFlow, Login } from './pages';
import AIAssistant from './pages/AIAssistant';
import SuperAdminOverview from './pages/SuperAdminOverview';
import { AuthProvider } from './context/AuthContext';

function App() {
    return (
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
    );
}

export default App;
