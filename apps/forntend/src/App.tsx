import axios from 'axios';
import './App.css'
import { useSupabase } from './hooks/useSupabase';
import { useUser } from './hooks/useUser'

function App() {
 const {claims}=useUser();
 const supabase=useSupabase();


  return (
    <>
      <div>
       {!claims &&<button
       onClick={async()=>{
       await supabase.auth.signInWithWeb3({
          chain:"solana",
          statement:"I confirm I want to sign in to prediction market v2",
          // wallet:window.solfare
        })
       }}
       >Sign with Solana</button>}
       {/* {window.solana && !claims &&<button
       onClick={async()=>{
       await supabase.auth.signInWithWeb3({
          chain:"solana",
          statement:"I confirm I want to sign in to prediction market v2",
          wallet:window.phantom
        })
       }}
       >Sign with Solana</button>} */}
       {claims &&<button
       onClick={async()=>{
        await supabase.auth.signOut()
       }}
       >Logout</button>}
      </div>
      <button onClick={async()=>{
        
        await supabase.auth.getSession().then(r=>{
          console.log(r.data.session?.access_token)
           axios.post("http://localhost:3000/buy",
          {},{
            headers:{
              Authorization:r.data.session?.access_token
            }
          })
        })
      }} >Click here to buy</button>
    </>
  )
}

export default App
