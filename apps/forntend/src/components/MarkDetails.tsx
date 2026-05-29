import type { Market, Orderbook } from "../types";

interface MarketDetailProps {
  market: Market;
  onBack: () => void;
}

interface Level {
  price: number;
  availableQty: number;
  total: number;
}

function parseOrderbook(value: string | Orderbook): Orderbook {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function formatPrice(price: number) {
  return `$${(price / 100).toFixed(2)}`;
}

function formatCents(price: number | null) {
  return price === null ? "—" : `${price}¢`;
}

function formatTotal(total: number) {
  return `$${total.toFixed(2)}`;
}

function toLevels(orderbook: Orderbook, getPrice: (price: number) => number): Level[] {
  return Object.entries(orderbook).map(([price, data]) => {
    const displayPrice = getPrice(Number(price));
    return {
      price: displayPrice,
      availableQty: data.availableQty,
      total: (displayPrice / 100) * data.availableQty,
    };
  });
}

function bestBid(levels: Level[]) {
  return levels.length ? Math.max(...levels.map((level) => level.price)) : null;
}

function bestAsk(levels: Level[]) {
  return levels.length ? Math.min(...levels.map((level) => level.price)) : null;
}

function OrderbookCard({ title, bids, asks }: { title: string; bids: Level[]; asks: Level[] }) {
  const bid = bestBid(bids);
  const ask = bestAsk(asks);
  const spread = bid !== null && ask !== null ? ask - bid : null;
  const asksForDisplay = [...asks].sort((a, b) => b.price - a.price);
  const bidsForDisplay = [...bids].sort((a, b) => b.price - a.price);

  return (
    <section className="book-card">
      <div className="book-card-header">
        <div>
          <h3>{title}</h3>
          <p>{formatCents(bid)} bid · {formatCents(ask)} ask</p>
        </div>
        <span className="spread-pill">Spread {spread !== null ? `${spread}¢` : "—"}</span>
      </div>

      <div className="book-table">
        <div className="book-row book-head">
          <span>Price</span>
          <span>Shares</span>
          <span>Total</span>
        </div>

        <div className="book-side-label ask-label">Asks</div>
        {asksForDisplay.length === 0 ? (
          <div className="empty-book-row">No asks</div>
        ) : (
          asksForDisplay.map((level) => (
            <div className="book-row ask-row" key={`ask-${level.price}`}>
              <span>{formatPrice(level.price)}</span>
              <span>{level.availableQty.toLocaleString()}</span>
              <span>{formatTotal(level.total)}</span>
            </div>
          ))
        )}

        <div className="spread-row">
          <span>Spread</span>
          <strong>{spread !== null ? `${spread}¢` : "—"}</strong>
        </div>

        <div className="book-side-label bid-label">Bids</div>
        {bidsForDisplay.length === 0 ? (
          <div className="empty-book-row">No bids</div>
        ) : (
          bidsForDisplay.map((level) => (
            <div className="book-row bid-row" key={`bid-${level.price}`}>
              <span>{formatPrice(level.price)}</span>
              <span>{level.availableQty.toLocaleString()}</span>
              <span>{formatTotal(level.total)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function MarketDetail({ market, onBack }: MarketDetailProps) {
  const yesOrderbook = parseOrderbook(market.yesOrderbook);
  const noOrderbook = parseOrderbook(market.noOrderbook);

  const yesAsks = toLevels(yesOrderbook, (price) => price);
  const noAsks = toLevels(noOrderbook, (price) => price);
  const yesBids = toLevels(noOrderbook, (price) => 100 - price);
  const noBids = toLevels(yesOrderbook, (price) => 100 - price);
  const yesBid = bestBid(yesBids);
  const yesAsk = bestAsk(yesAsks);
  const noBid = bestBid(noBids);
  const noAsk = bestAsk(noAsks);

  return (
    <div className="market-detail">
      <button onClick={onBack} className="back-button">← All markets</button>

      <section className="market-hero">
        <div className="market-hero-copy">
          <span className="eyebrow">Prediction market</span>
          <h2>{market.title}</h2>
          <p>{market.description}</p>
        </div>

        <div className="outcome-cards">
          <div className="outcome-card yes-outcome">
            <span>Yes</span>
            <strong>{formatCents(yesAsk)}</strong>
            <small>Best ask · Bid {formatCents(yesBid)}</small>
          </div>
          <div className="outcome-card no-outcome">
            <span>No</span>
            <strong>{formatCents(noAsk)}</strong>
            <small>Best ask · Bid {formatCents(noBid)}</small>
          </div>
        </div>
      </section>

      <div className="market-meta-row">
        <div>
          <span>Liquidity</span>
          <strong>{market.totalQty.toLocaleString()} shares</strong>
        </div>
        <div>
          <span>Yes spread</span>
          <strong>{yesBid !== null && yesAsk !== null ? `${yesAsk - yesBid}¢` : "—"}</strong>
        </div>
        <div>
          <span>No spread</span>
          <strong>{noBid !== null && noAsk !== null ? `${noAsk - noBid}¢` : "—"}</strong>
        </div>
      </div>

      <section className="resolution-card">
        <span>Resolution criteria</span>
        <p>{market.resolutionDescription}</p>
      </section>

      <div className="orderbooks-container">
        <OrderbookCard title="Yes orderbook" bids={yesBids} asks={yesAsks} />
        <OrderbookCard title="No orderbook" bids={noBids} asks={noAsks} />
      </div>
    </div>
  );
}