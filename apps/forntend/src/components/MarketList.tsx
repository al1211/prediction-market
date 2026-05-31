import type { Market, Orderbook } from "../types";

interface MarketListProps {
  markets: Market[];
  onSelectMarket: (marketId: string) => void;
}

/**
 * Safely parses the orderbook. The backend sends orderbooks as either 
 * a pre-parsed object or a raw JSON string.
 */
function parseOrderbook(value: string | Orderbook | undefined | null): Orderbook {
  if (!value) return {};
  if (typeof value === "object") return value;
  
  try {
    // Handles case where backend might send standard JSON strings
    return JSON.parse(value) as Orderbook;
  } catch (error) {
    console.error("Failed to parse orderbook string:", error);
    return {};
  }
}

/**
 * Finds the best (lowest) available ask price in the order book.
 */
function bestAsk(orderbook: Orderbook): number | null {
  const prices = Object.keys(orderbook)
    .map(Number)
    .filter((price) => !isNaN(price) && isFinite(price));

  return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * Formats numeric prices into customer-facing cent displays.
 */
function formatCents(price: number | null): string {
  return price === null ? "—" : `${price}¢`;
}

/**
 * Extracts the Yes and No pricing data from a given market object.
 */
function getMarketPrices(market: Market) {
  const yesOrderbook = parseOrderbook(market.yesOrderbook);
  const noOrderbook = parseOrderbook(market.noOrderbook);

  return {
    yes: bestAsk(yesOrderbook),
    no: bestAsk(noOrderbook),
  };
}

export function MarketList({ markets, onSelectMarket }: MarketListProps) {
  return (
    <section className="market-list" aria-labelledby="market-list-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Markets</span>
          <h2 id="market-list-heading">Trade live prediction markets</h2>
        </div>
        <span className="count-pill" >{/* text content matches length dynamically */}
          {markets.length} {markets.length === 1 ? "market" : "markets"}
        </span>
      </div>

      {markets.length === 0 ? (
        <div className="empty-state" role="status">
          No markets available.
        </div>
      ) : (
        <div className="markets-grid" role="feed" aria-busy="false">
          {markets.map((market) => {
            const prices = getMarketPrices(market);

            return (
              <button
                key={market.id}
                className="market-card"
                onClick={() => onSelectMarket(market.id)}
                type="button"
                aria-label={`View trading options for ${market.title}`}
              >
                <div className="market-card-top">
                  <span className="market-status">Open</span>
                  <span className="market-liquidity">
                    {(market.totalQty ?? 0).toLocaleString()} shares
                  </span>
                </div>

                <h3>{market.title}</h3>
                <p className="market-description">{market.description}</p>

                <div className="market-card-actions">
                  <span className="price-chip yes-chip">
                    Yes {formatCents(prices.yes)}
                  </span>
                  <span className="price-chip no-chip">
                    No {formatCents(prices.no)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}