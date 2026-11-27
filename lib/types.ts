export type Verification = {
  label: "Supported" | "Mixed evidence" | "Unverified";
  summary: string;
  checks: string[];
  caveat: string;
};

export type NewsPost = {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  time: string;
  category: string;
  title: string;
  body: string;
  image?: string;
  sourceUrl?: string;
  likes: number;
  comments: number;
  verified?: Verification;
  liked?: boolean;
};
