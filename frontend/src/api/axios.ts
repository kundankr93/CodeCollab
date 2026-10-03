import axios, {
    type AxiosError,
    type InternalAxiosRequestConfig,
} from "axios";

interface RetryableRequestConfig
    extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const API_BASE_URL = "https://codecollab-backend-se0p.onrender.com/api";

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Separate client prevents refresh requests from entering
// the main API response interceptor.
const refreshClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

let isRefreshing = false;

let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];

const processQueue = (
    error: unknown,
    token: string | null = null
): void => {
    failedQueue.forEach((request) => {
        if (error) {
            request.reject(error);
        } else if (token) {
            request.resolve(token);
        } else {
            request.reject(
                new Error(
                    "Token refresh did not return an access token."
                )
            );
        }
    });

    failedQueue = [];
};

const clearStoredTokens = (): void => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
};

const isAuthenticationEndpoint = (
    url: string
): boolean => {
    const normalizedUrl = url.toLowerCase();

    return (
        normalizedUrl.includes("/auth/login") ||
        normalizedUrl.includes("/auth/register") ||
        normalizedUrl.includes("/auth/refresh")
    );
};

/* =========================
   REQUEST INTERCEPTOR
========================= */

api.interceptors.request.use(
    (config) => {
        const accessToken =
            localStorage.getItem("accessToken");

        if (accessToken) {
            config.headers.Authorization =
                `Bearer ${accessToken}`;
        }

        return config;
    },
    (error: unknown) => Promise.reject(error)
);

/* =========================
   RESPONSE INTERCEPTOR
========================= */

api.interceptors.response.use(
    (response) => response,

    async (error: AxiosError) => {
        const originalRequest =
            error.config as
                | RetryableRequestConfig
                | undefined;

        const status = error.response?.status;

        if (
            status !== 401 ||
            !originalRequest
        ) {
            return Promise.reject(error);
        }

        const requestUrl =
            originalRequest.url ?? "";

        // Do not refresh for authentication endpoints.
        if (
            isAuthenticationEndpoint(requestUrl)
        ) {
            return Promise.reject(error);
        }

        // Prevent infinite retry loops.
        if (originalRequest._retry) {
            clearStoredTokens();
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        /*
         * If another request is already refreshing,
         * wait for its new access token.
         *
         * IMPORTANT:
         * Do this before reading refreshToken.
         * The token may already be rotating.
         */
        if (isRefreshing) {
            return new Promise<string>(
                (resolve, reject) => {
                    failedQueue.push({
                        resolve,
                        reject,
                    });
                }
            ).then((newAccessToken) => {
                originalRequest.headers.Authorization =
                    `Bearer ${newAccessToken}`;

                return api(originalRequest);
            });
        }

        const refreshToken =
            localStorage.getItem("refreshToken");

        if (!refreshToken) {
            clearStoredTokens();
            return Promise.reject(error);
        }

        isRefreshing = true;

        let newAccessToken: string;

        try {
            // Use the separate client to avoid recursion.
            const response =
                await refreshClient.post(
                    "/auth/refresh",
                    {
                        refreshToken,
                    }
                );

            const accessToken: unknown =
                response.data?.accessToken;

            const rotatedRefreshToken: unknown =
                response.data?.refreshToken;

            if (
                typeof accessToken !== "string" ||
                !accessToken ||
                typeof rotatedRefreshToken !== "string" ||
                !rotatedRefreshToken
            ) {
                throw new Error(
                    "Refresh response must contain both accessToken and refreshToken."
                );
            }

            newAccessToken = accessToken;

            // Save both rotated tokens before retrying requests.
            localStorage.setItem(
                "accessToken",
                accessToken
            );

            localStorage.setItem(
                "refreshToken",
                rotatedRefreshToken
            );
        } catch (refreshError: unknown) {
            processQueue(refreshError, null);
            clearStoredTokens();

            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }

        // Release queued requests with the new access token.
        processQueue(null, newAccessToken);

        // Retry the original request exactly once.
        originalRequest.headers.Authorization =
            `Bearer ${newAccessToken}`;

        return api(originalRequest);
    }
);

export default api;