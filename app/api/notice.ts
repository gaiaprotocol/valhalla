declare const GAIA_API_URI: string;

export async function fetchNotices(): Promise<Notice[]> {
  const res = await fetch(`${GAIA_API_URI}/notices`);
  if (!res.ok) throw new Error('Failed to fetch notices');
  const json = await res.json();
  return json.data;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  created_at: string;
}
