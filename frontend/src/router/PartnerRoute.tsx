import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const PartnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'partner') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default PartnerRoute;
