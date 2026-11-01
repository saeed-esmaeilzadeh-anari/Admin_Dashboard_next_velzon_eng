// Registration supports the configured auth provider.
// The standalone NestJS API expects { name, email, password }.
import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import {
  postFakeRegister,
  postJwtRegister,
} from "../../../helpers/fakebackend_helper";
import backendApi from "../../../helpers/backendApi";

import {
  registerUserSuccessful,
  registerUserFailed,
  resetRegisterFlagChange,
} from "./reducer";

const getRegistrationError = (error: any): string => {
  const message =
    error?.response?.data?.message ??
    error?.message ??
    "Registration failed. Please try again.";
  return Array.isArray(message) ? message.join(", ") : String(message);
};

export const registerUser = (user: any) => async (dispatch: any) => {
  try {
    const defaultAuth =
      process.env.NEXT_PUBLIC_DEFAULT_AUTH ||
      process.env.NEXT_PUBLIC_DEFAULTAUTH;

    let data: any;

    if (defaultAuth === "firebase") {
      const fireBaseBackend: any = getFirebaseBackend();
      data = await fireBaseBackend.registerUser(user.email, user.password);
    } else if (defaultAuth === "jwt") {
      data = await postJwtRegister("/post-jwt-register", user);
    } else if (defaultAuth === "backend") {
      const response = await backendApi.post("/auth/register", {
        name: String(user.name ?? user.first_name ?? "").trim(),
        email: String(user.email ?? "").trim().toLowerCase(),
        password: user.password,
      });
      data = response.data;
    } else if (defaultAuth === "fake" || process.env.REACT_APP_API_URL) {
      data = await postFakeRegister(user);
      if (data?.message !== "success") {
        dispatch(registerUserFailed(getRegistrationError(data)));
        return;
      }
    } else {
      throw new Error(
        "Authentication provider is not configured. Set NEXT_PUBLIC_DEFAULT_AUTH."
      );
    }

    dispatch(registerUserSuccessful(data));
  } catch (error: any) {
    dispatch(registerUserFailed(getRegistrationError(error)));
  }
};

export const resetRegisterFlag = () => resetRegisterFlagChange();
