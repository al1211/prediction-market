import dotenv from "dotenv"
dotenv.config();
import express, { type Request, type Response } from "express"
import cors from "cors"
import { uuid } from "uuidv4"
import { middleware } from "./middleware";
import { prisma } from "db"

import { CreateOrder, MergeSchema, SplitSchema, type OrderBook } from "./types";
import { promise } from "zod";

const app = express();



app.use(express.json());
app.use(cors());


app.post("/order", middleware, async (req: Request, res: Response) => {
    const { success, data } = CreateOrder.safeParse(req.body);
    const userId = req.userId;

    if (!success) {
        res.status(411).json({ message: "Incorrect inputs" });
        return;
    }

    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const orignalOrderId = uuid();

    try {
        await prisma.$transaction(async (tx) => {
            // Lock rows FOR UPDATE using the transaction context 'tx'
            const response = await tx.$queryRaw<{ yesOrderbook: string, noOrderbook: string, id: string, totalQty: number }[]>`
                SELECT * FROM "Market" WHERE id=${data.marketId} FOR UPDATE;
            `;
            const userResponse = await tx.$queryRaw<{ id: string, address: string, usdBalance: number }[]>`
                SELECT * FROM "User" WHERE id=${userId} FOR UPDATE;
            `;

            const market = response[0];
            const user = userResponse[0];

            if (!user || !market) {
                throw new Error("User or Market not found");
            }

            const yesOrderbook: OrderBook = JSON.parse(market.yesOrderbook || "{}");
            const noOrderbook: OrderBook = JSON.parse(market.noOrderbook || "{}");

            // ==========================================
            // CASE 1: BUY YES
            // ==========================================
            if (data.side === "yes" && data.type === "buy") {
                const usd = data.qty * data.price;
                if (user.usdBalance < usd) {
                    res.status(403).json({ message: "Sorry you don't have enough $ in your account" });
                    return; 
                }

                let leftQty = data.qty;
                const prices = Object.keys(yesOrderbook).sort((a, b) => Number(a) - Number(b));

                for (const price of prices) {
                    if (Number(price) > data.price || leftQty <= 0) break;
                    const slot = yesOrderbook[price]!;
                    
                    for (const order of slot.order) {
                        if (leftQty <= 0) break;
                        if (order.qty === order.filledQty) continue;

                        const orderLeftQty = order.qty - order.filledQty;
                        const matchedQty = orderLeftQty >= leftQty ? leftQty : orderLeftQty;

                        if (!order.reverseOrder) {
                            await tx.position.update({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "yes" } },
                                data: { qty: { decrement: matchedQty } }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { increment: Number(price) * matchedQty } }
                            });
                        } else {
                            await tx.position.upsert({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "No" } },
                                update: { qty: { increment: matchedQty } },
                                create: { userId: order.userId, marketId: data.marketId, type: "No", qty: matchedQty }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { decrement: (100 - Number(price)) * matchedQty } }
                            });
                        }

                        await tx.position.upsert({
                            where: { userId_marketId_type: { userId, marketId: data.marketId, type: "yes" } },
                            update: { qty: { increment: matchedQty } },
                            create: { userId, marketId: data.marketId, type: "yes", qty: matchedQty }
                        });
                        await tx.user.update({
                            where: { id: userId },
                            data: { usdBalance: { decrement: Number(price) * matchedQty } }
                        });

                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        slot.availabelQty -= matchedQty;
                    }
                    slot.order = slot.order.filter(o => o.qty > o.filledQty);
                    if (slot.order.length === 0) delete yesOrderbook[price];
                }

                if (leftQty > 0) {
                    const oppositePrice = 100 - data.price;
                    if (!noOrderbook[oppositePrice]) noOrderbook[oppositePrice] = { availabelQty: 0, order: [] };
                    noOrderbook[oppositePrice]!.availabelQty += leftQty;
                    noOrderbook[oppositePrice]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true });
                }
            }

            // ==========================================
            // CASE 2: SELL YES
            // ==========================================
             if (data.side === "yes" && data.type === "sell") {
                const buyPrice = 100 - data.price;
                const userPosition = await tx.position.findUnique({
                    where: { userId_marketId_type: { userId, marketId: data.marketId, type: "yes" } }
                });

                if (!userPosition || userPosition.qty < data.qty) {
                    res.status(400).json({ message: "Insufficient position quantity to sell" });
                    return;
                }

                let leftQty = data.qty;
                const prices = Object.keys(yesOrderbook).sort((a, b) => Number(a) - Number(b));

                for (const price of prices) {
                    if (Number(price) > buyPrice || leftQty <= 0) break;
                    const slot = yesOrderbook[price]!;

                    for (const order of slot.order) {
                        if (leftQty <= 0) break;
                        if (order.qty === order.filledQty) continue;

                        const orderLeftQty = order.qty - order.filledQty;
                        const matchedQty = orderLeftQty >= leftQty ? leftQty : orderLeftQty;

                        if (!order.reverseOrder) {
                            await tx.position.update({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "No" } },
                                data: { qty: { decrement: matchedQty } }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { increment: Number(price) * matchedQty } }
                            });
                        } else {
                            await tx.position.upsert({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "yes" } },
                                update: { qty: { increment: matchedQty } },
                                create: { userId: order.userId, marketId: data.marketId, type: "yes", qty: matchedQty }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { decrement: (100 - Number(price)) * matchedQty } }
                            });
                        }

                        await tx.position.update({
                            where: { userId_marketId_type: { userId, marketId: data.marketId, type: "yes" } },
                            data: { qty: { decrement: matchedQty } }
                        });
                        await tx.user.update({
                            where: { id: userId },
                            data: { usdBalance: { increment: Number(price) * matchedQty } }
                        });

                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        slot.availabelQty -= matchedQty;
                    }
                    slot.order = slot.order.filter(o => o.qty > o.filledQty);
                    if (slot.order.length === 0) delete yesOrderbook[price];
                }

                if (leftQty > 0) {
                    if (!yesOrderbook[data.price]) yesOrderbook[data.price] = { availabelQty: 0, order: [] };
                    yesOrderbook[data.price]!.availabelQty += leftQty;
                    yesOrderbook[data.price]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true });
                }
            }

            // ==========================================
            // CASE 3: BUY NO
            // ==========================================
             if (data.side === "no" && data.type === "buy") {
                const usd = data.qty * data.price;
                if (user.usdBalance < usd) {
                    res.status(403).json({ message: "Sorry you don't have enough $ in your account" });
                    return;
                }

                let leftQty = data.qty;
                // Sort ascending to pull cheapest NO contracts available
                const prices = Object.keys(noOrderbook).sort((a, b) => Number(a) - Number(b));

                for (const price of prices) {
                    if (Number(price) > data.price || leftQty <= 0) break;
                    const slot = noOrderbook[price]!;

                    for (const order of slot.order) {
                        if (leftQty <= 0) break;
                        if (order.qty === order.filledQty) continue;

                        const orderLeftQty = order.qty - order.filledQty;
                        const matchedQty = orderLeftQty >= leftQty ? leftQty : orderLeftQty;

                        if (!order.reverseOrder) {
                            // Opposite user is selling "NO" they own
                            await tx.position.update({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "No" } },
                                data: { qty: { decrement: matchedQty } }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { increment: Number(price) * matchedQty } }
                            });
                        } else {
                            // Opposite user is selling "YES"
                            await tx.position.upsert({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "yes" } },
                                update: { qty: { increment: matchedQty } },
                                create: { userId: order.userId, marketId: data.marketId, type: "yes", qty: matchedQty }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { decrement: (100 - Number(price)) * matchedQty } }
                            });
                        }

                        // Credit current user with NO position and charge them
                        await tx.position.upsert({
                            where: { userId_marketId_type: { userId, marketId: data.marketId, type: "No" } },
                            update: { qty: { increment: matchedQty } },
                            create: { userId, marketId: data.marketId, type: "No", qty: matchedQty }
                        });
                        await tx.user.update({
                            where: { id: userId },
                            data: { usdBalance: { decrement: Number(price) * matchedQty } }
                        });

                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        slot.availabelQty -= matchedQty;
                    }
                    slot.order = slot.order.filter(o => o.qty > o.filledQty);
                    if (slot.order.length === 0) delete noOrderbook[price];
                }

                // Remaining goes to YES orderbook as a limit order at opposite price
                if (leftQty > 0) {
                    const oppositePrice = 100 - data.price;
                    if (!yesOrderbook[oppositePrice]) yesOrderbook[oppositePrice] = { availabelQty: 0, order: [] };
                    yesOrderbook[oppositePrice]!.availabelQty += leftQty;
                    yesOrderbook[oppositePrice]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true });
                }
            }

            // ==========================================
            // CASE 4: SELL NO
            // ==========================================
            if (data.side === "no" && data.type === "sell") {
                const buyPrice = 100 - data.price;
                const userPosition = await tx.position.findUnique({
                    where: { userId_marketId_type: { userId, marketId: data.marketId, type: "No" } }
                });

                if (!userPosition || userPosition.qty < data.qty) {
                    res.status(400).json({ message: "Insufficient position quantity to sell" });
                    return;
                }

                let leftQty = data.qty;
                const prices = Object.keys(noOrderbook).sort((a, b) => Number(a) - Number(b));

                for (const price of prices) {
                    if (Number(price) > buyPrice || leftQty <= 0) break;
                    const slot = noOrderbook[price]!;

                    for (const order of slot.order) {
                        if (leftQty <= 0) break;
                        if (order.qty === order.filledQty) continue;

                        const orderLeftQty = order.qty - order.filledQty;
                        const matchedQty = orderLeftQty >= leftQty ? leftQty : orderLeftQty;

                        if (!order.reverseOrder) {
                            await tx.position.update({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "yes" } },
                                data: { qty: { decrement: matchedQty } }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { increment: Number(price) * matchedQty } }
                            });
                        } else {
                            await tx.position.upsert({
                                where: { userId_marketId_type: { userId: order.userId, marketId: data.marketId, type: "No" } },
                                update: { qty: { increment: matchedQty } },
                                create: { userId: order.userId, marketId: data.marketId, type: "No", qty: matchedQty }
                            });
                            await tx.user.update({
                                where: { id: order.userId },
                                data: { usdBalance: { decrement: (100 - Number(price)) * matchedQty } }
                            });
                        }

                        // Deduct NO position from seller and credit their balance
                        await tx.position.update({
                            where: { userId_marketId_type: { userId, marketId: data.marketId, type: "No" } },
                            data: { qty: { decrement: matchedQty } }
                        });
                        await tx.user.update({
                            where: { id: userId },
                            data: { usdBalance: { increment: Number(price) * matchedQty } }
                        });

                        leftQty -= matchedQty;
                        order.filledQty += matchedQty;
                        slot.availabelQty -= matchedQty;
                    }
                    slot.order = slot.order.filter(o => o.qty > o.filledQty);
                    if (slot.order.length === 0) delete noOrderbook[price];
                }

                // If unfulfilled, place remaining as a sell limit order on NO orderbook
                if (leftQty > 0) {
                    if (!noOrderbook[data.price]) noOrderbook[data.price] = { availabelQty: 0, order: [] };
                    noOrderbook[data.price]!.availabelQty += leftQty;
                    noOrderbook[data.price]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true });
                }
            }



            await prisma.orderHistory.create({
                data:{
                    id:orignalOrderId,
                    orderType:data.type==="buy"?"Buy":"Sell",
                    userId,
                    price:data.price,
                    qty:data.qty,
                    marketId:data.marketId
                }
            })

            // Save the updated matching trees back into the DB
            await tx.market.update({
                where: { id: data.marketId },
                data: {
                    yesOrderbook: JSON.stringify(yesOrderbook),
                    noOrderbook: JSON.stringify(noOrderbook)
                }
            });
        }, {
            maxWait: 15000,
            timeout: 20000,
        });

        res.json({ message: "Order processed successfully", orderId: orignalOrderId });

    } catch (error: any) {
        console.error("Order Transaction Failed:", error);
        res.status(500).json({ message: "Internal server error processing order", error: error.message });
    }
});
// app.post("/order", middleware, async (req: Request, res: Response) => {
//     const { success, data } = CreateOrder.safeParse(req.body);
//     const userId = req.userId;
//     if (!success) {
//         res.status(411).json({
//             message: "Incorrect inputs"
//         })
//         return;
//     }
//     const orignalOrderId = uuid();
//     await prisma.$transaction(async tx => {
//         const response = await tx.$queryRaw<{ yesOrderbook: string, noOrderbook: string, id: string, totalQty: number }[]>`SELECT * FROM "Market" WHERE id=${data.marketId} FOR UPDATE;`;
//         const userResponse = await tx.$queryRaw<{ id: string, address: string, usdBalance: number }[]>`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE`
//         const market = response[0];
//         const user = userResponse[0];
//         if (!user) {
//             return;
//         }
//         if (!market) {
//             return;
//         }
//         const yesOrderbook: OrderBook = JSON.parse(market.yesOrderbook)
//         const noOrderbook: OrderBook = JSON.parse(market.noOrderbook)
//         if (data.side === "yes" && data.type === "buy") {
//             const usd = data.qty * data.price;
//             if (user.usdBalance < usd) {
//                 res.status(403).json({
//                     message: "Sorry you don't have enough $ in your account"
//                 })
//                 return;
//             }
//             let leftQty = data.qty;
//             const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a) - Number(b))
//             await Promise.all(prices.map(async price => {
//                 if (Number(price) > data.price) {
//                     return;
//                 }
//                 const { availabelQty, order } = yesOrderbook[price]!;
//                 await Promise.all(order.map(async order => {
//                     const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
//                     const reverseOrder = order.reverseOrder;

