/// <reference types="qs" />
/// <reference types="express" />
export declare function ensureUploadDir(): Promise<void>;
export declare const uploadMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
