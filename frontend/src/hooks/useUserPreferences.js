import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUserPreferences, saveUserPreferences } from '@/lib/api';

export const defaultUserPreferences = {
  theme: 'dark',
  accent: 'violet',
  language: 'en',
  taskView: 'list',
  sortBy: 'createdAt',
  sortDirection: 'desc',
};

export const useUserPreferences = (userId) => {
  const queryClient = useQueryClient();
  const queryKey = ['userPreferences', userId];
  const query = useQuery({
    queryKey,
    queryFn: async () => (await fetchUserPreferences()).data.preferences,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (preferences) => (await saveUserPreferences(preferences)).data.preferences,
    onMutate: async (nextPreferences) => {
      await queryClient.cancelQueries({ queryKey });
      const previousPreferences = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (currentPreferences) => ({
        ...defaultUserPreferences,
        ...currentPreferences,
        ...nextPreferences,
      }));
      return { previousPreferences };
    },
    onError: (_error, _nextPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(queryKey, context.previousPreferences);
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(queryKey, preferences);
    },
  });

  return {
    preferences: {
      ...defaultUserPreferences,
      ...query.data,
      theme: query.data?.theme === 'light' ? 'light' : 'dark',
      accent: ['violet', 'rose', 'emerald', 'amber'].includes(query.data?.accent) ? query.data.accent : 'violet',
      sortBy: ['title', 'createdAt'].includes(query.data?.sortBy) ? query.data.sortBy : 'createdAt',
    },
    hasLoadedPreferences: query.isSuccess,
    isSavingPreferences: mutation.isPending,
    preferencesError: query.error || mutation.error,
    savePreferences: mutation.mutateAsync,
  };
};