//                     if (!reverseOrder) {
//                         await prisma.position.update({
//                             where: {
//                                 userId_marketId_type: {

//                                     userId: order.userId,
//                                     marketId: data.marketId,
//                                     type: "yes"
//                                 }
//                             },
//                             data: {
//                                 qty: {
//                                     decrement: matchedQty
//                                 }
//                             }
//                         })
//                         await prisma.user.update({
//                             where: {
//                                 id: order.userId,

//                             },
//                             data: {
//                                 useBalance: {
//                                     increment: Number(price) * matchedQty
//                                 }
//                             }
//                         })
//                     } else {
//                         await prisma.position.update({
//                             where: {
//                                 userId_marketId_type: {

//                                     userId: order.userId,
//                                     marketId: data.marketId,
//                                     type: "No"
//                                 }
//                             },
//                             data: {
//                                 qty: {
//                                     increment: matchedQty
//                                 }
//                             }
//                         })
//                         await prisma.user.update({
//                             where: {
//                                 id: order.userId,

//                             },
//                             data: {
//                                 useBalance: {
//                                     decrement: (100 - Number(price)) * matchedQty
//                                 }
//                             }
//                         })
//                     }



//                     await prisma.position.update({
//                         where: {
//                             userId_marketId_type: {

//                                 userId,
//                                 marketId: data.marketId,
//                                 type: "yes"
//                             }
//                         },
//                         data: {
//                             qty: {
//                                 increment: matchedQty
//                             }
//                         }
//                     })
//                     await prisma.user.update({
//                         where: {
//                             id: userId,

