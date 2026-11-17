import { useState } from "react";
import type { SubmitEvent } from "react";
import type { CompanyFilings } from "../shared/types";

export default function App() {
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState<CompanyFilings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const query = ticker.trim().toUpperCase();
    setCompany(null);
    setError("");
    if (!query) {
      setError("Enter a company ticker.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(query)}/filings`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Could not load filings. Please try again.");
      }
      const result: CompanyFilings = await response.json();
      setCompany(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load filings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>SEC Filings</h1>
      <p>Look up a company’s recent SEC filings by ticker.</p>

      <form onSubmit={search}>
        <label htmlFor="ticker">Company ticker</label>
        <div className="search-controls">
          <input id="ticker" value={ticker} onChange={(event) => setTicker(event.target.value)}
            placeholder="e.g. AAPL, SPOT, JPM" maxLength={32} disabled={loading}
            autoCapitalize="characters" spellCheck={false} required />
          <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
        </div>
      </form>

      {loading && <p role="status">Loading filings…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!company && !loading && !error && <p>Enter a ticker to view filings.</p>}

      {company && (
        <section aria-label="Company filings">
          <h2>{company.name}</h2>
          <p>CIK: {company.cik} · {company.filings.length} recent filings</p>
          <p className="scope-note">Showing filings from the SEC’s recent submissions data. Older history is not included.</p>
          {company.filings.length === 0 ? <p role="status">No recent filings found for this company.</p> : (
            <div className="table-container">
              <table>
                <caption className="sr-only">Recent filings for {company.name}</caption>
                <thead><tr>
                  <th scope="col">Form type</th>
                  <th scope="col">Filing date</th>
                  <th scope="col">Accession number</th>
                  <th scope="col">Document</th>
                </tr></thead>
                <tbody>{company.filings.map((filing) => (
                  <tr key={filing.accessionNumber}>
                    <td>{filing.form}</td>
                    <td><time dateTime={filing.filingDate}>{filing.filingDate}</time></td>
                    <td>{filing.accessionNumber}</td>
                    <td><a href={filing.documentUrl} target="_blank" rel="noopener noreferrer"
                      aria-label={`View ${filing.form} filed ${filing.filingDate} on SEC (opens in new tab)`}>View on SEC ↗</a></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
