// Authentication requests for the Velzon dashboard.
import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import { postJwtLogin } from "../../../helpers/fakebackend_helper";
import Cookies from "js-cookie";
import {
  loginSuccess,
  logoutUserSuccess,
  apiError,
  reset_login_flag,
} from "./reducer";

type LoginCredentials = {
  email: string;
  password: string;
};

const getAuthProvider = () => {
  const configured =
    process.env.NEXT_PUBLIC_DEFAULT_AUTH ||
    process.env.NEXT_PUBLIC_DEFAULTAUTH ||
    "backend";

  return configured.trim().toLowerCase() || "backend";
};

const BACKEND_LOGIN_ENDPOINT = "/backend-api/auth/login";

const getLoginError = (error: unknown): string => {
  const candidate = error as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  } | null;

  const responseMessage = candidate?.response?.data?.message;
  if (Array.isArray(responseMessage)) {
    return responseMessage.map(String).join(", ");
  }
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof candidate?.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  return "Unable to sign in. Please check your connection and try again.";
};

const readResponseMessage = (payload: unknown): string | undefined => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.map(String).join(", ");
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return undefined;
};

/**
 * Use the same native Fetch path that is used by the browser's same-origin
 * proxy. This avoids Axios adapter/config differences for the sign-in flow.
 */
const postBackendLogin = async (credentials: LoginCredentials): Promise<any> => {
  let response: Response;

  try {
    response = await fetch(BACKEND_LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(credentials),
    });
  } catch (error) {
    throw new Error(
      "Could not reach the backend login endpoint through " +
        BACKEND_LOGIN_ENDPOINT +
        ". " +
        getLoginError(error)
    );
  }

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    const apiMessage = readResponseMessage(payload);

    if (response.status === 401) {
      throw new Error(apiMessage || "Invalid email or password.");
    }

    if (response.status === 404) {
      const details =
        apiMessage ||
        (typeof payload === "string" && payload.trim()) ||
        response.statusText ||
        "No response body";

      throw new Error(
        "Backend login endpoint returned HTTP 404 for POST " +
          (response.url || BACKEND_LOGIN_ENDPOINT) +
          ". Response: " +
          details
      );
    }

    throw new Error(
      apiMessage ||
        "Backend login failed with HTTP " +
          response.status +
          " (" +
          response.statusText +
          ")."
    );
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The backend returned an invalid login response.");
  }

  return payload;
};

export const loginUser = (user: LoginCredentials, router: any) => async (dispatch: any) => {
  try {
    const defaultAuth = getAuthProvider();
    let rawData: any;

    if (defaultAuth === "firebase") {
      const fireBaseBackend: any = getFirebaseBackend();
      rawData = await fireBaseBackend.loginUser(user.email, user.password);
    } else if (defaultAuth === "backend") {
      rawData = await postBackendLogin({
        email: user.email,
        password: user.password,
      });
    } else if (defaultAuth === "jwt" || defaultAuth === "fake") {
      rawData = await postJwtLogin({
        email: user.email,
        password: user.password,
      });
    } else {
      throw new Error(
        `Unsupported authentication provider "${defaultAuth}". Use backend, firebase, jwt or fake.`
      );
    }

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
    // Redux actions must contain serializable values, never Error/AxiosError objects.
    dispatch(apiError({ message: getLoginError(error) }));
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
    dispatch(apiError({ message: getLoginError(error) }));
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
        throw new Error(
          "Social login is not configured for the selected authentication provider."
        );
      }

      const socialData = await response;
      if (socialData) {
        Cookies.set("authUser", JSON.stringify(socialData), { expires: 1 });
        dispatch(loginSuccess(socialData));
        history("/dashboard");
      }
    } catch (error) {
      dispatch(apiError({ message: getLoginError(error) }));
    }
  };

export const resetLoginFlag = () => async (dispatch: any) => {
  try {
    return dispatch(reset_login_flag());
  } catch (error) {
    dispatch(apiError({ message: getLoginError(error) }));
  }
};
