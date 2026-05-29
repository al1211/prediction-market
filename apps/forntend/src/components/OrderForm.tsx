import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Market, Orderbook } from "../types";

interface OrderFormProps {
  market: Market;
  token: string;
  onOrderPlaced: () => void;
}

function parseOrderbook(value: string | Orderbook): Orderbook {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function prices(orderbook: Orderbook) {
  return Object.keys(orderbook).map(Number).filter(Number.isFinite);
}

function min(values: number[]) {
  return values.length ? Math.min(...values) : null;
}

function max(values: number[]) {
  return values.length ? Math.max(...values) : null;
}

function formatPrice(price: number | null) {
  return price === null ? "—" : `$${(price / 100).toFixed(2)}`;
}

export function OrderForm({ market, token, onOrderPlaced }: OrderFormProps) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState<string>("0.50");
  const [qty, setQty] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const bestPrices = useMemo(() => {
    const yesOrderbook = parseOrderbook(market.yesOrderbook);
    const noOrderbook = parseOrderbook(market.noOrderbook);
    const yesAskPrices = prices(yesOrderbook);
    const noAskPrices = prices(noOrderbook);
    const yesBids = noAskPrices.map((value) => 100 - value);
    const noBids = yesAskPrices.map((value) => 100 - value);

    return {
      yesAsk: min(yesAskPrices),
      yesBid: max(yesBids),
      noAsk: min(noAskPrices),
      noBid: max(noBids),
    };
  }, [market]);

  const suggestedPrice = useMemo(() => {
    if (side === "yes" && type === "buy") return bestPrices.yesAsk;
    if (side === "yes" && type === "sell") return bestPrices.yesBid;
    if (side === "no" && type === "buy") return bestPrices.noAsk;
    return bestPrices.noBid;
  }, [bestPrices, side, type]);

  useEffect(() => {
    if (suggestedPrice !== null) {
      setPrice((suggestedPrice / 100).toFixed(2));
    }
  }, [suggestedPrice]);

  const priceCents = Math.round(Number(price) * 100);
  const quantity = Math.max(0, Math.floor(Number(qty) || 0));
  const total = (priceCents * quantity) / 100;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!Number.isFinite(priceCents) || priceCents < 1 || priceCents > 99 || quantity < 1) {
      setError("Enter a valid price and quantity.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          marketId: market.id,
          side,
          type,
          price: priceCents,
          qty: quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Order failed");
      }

      setSuccess("Order placed successfully.");
      onOrderPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="trade-card order-form">
      <div className="trade-card-header">
        <div>
          <span>Trade</span>
          <h3>{market.title}</h3>
        </div>
        <span>{type === "buy" ? "Buy" : "Sell"} {side.toUpperCase()}</span>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="segmented-control">
          <button type="button" className={type === "buy" ? "active" : ""} onClick={() => setType("buy")}>Buy</button>
          <button type="button" className={type === "sell" ? "active" : ""} onClick={() => setType("sell")}>Sell</button>
        </div>

        <div className="outcome-toggle">
          <button type="button" className={side === "yes" ? "active yes-active" : ""} onClick={() => setSide("yes")}>Yes</button>
          <button type="button" className={side === "no" ? "active no-active" : ""} onClick={() => setSide("no")}>No</button>
        </div>

        <div className="form-group">
          <label>Limit price</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="0.99"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Quantity</label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </div>

        <div className="trade-summary">
          <div>
            <span>Suggested</span>
            <strong>{formatPrice(suggestedPrice)}</strong>
          </div>
          <div>
            <span>Order value</span>
            <strong>${total.toFixed(2)}</strong>
          </div>
        </div>

        <button className="primary-action" type="submit" disabled={loading || !token}>
          {loading ? "Processing..." : `${type === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}`}
        </button>
      </form>
    </section>
  );
}