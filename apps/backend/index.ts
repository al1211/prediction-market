import dotenv from "dotenv"
dotenv.config();
import express, { type Request, type Response } from "express"
import cors from "cors"
import { uuid } from "uuidv4"
import { middleware } from "./middleware";
import { prisma } from "db"

import { CreateOrder, SplitSchema, type OrderBook } from "./types";
import { promise } from "zod";

const app = express();



app.use(express.json());
app.use(cors());


app.post("/order", middleware, async (req: Request, res: Response) => {
    const { success, data } = CreateOrder.safeParse(req.body);
    const userId = req.userId;
    if (!success) {
        res.status(411).json({
            message: "Incorrect inputs"
        })
        return;
    }
    const orignalOrderId = uuid();
    await prisma.$transaction(async tx => {
        const response = await tx.$queryRaw<{ yesOrderbook: string, noOrderbook: string, id: string, totalQty: number }[]>`SELECT * FROM "Market" WHERE id=${data.marketId} FOR UPDATE;`;
        const userResponse = await tx.$queryRaw<{ id: string, address: string, usdBalance: number }[]>`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE`
        const market = response[0];
        const user = userResponse[0];
        if (!user) {
            return;
        }
        if (!market) {
            return;
        }
        const yesOrderbook: OrderBook = JSON.parse(market.yesOrderbook)
        const noOrderbook: OrderBook = JSON.parse(market.noOrderbook)
        if (data.side === "yes" && data.type === "buy") {
            const usd = data.qty * data.price;
            if (user.usdBalance < usd) {
                res.status(403).json({
                    message: "Sorry you don't have enough $ in your account"
                })
                return;
            }
            let leftQty = data.qty;
            const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a) - Number(b))
            await Promise.all(prices.map(async price => {
                if (Number(price) > data.price) {
                    return;
                }
                const { availabelQty, order } = yesOrderbook[price]!;
                await Promise.all(order.map(async order => {
                    const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
                    const reverseOrder = order.reverseOrder;

                    if (!reverseOrder) {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {

                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "yes"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,

                            },
                            data: {
                                useBalance: {
                                    increment: Number(price) * matchedQty
                                }
                            }
                        })
                    } else {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {

                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,

                            },
                            data: {
                                useBalance: {
                                    decrement: (100 - Number(price)) * matchedQty
                                }
                            }
                        })
                    }



                    await prisma.position.update({
                        where: {
                            userId_marketId_type: {

                                userId,
                                marketId: data.marketId,
                                type: "yes"
                            }
                        },
                        data: {
                            qty: {
                                increment: matchedQty
                            }
                        }
                    })
                    await prisma.user.update({
                        where: {
                            id: userId,

                        },
                        data: {
                            useBalance: {
                                decrement: Number(price) * matchedQty
                            }
                        }
                    })
                    leftQty -= matchedQty;


                    order.filledQty += matchedQty
                    yesOrderbook[price]!.availabelQty -= matchedQty;


                })
                )
            }))
            if (leftQty) {
                const oppoitePrice = 100 - data.price;
                if (!noOrderbook[oppoitePrice]) {
                    noOrderbook[oppoitePrice] = { availabelQty: 0, order: [] };
                }

                noOrderbook[oppoitePrice]!.availabelQty += leftQty;
                noOrderbook[oppoitePrice]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true })
            }


        }
        if (data.side === "yes" && data.type === "sell") {
            const buyPrice = 100 - data.price;

            const userPosition = await prisma.position.findFirst({
                where: {
                    userId: userId,
                    marketId: data.marketId,
                    type: "yes",
                }
            });
            if (!userPosition) {
                return;
            }

            if (userPosition.qty < data.qty) {
                return;
            }
            let leftQty = data.qty;
            const prices = Object.keys(yesOrderbook).sort((a: string, b: string) => Number(a) - Number(b))
            await Promise.all(prices.map(async price => {
                if (Number(price) > buyPrice) {
                    return;
                }
                const { availabelQty, order } = yesOrderbook[price]!;
                await Promise.all(order.map(async order => {
                    const matchedQty = order.qty >= leftQty ? leftQty : order.qty;
                    const reverseOrder = order.reverseOrder;

                    if (!reverseOrder) {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {

                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "No"
                                }
                            },
                            data: {
                                qty: {
                                    decrement: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,

                            },
                            data: {
                                useBalance: {
                                    increment: Number(price) * matchedQty
                                }
                            }
                        })
                    } else {
                        await prisma.position.update({
                            where: {
                                userId_marketId_type: {

                                    userId: order.userId,
                                    marketId: data.marketId,
                                    type: "yes"
                                }
                            },
                            data: {
                                qty: {
                                    increment: matchedQty
                                }
                            }
                        })
                        await prisma.user.update({
                            where: {
                                id: order.userId,

                            },
                            data: {
                                useBalance: {
                                    decrement: (100 - Number(price)) * matchedQty
                                }
                            }
                        })
                    }



                    await prisma.position.update({
                        where: {
                            userId_marketId_type: {

                                userId,
                                marketId: data.marketId,
                                type: "yes"
                            }
                        },
                        data: {
                            qty: {
                                decrement: matchedQty
                            }
                        }
                    })
                    await prisma.user.update({
                        where: {
                            id: userId,

                        },
                        data: {
                            useBalance: {
                                increment: Number(price) * matchedQty
                            }
                        }
                    })
                    leftQty -= matchedQty;

                    order.filledQty += matchedQty
                    noOrderbook[price]!.availabelQty -= matchedQty;


                })
                )
            }))
            if (leftQty) {
                const oppoitePrice = 100 - data.price;
                if (!yesOrderbook[data.price]) {
                    yesOrderbook[data.price] = { availabelQty: 0, order: [] };
                }

                yesOrderbook[data.price]!.availabelQty += leftQty;
                yesOrderbook[data.price]!.order.push({ qty: leftQty, userId, filledQty: 0, orignalOrderId, reverseOrder: true })
            }



        }
        // await new Promise(r=>setTimeout(r,3000))
        await tx.market.update({
            data: {
                yesOrderBook: JSON.stringify(yesOrderbook),
                noOrderBook: JSON.stringify(noOrderbook)
            },
            where: {
                id: data.marketId
            }
        })
    }, {
        maxWait: 15000,
        timeout: 20000,
    })


    res.json({
        message: "Hi"
    })

})

app.get("/", async (req: Request, res: Response) => {
    prisma.user.findFirst();
    res.json({
        message: "HI"
    })
})

app.get("/market", async (req: Request, res: Response) => {
    const marketId = req.query.marketId as string;
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
        

    })

})
app.post("/merge", middleware, async (req, res) => {

})
app.get("/balance", middleware, async (req, res) => {

})
app.get("/position", middleware, async (req, res) => {

})
app.post("/history", middleware, async (req, res) => {

})

app.listen(3000, () => {
    console.log("SERVER IS LISTEN on 3000 port")
})