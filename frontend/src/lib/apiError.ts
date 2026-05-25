import type { AxiosError } from 'axios';

export const getApiErrorMessage = (err: unknown, fallback = 'Request failed'): string => {
  const e = err as AxiosError<any> | any;
  const msg =
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.message;

  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
};

