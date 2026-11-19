import type { CompanyFilings, Filing } from "../shared/types";
import { fetchSecJson, SecError } from "./sec";

function validateCik(cik: string): void {
  const onlyDigits = Array.from(cik).every((character) =>
    "0123456789".includes(character),
  );
  if (cik.length !== 10 || !onlyDigits || Number(cik) === 0) {
    throw new SecError("INVALID_CIK", "Expected a resolved 10-digit CIK.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringColumn(data: Record<string, unknown>, key: string): string[] {
  const column = data[key];
  if (
    !Array.isArray(column) ||
    !column.every((value) => typeof value === "string")
  ) {
    throw new SecError(
      "SEC_UPSTREAM",
      `SEC returned an invalid ${key} column.`,
    );
  }
  return column;
}

function isValidFilingDate(value: string): boolean {
  const date = new Date(value);
  // The comparison rejects rolled-over dates, such as February 30.
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// SEC's parallel arrays use the same index for every field of a filing.
export function transformFilings(data: unknown, cik: string): Filing[] {
  validateCik(cik);
  if (!isRecord(data))
    throw new SecError("SEC_UPSTREAM", "SEC returned invalid filing columns.");

  const accessions = stringColumn(data, "accessionNumber");
  const forms = stringColumn(data, "form");
  const dates = stringColumn(data, "filingDate");
  const documents = stringColumn(data, "primaryDocument");
  if (
    [forms, dates, documents].some(
      (column) => column.length !== accessions.length,
    )
  ) {
    throw new SecError(
      "SEC_UPSTREAM",
      "SEC filing columns have different lengths.",
    );
  }

  return accessions.map((accessionNumber, index) => {
    const form = forms[index];
    const filingDate = dates[index];
    const document = documents[index];
    if (
      !accessionNumber.trim() ||
      !form?.trim() ||
      !filingDate ||
      document === undefined
    ) {
      throw new SecError(
        "SEC_UPSTREAM",
        `SEC filing at index ${index} is missing required fields.`,
      );
    }

    const accessionDigits = accessionNumber.replaceAll("-", "");
    const onlyDigits = Array.from(accessionDigits).every((character) =>
      "0123456789".includes(character),
    );
    if (!accessionDigits || !onlyDigits) {
      throw new SecError(
        "SEC_UPSTREAM",
        `SEC filing at index ${index} has an invalid accession number.`,
      );
    }

    if (!isValidFilingDate(filingDate)) {
      throw new SecError(
        "SEC_UPSTREAM",
        `SEC filing at index ${index} must have a valid YYYY-MM-DD date.`,
      );
    }

    // Some primary documents include an SEC stylesheet directory.
    const segments = document.split("/");
    if (
      document &&
      segments.some(
        (segment) => !segment || segment === "." || segment === "..",
      )
    ) {
      throw new SecError(
        "SEC_UPSTREAM",
        "SEC returned an invalid document path.",
      );
    }
    const filename = document
      ? segments.map(encodeURIComponent).join("/")
      : `${accessionNumber}.txt`;
    const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionDigits}`;

    return {
      accessionNumber,
      form,
      filingDate,
      documentUrl: `${base}/${filename}`,
    };
  });
}

export async function fetchCompanyFilings(
  cik: string,
  userAgent = process.env.SEC_USER_AGENT,
  fetcher = fetch,
): Promise<CompanyFilings> {
  validateCik(cik);
  const data = await fetchSecJson(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    userAgent,
    fetcher,
  );
  if (
    !isRecord(data) ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    String(data.cik).padStart(10, "0") !== cik ||
    !isRecord(data.filings)
  ) {
    throw new SecError(
      "SEC_UPSTREAM",
      "SEC returned invalid company submissions.",
    );
  }

  return {
    cik,
    name: data.name,
    historyScope: "recent",
    filings: transformFilings(data.filings.recent, cik),
  };
}
