export declare const config: {
    readonly port: number;
    readonly jwt: {
        readonly accessSecret: string;
        readonly refreshSecret: string;
        readonly accessExpiresIn: "15m";
        readonly refreshExpiresIn: "7d";
    };
    readonly redis: {
        readonly host: string;
        readonly port: number;
        readonly password: string | undefined;
    };
    readonly telegram: {
        readonly botToken: string;
        readonly enabled: boolean;
    };
    readonly upload: {
        readonly dir: string;
        readonly maxFileSize: number;
    };
    readonly frontendUrl: string;
    readonly multiTenant: boolean;
    readonly aiServiceUrl: string;
    /** Service account JSON path for Google Cloud Vision (invoice OCR). See GOOGLE_APPLICATION_CREDENTIALS. */
    readonly googleApplicationCredentials: string | undefined;
    readonly debug: boolean;
};
