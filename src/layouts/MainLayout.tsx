import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

const MainLayout = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Navbar />
            <main className="flex-1 relative overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