//                         },
//                         data: {
//                             useBalance: {
//                                 decrement: Number(price) * matchedQty
//                             }
//                         }
//                     })
//                     leftQty -= matchedQty;


//                     order.filledQty += matchedQty
//                     yesOrderbook[price]!.availabelQty -= matchedQty;


//                 })
//                 )
//             }))
//             if (leftQty) {
//                 const oppoitePrice = 100 - data.price;
//                 if (!noOrderbook[oppoitePrice]) {
//                     noOrderbook[oppoitePrice] = { availabelQty: 0, order: [] };
//                 }

//                 noOrderbook[oppoitePrice]!.availabelQty += leftQty;
//                 noOrderbook[oppoitePrice]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true })
//             }


//         }
//         if (data.side === "yes" && data.type === "sell") {
//             const buyPrice = 100 - data.price;

//             const userPosition = await prisma.position.findFirst({
//                 where: {
//                     userId: userId,
//                     marketId: data.marketId,
//                     type: "yes",
//                 }
//             });
//             if (!userPosition) {
//                 return;
//             }

//             if (userPosition.qty < data.qty) {
//                 return;
//             }
//             let leftQty = data.qty;
//             const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a) - Number(b))
//             await Promise.all(prices.map(async price => {
//                 if (Number(price) > buyPrice) {
//                     return;
//                 }
//                 const { availabelQty, order } = yesOrderbook[price]!;
//                 await Promise.all(order.map(async order => {
//                     const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
//                     const reverseOrder = order.reverseOrder;

