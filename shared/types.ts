export interface Filing {
  accessionNumber: string;
  form: string;
  filingDate: string;
  documentUrl: string;
}

export interface CompanyFilings {
  cik: string;
  name: string;
  historyScope: "recent";
  filings: Filing[];
}

export interface PaginatedCompanyFilings extends CompanyFilings {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
