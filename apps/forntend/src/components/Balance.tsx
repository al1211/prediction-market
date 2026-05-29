import { useState, useEffect } from "react";

interface BalanceProps {
  token: string;
}

export function Balance({ token }: BalanceProps) {
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const fetchBalance = async () => {
    try {
      const response = await fetch("http://localhost:3000/balance", {
        headers: { Authorization: token },
      });
      const data = await response.json();
      setBalance(data.balance / 100); // Convert from cents to dollars
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [token]);

  const handleOnramp = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("http://localhost:3000/onramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Onramp failed");
      }

      setSuccess(`Successfully added $${amount} to your balance!`);
      fetchBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onramp failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOfframp = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("http://localhost:3000/offramp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Offramp failed");
      }

      setSuccess(`Successfully withdrew $${amount} from your balance!`);
      fetchBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Offramp failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="balance-section">
      <h3>Balance</h3>
      <div className="balance-display">
        <span className="balance-amount">${balance.toFixed(2)}</span>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="balance-actions">
        <div className="form-group">
          <label>Amount ($):</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <button onClick={handleOnramp} disabled={loading}>
          {loading ? "Processing..." : "Onramp"}
        </button>
        <button onClick={handleOfframp} disabled={loading}>
          {loading ? "Processing..." : "Offramp"}
        </button>
      </div>
    </div>
  );
}