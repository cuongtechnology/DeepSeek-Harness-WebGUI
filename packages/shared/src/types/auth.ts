export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthSession {
  user: PublicUser;
  expiresAt: string;
}
