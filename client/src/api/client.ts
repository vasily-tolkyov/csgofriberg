import axios from 'axios';
import { translate } from '../i18n/messages';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export function apiErrorCode(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const code = err.response?.data?.code;
    return typeof code === 'string' && code ? code : null;
  }
  const fallbackCode = (err as { response?: { data?: { code?: unknown } } } | null | undefined)?.response?.data?.code;
  return typeof fallbackCode === 'string' && fallbackCode ? fallbackCode : null;
}

/** 从 axios 错误中取出后端错误码并翻译成文案 */
export function errMsg(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return translate('NETWORK_ERROR');
    const code = String(err.response.data?.code || '');
    return translate(code);
  }
  return translate('INTERNAL_ERROR');
}
