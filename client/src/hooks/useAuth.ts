import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/lib/supabase";

export function useAuth() {
  const { data: user, isLoading } = useQuery<Profile>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
