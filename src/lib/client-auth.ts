export const LOGGED_IN_USER_KEY = "cocagreen:logged-user";
export const AUTH_CHANGE_EVENT = "cocagreen:auth-change";

export function getLoggedInUser() {
  return window.localStorage.getItem(LOGGED_IN_USER_KEY);
}

export function subscribeToAuthChanges(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
}

export function setLoggedInUser(username: string) {
  window.localStorage.setItem(LOGGED_IN_USER_KEY, username);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearLoggedInUser() {
  window.localStorage.removeItem(LOGGED_IN_USER_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
