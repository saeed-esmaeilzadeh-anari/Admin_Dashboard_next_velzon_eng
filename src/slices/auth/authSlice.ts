import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import backendApi from "../../helpers/backendApi";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

const getApiErrorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message ?? error?.message;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" && message.trim() ? message : fallback;
};

// Keep the alternate auth slice aligned with the canonical NestJS API contract.
export const login = createAsyncThunk(
  "auth/login",
  async (
    credentials: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await backendApi.post("/auth/login", credentials);
      return response.data;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, "Login failed."));
    }
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async (
    userData: { name: string; email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await backendApi.post("/auth/register", userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, "Registration failed."));
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: state => {
      state.user = null;
      state.token = null;
      state.error = null;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user ?? null;
        state.token = action.payload.accessToken ?? null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) ?? action.error.message ?? "Login failed.";
      })
      .addCase(register.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user ?? null;
        state.token = action.payload.accessToken ?? null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) ??
          action.error.message ??
          "Registration failed.";
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