//                     if (!reverseOrder) {
//                         await prisma.position.update({
//                             where: {
//                                 userId_marketId_type: {

//                                     userId: order.userId,
//                                     marketId: data.marketId,
//                                     type: "No"
//                                 }
//                             },
//                             data: {
//                                 qty: {
//                                     decrement: matchedQty
//                                 }
//                             }
//                         })
//                         await prisma.user.update({
//                             where: {
//                                 id: order.userId,

//                             },
//                             data: {
//                                 useBalance: {
//                                     increment: Number(price) * matchedQty
//                                 }
//                             }
//                         })
//                     } else {
//                         await prisma.position.update({
//                             where: {
//                                 userId_marketId_type: {

//                                     userId: order.userId,
//                                     marketId: data.marketId,
//                                     type: "yes"
//                                 }
//                             },
//                             data: {
//                                 qty: {
//                                     increment: matchedQty
//                                 }
//                             }
//                         })
//                         await prisma.user.update({
//                             where: {
//                                 id: order.userId,

//                             },
//                             data: {
//                                 useBalance: {
//                                     decrement: (100 - Number(price)) * matchedQty
//                                 }
//                             }
//                         })
//                     }



//                     await prisma.position.update({
//                         where: {
//                             userId_marketId_type: {

//                                 userId,
//                                 marketId: data.marketId,
//                                 type: "yes"
//                             }
//                         },
//                         data: {
//                             qty: {
//                                 decrement: matchedQty
//                             }
//                         }
//                     })
//                     await prisma.user.update({
//                         where: {
//                             id: userId,

