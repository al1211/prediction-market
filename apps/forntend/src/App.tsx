import { useState, useEffect } from "react";
import { useUser } from "./hooks/useUser";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "./types";
import { MarketList } from "./components/MarketList";
import { MarketDetail } from "./components/MarkDetails";
import { OrderForm } from "./components/OrderForm";
import { Balance } from "./components/Balance";
import { Positions } from "./components/Position";
import { OrderHistory } from "./components/OrderHistory";
import { SplitMerge } from "./components/SplitMerge";
import "./App.css";

// 1. Updated global declaration to look for Phantom instead of Solflare
declare global {
  interface Window {
    phantom?: {
      solana?: any;
    };
  }
}

function App() {
  const [supabase] = useState(createClient(
    "https://sgvenstbkiedwlmctkym.supabase.co",
    "sb_publishable_UzrNN841hMRh49RkCtCvbA_5ayRmeRN"
  ));
  return <AppWrapper supabase={supabase} />;
}

function AppWrapper({ supabase }: { supabase: SupabaseClient }) {
  const { claims } = useUser(supabase);
  const [token, setToken] = useState<string>("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [activeTab, setActiveTab] = useState<string>("markets");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          setToken(session.access_token);
        }
      });
    }
  }, [supabase, claims]);

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch("http://localhost:3000/markets");
      const data = await response.json();
      const nextMarkets = data.markets || [];
      setMarkets(nextMarkets);
      setSelectedMarket((current) => (
        current ? nextMarkets.find((market: Market) => market.id === current.id) || current : current
      ));
    } catch (err) {
      console.error("Failed to fetch markets:", err);
    }
  };

  // 2. Updated to pick up the Phantom Solana provider context
  const handleSignIn = async () => {
    const phantomWallet = window.phantom?.solana;
    if (phantomWallet) {
      await supabase.auth.signInWithWeb3({
        chain: 'solana',
        statement: 'I accept the Terms of Service at https://example.com/tos',
        wallet: phantomWallet,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setToken("");
    setSelectedMarket(null);
    setActiveTab("markets");
  };

  const handleSelectMarket = (marketId: string) => {
    const market = markets.find(m => m.id === marketId);
    if (market) {
      setSelectedMarket(market);
      setActiveTab("trading");
    }
  };

  const handleActionComplete = () => {
    setRefreshKey(prev => prev + 1);
    fetchMarkets();
  };

  // Check if phantom wallet object exists
  const isPhantomInstalled = !!window.phantom?.solana;

  if (!claims) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>Prediction Market</h1>
          <p>Please sign in to access the market</p>
          {/* 3. Updated buttons and fallback text to match Phantom */}
          {isPhantomInstalled ? (
            <button onClick={handleSignIn} className="signin-button">
              Sign in with Phantom
            </button>
          ) : (
            <p>Please install Phantom wallet to continue</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Prediction Market</h1>
        <button onClick={handleSignOut} className="logout-button">
          Logout
        </button>
      </header>

      <nav className="app-nav">
        <button
          className={activeTab === "markets" ? "active" : ""}
          onClick={() => {
            setActiveTab("markets");
            setSelectedMarket(null);
          }}
        >
          Markets
        </button>
        <button
          className={activeTab === "trading" ? "active" : ""}
          onClick={() => setActiveTab("trading")}
          disabled={!selectedMarket}
        >
          Trading
        </button>
        <button
          className={activeTab === "balance" ? "active" : ""}
          onClick={() => setActiveTab("balance")}
        >
          Balance
        </button>
        <button
          className={activeTab === "positions" ? "active" : ""}
          onClick={() => setActiveTab("positions")}
        >
          Positions
        </button>
        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      <nav className="app-nav">
        <button
          className={activeTab === "markets" ? "active" : ""}
          onClick={() => {
            setActiveTab("markets");
            setSelectedMarket(null);
          }}
        >
          Markets
        </button>
        <button
          className={activeTab === "trading" ? "active" : ""}
          onClick={() => setActiveTab("trading")}
          disabled={!selectedMarket}
        >
          Trading
        </button>
        <button
          className={activeTab === "balance" ? "active" : ""}
          onClick={() => setActiveTab("balance")}
        >
          Balance
        </button>
        <button
          className={activeTab === "positions" ? "active" : ""}
          onClick={() => setActiveTab("positions")}
        >
          Positions
        </button>
        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      <main className="app-main">
        {activeTab === "markets" && (
          <MarketList markets={markets} onSelectMarket={handleSelectMarket} />
        )}

        {activeTab === "trading" && selectedMarket && (
          <div className="trading-container">
            <MarketDetail
              market={selectedMarket}
              onBack={() => {
                setActiveTab("markets");
                setSelectedMarket(null);
              }}
            />
            <aside className="trade-sidebar">
              <OrderForm
                market={selectedMarket}
                token={token}
                onOrderPlaced={handleActionComplete}
              />
              <SplitMerge
                market={selectedMarket}
                token={token}
                onActionComplete={handleActionComplete}
              />
            </aside>
          </div>
        )}

        {activeTab === "balance" && <Balance token={token} key={refreshKey} />}

        {activeTab === "positions" && (
          <Positions token={token} markets={markets} key={refreshKey} />
        )}

        {activeTab === "history" && (
          <OrderHistory token={token} markets={markets} key={refreshKey} />
        )}

      </main>
    </div>
  );
}

export default App;