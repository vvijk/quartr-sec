import { useState } from "react";
import type { SubmitEvent } from "react";
import type { PaginatedCompanyFilings } from "../shared/types";
import SummaryView from "./SummaryView";

interface FilingQuery {
  ticker: string;
  form: string;
  sort: string;
  limit: number;
}

export default function App() {
  const [ticker, setTicker] = useState("");
  const [form, setForm] = useState("");
  const [sort, setSort] = useState("DESC");
  const [limit, setLimit] = useState(20);
  const [appliedQuery, setAppliedQuery] = useState<FilingQuery | null>(null);
  const [company, setCompany] = useState<PaginatedCompanyFilings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadFilings(
      {
        ticker: ticker.trim().toUpperCase(),
        form: form.trim().toUpperCase(),
        sort,
        limit,
      },
      1,
    );
  }

  async function loadFilings(query: FilingQuery, page: number) {
    if (loading) return;
    setCompany(null);
    setError("");
    if (!query.ticker) {
      setError("Enter a company ticker.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: query.sort,
        page: String(page),
        limit: String(query.limit),
      });
      if (query.form) params.set("form", query.form);
      const response = await fetch(
        `/api/companies/${encodeURIComponent(query.ticker)}/filings?${params}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not load filings. Please try again.",
        );
      }
      const result: PaginatedCompanyFilings = await response.json();
      setCompany(result);
      setAppliedQuery(query);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load filings. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>SEC filings</h1>
          <p>Company disclosures, ready to explore.</p>
        </div>
        <span className="source-label">SEC EDGAR</span>
      </header>

      <section className="filings-workspace" aria-labelledby="filings-heading">
        <div className="section-heading">
          <h2 id="filings-heading">Browse filings</h2>
          <p>Find a company by ticker, then narrow its recent filings.</p>
        </div>
        <form className="search-form" onSubmit={search}>
          <label htmlFor="ticker">Company ticker</label>
          <div className="search-controls">
            <input
              id="ticker"
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="e.g. AAPL, SPOT, JPM"
              maxLength={32}
              disabled={loading}
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
          <div className="query-controls">
            <div>
              <label htmlFor="form-type">Form type</label>
              <input
                id="form-type"
                value={form}
                onChange={(event) => setForm(event.target.value)}
                placeholder="All forms"
                list="form-suggestions"
                disabled={loading}
                spellCheck={false}
              />
              <datalist id="form-suggestions">
                <option value="10-K" />
                <option value="10-Q" />
                <option value="8-K" />
                <option value="20-F" />
                <option value="6-K" />
              </datalist>
            </div>
            <div>
              <label htmlFor="sort">Filing date</label>
              <select
                id="sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                disabled={loading}
              >
                <option value="DESC">Newest first</option>
                <option value="ASC">Oldest first</option>
              </select>
            </div>
            <div>
              <label htmlFor="page-size">Filings per page</label>
              <select
                id="page-size"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                disabled={loading}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <p className="scope-note">
            Leave form type blank for all forms, or enter any form type. Search
            applies your choices from page one.
          </p>
        </form>

        {loading && (
          <p className="status-message" role="status">
            Loading filings…
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!company && !loading && !error && (
          <div className="empty-state">
            <h3>Your search starts with a ticker</h3>
            <p>
              Enter a symbol such as AAPL, SPOT, or JPM to browse recent filings
              and open the original documents.
            </p>
          </div>
        )}

        {company && (
          <section className="filing-results" aria-label="Company filings">
            <h3 className="company-title">{company.name}</h3>
            <div className="result-meta">
              <span>CIK {company.cik}</span>
              <span>
                Showing <strong>{company.filings.length}</strong> of{" "}
                <strong>{company.total}</strong> matching filings
              </span>
            </div>
            <div className="result-tags">
              <span>{appliedQuery?.form || "All forms"}</span>
              <span>
                {appliedQuery?.sort === "ASC" ? "Oldest first" : "Newest first"}
              </span>
            </div>
            <p className="scope-note">
              Showing filings from the SEC’s recent submissions data. Older
              history is not included.
            </p>
            {company.filings.length === 0 ? (
              <p className="empty-state" role="status">
                No recent filings match this search.
              </p>
            ) : (
              <div className="table-container">
                <table className="filings-table">
                  <caption className="sr-only">
                    Recent filings for {company.name}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Form type</th>
                      <th scope="col">Filing date</th>
                      <th scope="col">Accession number</th>
                      <th scope="col">Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.filings.map((filing) => (
                      <tr key={filing.accessionNumber}>
                        <td>
                          <span className="form-badge">{filing.form}</span>
                        </td>
                        <td>
                          <time dateTime={filing.filingDate}>
                            {filing.filingDate}
                          </time>
                        </td>
                        <td>{filing.accessionNumber}</td>
                        <td>
                          <a
                            href={filing.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${filing.form} filed ${filing.filingDate} on SEC (opens in new tab)`}
                          >
                            View on SEC ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {appliedQuery && company.totalPages > 0 && (
              <nav className="pagination" aria-label="Filing pages">
                <button
                  type="button"
                  disabled={loading || company.page <= 1}
                  onClick={() => loadFilings(appliedQuery, company.page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {company.page} of {company.totalPages}
                </span>
                <button
                  type="button"
                  disabled={loading || company.page >= company.totalPages}
                  onClick={() => loadFilings(appliedQuery, company.page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        )}
      </section>
      <SummaryView />
    </main>
  );
}
