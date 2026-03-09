const normalizeBaseUrl = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const getWebConfig = (): { apiBaseUrl: string } => ({
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
});
