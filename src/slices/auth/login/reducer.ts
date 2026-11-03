import { createSlice } from "@reduxjs/toolkit";

const getErrorMessage = (payload: any): string => {
  const message =
    payload?.response?.data?.message ??
    payload?.data?.message ??
    payload?.message;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" && message.trim()
    ? message
    : "Unable to sign in. Please check your email and password.";
};

export const initialState = {
  user: {},
  error: "",
  loading: false,
  isUserLogout: false,
  errorMsg: false,
};

const loginSlice = createSlice({
  name: "login",
  initialState,
  reducers: {
    apiError(state, action) {
      state.error = getErrorMessage(action.payload);
      state.loading = false;
      state.isUserLogout = false;
      state.errorMsg = true;
    },
    loginSuccess(state, action) {
      state.user = action.payload;
      state.error = "";
      state.loading = false;
      state.errorMsg = false;
    },
    logoutUserSuccess(state) {
      state.user = {};
      state.isUserLogout = true;
      state.error = "";
      state.loading = false;
      state.errorMsg = false;
    },
    reset_login_flag(state) {
      state.error = "";
      state.loading = false;
      state.errorMsg = false;
    },
  },
});

export const { apiError, loginSuccess, logoutUserSuccess, reset_login_flag } =
  loginSlice.actions;

export default loginSlice.reducer;
