import { useEffect, useState } from "react";
import { useSupabase } from "./useSupabase";

export function useUser() {
  const [claims, setClaims] = useState(null);

  const supabase = useSupabase();

  useEffect(() => {
    const getUserClaims = async () => {
      const { data, error } = await supabase.auth.getClaims();

      if (error) {
        console.log(error.message);
        return;
      }

      setClaims(data?.claims ?? null);
    };

    getUserClaims();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getUserClaims();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return {
    claims,
  };
}