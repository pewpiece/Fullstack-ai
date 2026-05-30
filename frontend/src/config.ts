const envUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_URL = envUrl?.trim() || 'http://localhost:8000/api';