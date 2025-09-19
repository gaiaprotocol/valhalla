export interface Notice {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  translations?: Record<string, Record<string, string>>;
}