//                         },
//                         data: {
//                             useBalance: {
//                                 increment: Number(price) * matchedQty
//                             }
//                         }
//                     })
//                     leftQty -= matchedQty;

//                     order.filledQty += matchedQty
//                     noOrderbook[price]!.availabelQty -= matchedQty;


//                 })
//                 )
//             }))
//             if (leftQty) {
//                 const oppoitePrice = 100 - data.price;
//                 if (!yesOrderbook[data.price]) {
//                     yesOrderbook[data.price] = { availabelQty: 0, order: [] };
//                 }

//                 yesOrderbook[data.price]!.availabelQty += leftQty;
//                 yesOrderbook[data.price]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true })
//             }



//         }
//         // await new Promise(r=>setTimeout(r,3000))
//         await tx.market.update({
//             data: {
//                 yesOrderBook: JSON.stringify(yesOrderbook),
//                 noOrderBook: JSON.stringify(noOrderbook)
//             },
//             where: {
//                 id: data.marketId
//             }
//         })
//     }, {
//         maxWait: 15000,
//         timeout: 20000,
//     })


//     res.json({
//         message: "Hi"
//     })

// })

app.get("/", async (req: Request, res: Response) => {
    prisma.user.findFirst();
    res.json({
        message: "HI"
    })
})

app.get("/market", async (req: Request, res: Response) => {
    const market = await prisma.market.findFirst({

        where: {
            id: req.query.marketId as string
        }
    })
    res.json({ market })
})


