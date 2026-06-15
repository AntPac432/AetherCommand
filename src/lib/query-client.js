import { QueryClient } from '@tanstack/react-query';
export const queryClientInstance = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10000 } } });
