import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentSession } from "@/lib/session.functions";

export function useSession() {
  const fetchSession = useServerFn(getCurrentSession);
  return useQuery({
    queryKey: ["session"],
    queryFn: () => fetchSession(),
    staleTime: 60_000,
    retry: false,
  });
}