app.post("/split", middleware, async (req: Request, res: Response) => {
    const { data, success } = SplitSchema.safeParse(req.body);
    const userId: string = req.userId;

    if (!success) {
        res.status(411).json({
            message: "Incorrect Input"
        })
        return
    }
    const marketId = data?.marketId;
    await prisma.$transaction(async tx => {
        const userResponse = await tx.$queryRaw<{ id: string, address: string, usdBalance: number }[]>`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE`
        const user = userResponse[0]
        if (!user) {
            throw new Error("User not found")
        }
        if (user.usdBalance < data.amount) {
            res.status(403).json({
                message: "Sorry you are not allowed to do this"
            })
            return
        }

        await tx.user.update({
            where: {
                id: userId
            },
            data: {
                useBalance: {
                    decrement: data.amount
                }
            }
        })

        await tx.position.upsert({
            where: {
                userId_marketId_type: {

                    marketId,
                    userId,
                    type: "yes"
                }
            },
            create: {
                marketId,
                userId,
                type: "yes",
                qty: data.amount

            },
            update: {
                qty: {
                    increment: data.amount
                }
            }
        })
         await tx.position.upsert({
            where: {
                userId_marketId_type: {

                    marketId,
                    userId,
                    type: "No"
                }
            },
            create: {
                marketId,
                userId,
                type: "No",
                qty: data.amount

            },
            update: {
                qty: {
                    increment: data.amount
                }
            }
        })

         await prisma.orderHistory.create({
                data:{
                    
                    orderType:"Split",
                    userId,
                    price:0,
                    qty:data.amount,
                    marketId:data.marketId
                }
            })
        

    })

})

app.post("/merge", middleware, async (req: Request, res: Response) => {
    const { data, success } = MergeSchema.safeParse(req.body);
    const userId: string = req.userId;

    if (!success) {
        res.status(411).json({
            message: "Incorrect Input"
        });
        return;
    }

    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    const marketId = data.marketId;
    const mergeAmount = data.amount;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Fetch user's current positions for both YES and NO options
            const yesPosition = await tx.position.findUnique({
                where: {
                    userId_marketId_type: {
                        userId,
                        marketId,
                        type: "yes"
                    }
                }
            });

            const noPosition = await tx.position.findUnique({
                where: {
                    userId_marketId_type: {
                        userId,
                        marketId,
                        type: "No" // Keeping casing consistent with your schema ("No")
                    }
                }
            });

            // 2. Validate that the user owns enough of BOTH positions to merge
            if (!yesPosition || yesPosition.qty < mergeAmount || !noPosition || noPosition.qty < mergeAmount) {
                res.status(400).json({
                    message: "Insufficient YES or NO positions to merge"
                });
                return;
            }

            // 3. Deduct the positions from the user's portfolio
            await tx.position.update({
                where: {
                    userId_marketId_type: {
                        userId,
                        marketId,
                        type: "yes"
                    }
                },
                data: {
                    qty: {
                        decrement: mergeAmount
                    }
                }
            });

            await tx.position.update({
                where: {
                    userId_marketId_type: {
                        userId,
                        marketId,
                        type: "No"
                    }
                },
                data: {
                    qty: {
                        decrement: mergeAmount
                    }
                }
            });

            // 4. Refund the USD balance (1 YES + 1 NO = $1 USD, assuming 1 unit matches 1 USD value)
            await tx.user.update({
                where: {
                    id: userId
                },
                data: {
                    usdBalance: { // Fixed typo from 'useBalance' to 'usdBalance'
                        increment: mergeAmount
                    }
                }
            });
             await prisma.orderHistory.create({
                data:{
                    
                    orderType:"Merge",
                    userId,
                    price:0,
                    qty:data.amount,
                    marketId:data.marketId
                }
            })
        });

        res.json({
            message: "Successfully merged positions back to USD balance",
            amount: mergeAmount
        });

    } catch (error: any) {
        console.error("Merge Transaction Error:", error);
        res.status(500).json({
            message: "Internal server error during merge processing",
            error: error.message
        });
    }
});

app.get("/balance", middleware, async (req, res) => {

    const userId=req.userId as string;
    const user=await prisma.user.findFirst({
        where:{
            id:userId
        }
    })
    res.json({
        balance:user?.useBalance
    })
})
app.get("/position", middleware, async (req, res) => {
 const userId=req.userId as string;
    const position=await prisma.position.findMany({
        where:{
            id:userId
        }
    })
    res.json({
        position
    })
})
app.post("/history", middleware, async (req, res) => {
 const userId=req.userId as string;
    const history=await prisma.orderHistory.findMany({
        where:{
            id:userId
        }
    })
    res.json({
       history
    })
})

app.listen(3000, () => {
    console.log("SERVER IS LISTEN on 3000 port")
})