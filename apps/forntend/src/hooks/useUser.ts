import { SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react";


export function useUser(supabase: SupabaseClient) {
    const [claims, setClaims] = useState<any>(null);

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            supabase.auth.getClaims().then(({ data }) => {
                setClaims(data?.claims || null)
            }).catch(e => console.log(e));
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    return {
        claims
    }

}