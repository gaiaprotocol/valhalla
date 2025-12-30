export interface Notice {
  id: number;
  type?: string;
  title: string;
  content: string;
  createdAt: string | number;
  translations?: Record<string, Record<string, string>>;
}
