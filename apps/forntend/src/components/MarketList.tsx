import type { Market, Orderbook } from "../types";

interface MarketListProps {
  markets: Market[];
  onSelectMarket: (marketId: string) => void;
}

function parseOrderbook(value: string | Orderbook): Orderbook {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function bestAsk(orderbook: Orderbook) {
  const prices = Object.keys(orderbook).map(Number).filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : null;
}

function formatCents(price: number | null) {
  return price === null ? "—" : `${price}¢`;
}

function marketPrices(market: Market) {
  const yesOrderbook = parseOrderbook(market.yesOrderbook);
  const noOrderbook = parseOrderbook(market.noOrderbook);

  return {
    yes: bestAsk(yesOrderbook),
    no: bestAsk(noOrderbook),
  };
}

export function MarketList({ markets, onSelectMarket }: MarketListProps) {
  return (
    <section className="market-list">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Markets</span>
          <h2>Trade live prediction markets</h2>
        </div>
        <span className="count-pill">{markets.length} markets</span>
      </div>

      {markets.length === 0 ? (
        <div className="empty-state">No markets available.</div>
      ) : (
        <div className="markets-grid">
          {markets.map((market) => {
            const prices = marketPrices(market);

            return (
              <button key={market.id} className="market-card" onClick={() => onSelectMarket(market.id)}>
                <div className="market-card-top">
                  <span className="market-status">Open</span>
                  <span className="market-liquidity">{market.totalQty.toLocaleString()} shares</span>
                </div>

                <h3>{market.title}</h3>
                <p>{market.description}</p>

                <div className="market-card-actions">
                  <span className="price-chip yes-chip">Yes {formatCents(prices.yes)}</span>
                  <span className="price-chip no-chip">No {formatCents(prices.no)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}