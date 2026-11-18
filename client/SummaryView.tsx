import { useState } from "react";
import type { SubmitEvent } from "react";
import type { FilingsSummary } from "../shared/types";

export default function SummaryView() {
  const [tickers, setTickers] = useState("");
  const [summary, setSummary] = useState<FilingsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setSummary(null);
    setError("");

    const companies = [...new Set(tickers.split(",").map((ticker) => ticker.trim().toUpperCase()))];
    if (companies.some((ticker) => !ticker) || companies.length > 10) {
      setError("Enter 1–10 comma-separated tickers, without empty entries.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ tickers: companies.join(",") });
      const response = await fetch(`/api/filings/summary?${params}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Could not load the summary. Please try again.");
      }
      const result: FilingsSummary = await response.json();
      setSummary(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load the summary. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="summary-section" aria-labelledby="summary-heading">
      <div className="section-heading">
        <h2 id="summary-heading">Compare companies</h2>
        <p>Filing activity over the last 12 months, with each company’s latest available 10-K.</p>
      </div>
      <form className="search-form" onSubmit={search}>
        <label htmlFor="summary-tickers">Company tickers</label>
        <div className="search-controls">
          <input id="summary-tickers" value={tickers} onChange={(event) => setTickers(event.target.value)}
            placeholder="AAPL, SPOT, JPM" required disabled={loading} spellCheck={false}
            autoCapitalize="characters" aria-describedby="summary-help" />
          <button type="submit" disabled={loading}>{loading ? "Loading summary…" : "Get summary"}</button>
        </div>
        <p id="summary-help" className="scope-note">Enter up to 10 tickers, separated by commas.</p>
      </form>

      {loading && <p className="status-message" role="status">Loading company summaries…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!summary && !loading && !error && <div className="empty-state"><h3>A side-by-side view of filing activity</h3><p>Enter up to 10 company tickers to compare form counts and available 10-K dates.</p></div>}

      {summary && (
        <>
          <p className="reporting-period">Filing counts: <time dateTime={summary.from}>{summary.from}</time> through <time dateTime={summary.to}>{summary.to}</time> (inclusive).</p>
          <p className="scope-note">Latest 10-K searches the loaded recent history, including dates before this period. Older archives are not searched.</p>

          {summary.errors.length > 0 && (
            <div className="error" role="alert">
              <p>Could not load these companies:</p>
              <ul>{summary.errors.map((failure) => <li key={failure.ticker}><strong>{failure.ticker}:</strong> {failure.message}</li>)}</ul>
            </div>
          )}

          {summary.companies.length === 0 ? (
            <p className="empty-state" role="status">No company summaries available.</p>
          ) : (
            <div className="table-container">
              <table className="summary-table">
                <caption className="sr-only">Company filing summaries for the last 12 months</caption>
                <thead><tr>
                  <th scope="col">Company</th>
                  <th scope="col">Filings by form type</th>
                  <th scope="col">Latest 10-K in recent history</th>
                </tr></thead>
                <tbody>{summary.companies.map((company) => (
                  <tr key={company.ticker}>
                    <th scope="row">{company.ticker}<span className="company-name">{company.name}</span></th>
                    <td>{Object.keys(company.countsByForm).length === 0 ? "No filings in this period." : (
                      <ul className="form-counts">
                        {Object.entries(company.countsByForm).sort(([a], [b]) => a.localeCompare(b)).map(([form, count]) => (
                          <li key={form}><strong>{form}:</strong> {count}</li>
                        ))}
                      </ul>
                    )}</td>
                    <td>{company.latest10KDate
                      ? <time dateTime={company.latest10KDate}>{company.latest10KDate}</time>
                      : "Not found in recent history"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
