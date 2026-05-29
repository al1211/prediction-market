export interface Market {
  id: string;
  title: string;
  description: string;
  resolutionDescription: string;
  yesOrderbook: string | Orderbook;
  noOrderbook: string | Orderbook;
  totalQty: number;
}

export interface Orderbook {
  [key: string]: {
    availableQty: number;
    orders: {
      userId: string;
      qty: number;
      filledQty: number;
      originalOrderId: string;
      reverseOrder: boolean;
    }[];
  };
}

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  type: "Yes" | "No";
  qty: number;
}

export interface OrderHistory {
  id: string;
  orderType: "Buy" | "Sell" | "Split" | "Merge";
  userId: string;
  price: number;
  qty: number;
  marketId: string;
  createdAt?: Date;
}

export interface User {
  id: string;
  address: string;
  usdBalance: number;
}