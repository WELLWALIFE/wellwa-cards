// Sample platform data for the Super-Admin panel (until Supabase).

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro" | "team";
  cards: number;
  joined: string;
  status: "active" | "suspended";
}

export const adminUsers: AdminUser[] = [
  { id: "u1", name: "J. S. Rao", email: "wellwalife@gmail.com", plan: "pro", cards: 2, joined: "2026-03-14", status: "active" },
  { id: "u2", name: "Dr. Anita Mehta", email: "anita@wellwa.life", plan: "free", cards: 1, joined: "2026-05-02", status: "active" },
  { id: "u3", name: "Ravi Deshmukh", email: "ravi.d@gmail.com", plan: "pro", cards: 1, joined: "2026-06-11", status: "active" },
  { id: "u4", name: "Sneha Kulkarni", email: "sneha.k@gmail.com", plan: "free", cards: 1, joined: "2026-06-28", status: "active" },
  { id: "u5", name: "Amit Patel", email: "amitp@yahoo.com", plan: "team", cards: 4, joined: "2026-07-05", status: "suspended" },
];

export interface AdminCardRow {
  id: string;
  username: string;
  owner: string;
  ownerId?: string;
  plan: "free" | "pro" | "team";
  views: number;
  leads: number;
  verified: boolean;
  active: boolean;
}

export const adminCards: AdminCardRow[] = [
  { id: "8796", username: "neural", owner: "J. S. Rao", plan: "pro", views: 1284, leads: 4, verified: true, active: true },
  { id: "8801", username: "drmehta", owner: "Dr. Anita Mehta", plan: "free", views: 342, leads: 1, verified: false, active: true },
  { id: "8811", username: "ravi-wellness", owner: "Ravi Deshmukh", plan: "pro", views: 866, leads: 7, verified: true, active: true },
  { id: "8814", username: "sneha-nutrition", owner: "Sneha Kulkarni", plan: "free", views: 120, leads: 0, verified: false, active: true },
  { id: "8820", username: "amit-team", owner: "Amit Patel", plan: "team", views: 2210, leads: 19, verified: false, active: false },
];
