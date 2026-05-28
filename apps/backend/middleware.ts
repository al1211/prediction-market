import type { NextFunction, Request, Response } from "express";
import {createClient} from "@supabase/supabase-js"


const supabase=createClient("https://bmoimxwajimlcrstoebw.supabase.co",process.env.SUPABASE_SECRET_KEY!);

export async function middleware(req:Request,res:Response,next:NextFunction){
    const token=req.headers.authorization;
    try{
 const {data:{user},error}=await supabase.auth.getUser(token);
 const address=user?.user_metadata.custom_claims.address;
 if(address){
    req.userID=address;
    next();
 }else{
    res.status(403).json({
        message:"Incorrect credientals  "
    })
 }
  
    }catch(err){
        console.log(err)
    }
  




}