import z from 'zod'

export const CreateOrder=z.object({
    marketId:z.string(),
    side:z.enum(["yes","no"]),
    type:z.enum(["buy","sell"]),
    price:z.int(),
    qty:z.int(),
    
})

export type OrderBook={[key:string]:{
    availabelQty:number,
    order:{userId:string,qty:number,filledQty:number,orignalOrderId:string,reverseOrder:boolean}[],

}}