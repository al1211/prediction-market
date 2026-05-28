
import { createClient } from '@supabase/supabase-js'
import {  useState } from 'react';


export function useSupabase(){
    const [supabase,setSupabse]=useState(createClient("https://bmoimxwajimlcrstoebw.supabase.co","sb_publishable_5DbEEycmKjiwluGNhGRAIw_63cpsCzq"));
    return supabase


}