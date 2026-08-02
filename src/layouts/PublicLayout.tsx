import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { NetworkStatusAndLoader } from '../components/ui/NetworkStatusAndLoader';

export const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 selection:bg-primary-200 selection:text-primary-900">
      <NetworkStatusAndLoader />
      <Navbar />
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <Footer />
    </div>
  );
};
