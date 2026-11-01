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

const getLoginError = (error: any) => {
  if (error?.response?.status !== 404) return error;

  const baseURL = String(
    error?.config?.baseURL ||
      process.env.NEXT_PUBLIC_BACKEND_API_URL ||
      "http://localhost:3001/api/v1"
  ).replace(/\/+$/, "");
  const path = String(error?.config?.url || "/auth/login").replace(/^\/+/, "");
  const method = String(error?.config?.method || "post").toUpperCase();

  return new Error(
    `Authentication API endpoint not found: ${method} ${baseURL}/${path}. Check NEXT_PUBLIC_BACKEND_API_URL and make sure the NestJS backend is running.`
  );
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
