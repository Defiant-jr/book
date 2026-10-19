// Temporary local access; production builds always require authentication.
export const isLoginDisabled = import.meta.env.DEV
  && import.meta.env.VITE_DISABLE_LOGIN !== 'false';
