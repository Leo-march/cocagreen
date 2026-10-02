export const LOGGED_IN_USER_KEY = "cocagreen:logged-user";
export const USER_ROLE_KEY = "cocagreen:user-role";
export const AUTH_CHANGE_EVENT = "cocagreen:auth-change";

export type UserRole = "admin" | "visitor";

export function getLoggedInUser() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(LOGGED_IN_USER_KEY);
}

export function getUserRole(): UserRole {
  if (typeof window === "undefined") {
    return "visitor";
  }
  const role = window.localStorage.getItem(USER_ROLE_KEY);
  return role === "admin" || role === "visitor" ? role : "visitor";
}

export function subscribeToAuthChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
}

export function setLoggedInUser(username: string, role: UserRole = "admin") {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOGGED_IN_USER_KEY, username);
  window.localStorage.setItem(USER_ROLE_KEY, role);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function setVisitorSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOGGED_IN_USER_KEY, "Visitante");
  window.localStorage.setItem(USER_ROLE_KEY, "visitor");
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearLoggedInUser() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(LOGGED_IN_USER_KEY);
  window.localStorage.removeItem(USER_ROLE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
