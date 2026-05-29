import { useState } from "react";
import type { Market } from "../types";

interface SplitMergeProps {
  markets?: Market[];
  market?: Market;
  token: string;
  onActionComplete: () => void;
}

async function readResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export function SplitMerge({ markets = [], market, token, onActionComplete }: SplitMergeProps) {
  const [marketId, setMarketId] = useState<string>(market?.id || "");
  const [amount, setAmount] = useState<string>("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const selectedMarketId = market?.id || marketId;
  const selectedMarketTitle = market?.title || markets.find((item) => item.id === selectedMarketId)?.title;

  const runAction = async (action: "split" | "merge") => {
    if (!selectedMarketId) {
      setError("Select a market first.");
      return;
    }

    const parsedAmount = Math.floor(Number(amount));
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      setError("Enter a valid quantity.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`http://localhost:3000/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          marketId: selectedMarketId,
          amount: parsedAmount,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || `${action} failed`);
      }

      setSuccess(action === "split" ? "Split completed." : "Merge completed.");
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="trade-card split-merge-section">
      <div className="trade-card-header">
        <div>
          <span>Market actions</span>
          <h3>Split / Merge</h3>
        </div>
        <span>{selectedMarketTitle || "Select market"}</span>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {!market && (
        <div className="form-group">
          <label>Market</label>
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)}>
            <option value="">Select a market</option>
            {markets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label>Quantity</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="split-merge-actions">
        <button type="button" onClick={() => runAction("split")} disabled={loading || !token}>
          Split
        </button>
        <button type="button" onClick={() => runAction("merge")} disabled={loading || !token}>
          Merge
        </button>
      </div>
    </section>
  );
}