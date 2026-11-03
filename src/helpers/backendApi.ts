import axios from "axios";

// Browser requests stay on the Next.js origin. The Next.js Route Handler reads
// the HttpOnly session cookie and adds the backend Bearer token server-side.
const backendApi = axios.create({
  baseURL: "/backend-api",
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export default backendApi;

let isRedirectingForExpiredSession = false;

// A 401 means the server-side session is absent, expired or rejected.
// The BFF clears its HttpOnly cookie on protected API 401 responses.
// A 403 is intentionally not handled here: the user is authenticated but lacks
// permission for the requested operation.
backendApi.interceptors.response.use(
  response => response,
  error => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      const requestUrl = String(error?.config?.url ?? "");
      const isAuthenticationRequest = /\/auth\/(login|register|logout)(?:\?|$)/i.test(requestUrl);
      const isAuthRoute =
        window.location.pathname === "/auth/login" ||
        window.location.pathname === "/auth/register" ||
        window.location.pathname.startsWith("/auth/");

      if (!isAuthenticationRequest && !isAuthRoute && !isRedirectingForExpiredSession) {
        isRedirectingForExpiredSession = true;
        const returnTo = window.location.pathname + window.location.search;
        const loginUrl = new URL("/auth/login", window.location.origin);
        if (returnTo !== "/auth/login") {
          loginUrl.searchParams.set("returnTo", returnTo);
        }
        window.location.replace(loginUrl.toString());
      }
    }

    return Promise.reject(error);
  }
);
