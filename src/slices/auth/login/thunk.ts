// Include both helper files with needed methods
import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import { postJwtLogin } from "../../../helpers/fakebackend_helper";
import backendApi from "../../../helpers/backendApi";
import Cookies from "js-cookie";
import {
  loginSuccess,
  logoutUserSuccess,
  apiError,
  reset_login_flag,
} from "./reducer";

const getAuthProvider = () => {
  const configured =
    process.env.NEXT_PUBLIC_DEFAULT_AUTH ||
    process.env.NEXT_PUBLIC_DEFAULTAUTH ||
    "backend";

  return configured.trim().toLowerCase() || "backend";
};

const getBackendLoginUrl = () => {
  const baseUrl = (
    process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() ||
    "http://localhost:3001/api/v1"
  ).replace(/\/+$/, "");
  return baseUrl + "/auth/login";
};

const getLoginError = (error: any) => {
  const status = error?.response?.status;
  const responseMessage = error?.response?.data?.message;
  const backendUrl = getBackendLoginUrl();

  if (status === 404) {
    const details = Array.isArray(responseMessage)
      ? responseMessage.join(", ")
      : typeof responseMessage === "string"
        ? responseMessage
        : "No response body";

    if (details.startsWith("Cannot ")) {
      return new Error(
        "NestJS returned 404 for POST " + backendUrl + ". Server response: " + details
      );
    }

    return new Error(
      "The same-origin backend proxy returned HTTP 404 for POST " + backendUrl + ". Response: " + details
    );
  }

  if (!error?.response) {
    return new Error(
      "Cannot reach the backend API at " + backendUrl +
      ". Check that the NestJS server is running and NEXT_PUBLIC_BACKEND_API_URL is correct. " +
      (error?.message || "")
    );
  }

  return error;
};

export const loginUser = (user: any, router: any) => async (dispatch: any) => {
  try {
    const defaultAuth = getAuthProvider();
    let response;

    if (defaultAuth === "firebase") {
      const fireBaseBackend: any = getFirebaseBackend();
      response = fireBaseBackend.loginUser(user.email, user.password);
    } else if (defaultAuth === "backend") {
      response = backendApi
        .post("/auth/login", { email: user.email, password: user.password })
        .then(result => result.data);
    } else if (defaultAuth === "jwt" || defaultAuth === "fake") {
      response = postJwtLogin({ email: user.email, password: user.password });
    } else {
      throw new Error(
        `Unsupported authentication provider "${defaultAuth}". Use backend, firebase, jwt or fake.`
      );
    }

    const rawData = await response;
    const data =
      defaultAuth === "backend" && rawData?.user
        ? {
            ...rawData,
            ...rawData.user,
            user: rawData.user,
            accessToken: rawData.accessToken,
          }
        : rawData;

    if (data) {
      Cookies.set("authUser", JSON.stringify(data), { expires: 1 });
      if (defaultAuth === "backend" && typeof window !== "undefined") {
        window.sessionStorage.setItem("authUser", JSON.stringify(data));
      }
      dispatch(loginSuccess(data));
      router.push("/dashboard");
    }
  } catch (error) {
    dispatch(apiError(getLoginError(error)));
  }
};

export const logoutUser = () => async (dispatch: any) => {
  try {
    Cookies.remove("authUser");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("authUser");
    }
    const fireBaseBackend: any = getFirebaseBackend();
    if (getAuthProvider() === "firebase") {
      const response = fireBaseBackend.logout;
      dispatch(logoutUserSuccess(response));
    } else {
      dispatch(logoutUserSuccess(true));
    }
  } catch (error) {
    dispatch(apiError(error));
  }
};

export const socialLogin =
  (type: any, history: any) => async (dispatch: any) => {
    try {
      let response;

      if (getAuthProvider() === "firebase") {
        const fireBaseBackend: any = getFirebaseBackend();
        response = fireBaseBackend.socialLoginUser(type);
      } else {
        throw new Error("Social login is not configured for the selected authentication provider.");
      }

      const socialData = await response;
      if (socialData) {
        Cookies.set("authUser", JSON.stringify(socialData), { expires: 1 });
        dispatch(loginSuccess(socialData));
        history("/dashboard");
      }
    } catch (error) {
      dispatch(apiError(error));
    }
  };

export const resetLoginFlag = () => async (dispatch: any) => {
  try {
    return dispatch(reset_login_flag());
  } catch (error) {
    dispatch(apiError(error));
  }
};
