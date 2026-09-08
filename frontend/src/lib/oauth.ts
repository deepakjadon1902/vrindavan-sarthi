export const startGoogleSignIn = (redirect = '/') => {
  const params = new URLSearchParams({
    origin: window.location.origin,
    redirect,
  });

  window.location.href = `/api/auth/google?${params.toString()}`;
};
