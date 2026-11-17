import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const ProtectedRoute = ({
  children,
  allowGuest = false,
}: {
  children: React.ReactNode;
  allowGuest?: boolean;
}) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const hasGuestToken = Boolean(query.get('token') || query.get('guestAccessToken'));

  if (!isAuthenticated && !(allowGuest && hasGuestToken)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
