import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:5000/api",
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
) => {
    failedQueue.forEach(
        (request) => {
            if (error) {
                request.reject(error);
            } else if (token) {
                request.resolve(token);
            }
        }
    );

    failedQueue = [];
};


/* =========================
   REQUEST INTERCEPTOR
========================= */

api.interceptors.request.use(
    (config) => {
        const accessToken =
            localStorage.getItem(
                "accessToken"
            );

        if (accessToken) {
            config.headers.Authorization =
                `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


/* =========================
   RESPONSE INTERCEPTOR
========================= */

api.interceptors.response.use(
    (response) => {
        return response;
    },

    async (error) => {
        const originalRequest =
            error.config;

        const status =
            error.response?.status;

        /*
         * Only handle 401 errors.
         */

        if (
            status !== 401 ||
            !originalRequest
        ) {
            return Promise.reject(
                error
            );
        }

        /*
         * Prevent infinite refresh loops.
         */

        if (
            originalRequest._retry
        ) {
            localStorage.removeItem(
                "accessToken"
            );

            localStorage.removeItem(
                "refreshToken"
            );

            return Promise.reject(
                error
            );
        }

        originalRequest._retry =
            true;

        const refreshToken =
            localStorage.getItem(
                "refreshToken"
            );

        /*
         * No refresh token means
         * the user must login again.
         */

        if (!refreshToken) {
            localStorage.removeItem(
                "accessToken"
            );

            return Promise.reject(
                error
            );
        }

        /*
         * If another request is
         * already refreshing the token,
         * wait for it.
         */

        if (isRefreshing) {
            return new Promise(
                (
                    resolve,
                    reject
                ) => {
                    failedQueue.push({
                        resolve,
                        reject,
                    });
                }
            ).then(
                (newAccessToken) => {
                    originalRequest.headers =
                        originalRequest.headers ||
                        {};

                    originalRequest.headers.Authorization =
                        `Bearer ${newAccessToken}`;

                    return api(
                        originalRequest
                    );
                }
            );
        }

        isRefreshing = true;

        try {
            /*
             * Use plain axios here,
             * not api, so the refresh
             * request itself doesn't
             * trigger this interceptor.
             */

            const response =
                await axios.post(
                    "http://localhost:5000/api/auth/refresh",
                    {
                        refreshToken,
                    },
                    {
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                    }
                );

            const newAccessToken =
                response.data
                    .accessToken;

            const newRefreshToken =
                response.data
                    .refreshToken;

            if (
                !newAccessToken
            ) {
                throw new Error(
                    "Refresh token response did not contain an access token."
                );
            }

            localStorage.setItem(
                "accessToken",
                newAccessToken
            );

            /*
             * Some refresh-token
             * implementations rotate
             * the refresh token.
             */

            if (
                newRefreshToken
            ) {
                localStorage.setItem(
                    "refreshToken",
                    newRefreshToken
                );
            }

            processQueue(
                null,
                newAccessToken
            );

            originalRequest.headers =
                originalRequest.headers ||
                {};

            originalRequest.headers.Authorization =
                `Bearer ${newAccessToken}`;

            return api(
                originalRequest
            );
        } catch (
            refreshError
        ) {
            processQueue(
                refreshError,
                null
            );

            localStorage.removeItem(
                "accessToken"
            );

            localStorage.removeItem(
                "refreshToken"
            );

            return Promise.reject(
                refreshError
            );
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;