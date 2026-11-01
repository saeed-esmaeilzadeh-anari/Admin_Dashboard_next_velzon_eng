import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export const initialState = {
  registrationError: null as string | null,
  message: null as string | null,
  loading: false,
  user: null as any,
  success: false,
  error: false,
  isUserLogout: true,
};

const registerSlice = createSlice({
  name: "register",
  initialState,
  reducers: {
    registerUserSuccessful(state: any, action: PayloadAction<any>) {
      state.user = action.payload?.user ?? action.payload;
      state.loading = false;
      state.success = true;
      state.error = false;
      state.registrationError = null;
    },
    registerUserFailed(state: any, action: PayloadAction<string>) {
      state.user = null;
      state.loading = false;
      state.registrationError = action.payload;
      state.error = true;
      state.success = false;
    },
    resetRegisterFlagChange(state: any) {
      state.success = false;
      state.error = false;
      state.registrationError = null;
    },
    apiErrorChange(state: any, action: PayloadAction<any>) {
      state.error = action.payload;
      state.loading = false;
      state.isUserLogout = false;
    },
  },
});

export const {
  registerUserSuccessful,
  registerUserFailed,
  resetRegisterFlagChange,
  apiErrorChange,
} = registerSlice.actions;

export default registerSlice.reducer;
