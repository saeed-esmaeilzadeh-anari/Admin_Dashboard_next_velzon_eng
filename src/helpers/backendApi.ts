import axios from "axios";

const backendApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

backendApi.interceptors.request.use((request) => {
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem("authUser");
      if (raw) {
        const authUser = JSON.parse(raw) as { token?: string; accessToken?: string };
        const token = authUser.accessToken ?? authUser.token;
        if (token) request.headers.Authorization = "Bearer " + token;
      }
    } catch {
      // Ignore malformed legacy session state; callers will receive the API's 401 response.
    }
  }
  return request;
});

export default backendApi;


let isRedirectingForExpiredSession = false;

// Access tokens intentionally expire quickly. If a protected API call returns 401,
// clear the stale browser session so the user does not remain in a broken dashboard.
// A 403 is deliberately not handled here: it means the session is valid but the role
// lacks permission, and must not sign the user out.
backendApi.interceptors.response.use(
  response => response,
  error => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      let hasSession = false;
      try {
        hasSession = Boolean(window.sessionStorage.getItem("authUser"));
      } catch {
        hasSession = false;
      }
      hasSession = hasSession || document.cookie.split(";").some(cookie => cookie.trim().startsWith("authUser="));

      if (hasSession) {
        try { window.sessionStorage.removeItem("authUser"); } catch { /* Storage may be blocked by browser policy. */ }
        document.cookie = "authUser=; Max-Age=0; path=/; SameSite=Lax";

        const isAuthRoute = window.location.pathname === "/auth/login" ||
          window.location.pathname === "/auth/register" ||
          window.location.pathname.startsWith("/auth/");
        if (!isAuthRoute && !isRedirectingForExpiredSession) {
          isRedirectingForExpiredSession = true;
          const returnTo = window.location.pathname + window.location.search;
          const loginUrl = new URL("/auth/login", window.location.origin);
          if (returnTo !== "/auth/login") loginUrl.searchParams.set("returnTo", returnTo);
          window.location.replace(loginUrl.toString());
        }
      }
    }
    return Promise.reject(error);
  },
);
