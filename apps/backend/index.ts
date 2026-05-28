import express from "express"
import cors from "cors"
import { middleware } from "./middleware";

const app=express();



app.use(express.json());
app.use(cors());


app.post("/buy",middleware,async(req,res)=>{
    res.json({message:"HI"})

})

app.post("/sell",middleware,async(req , res)=>{

})
app.post("/split",middleware,async(req , res)=>{
    
})
app.post("/merge",middleware,async(req , res)=>{
    
})
app.get("/balance",middleware,async(req , res)=>{
    
})
app.get("/position",middleware,async(req , res)=>{
    
})
app.post("/history",middleware,async(req , res)=>{
    
})

app.listen(3000,()=>{
    console.log("SERVER IS LISTEN on 3000 port")
})