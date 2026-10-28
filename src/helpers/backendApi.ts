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
