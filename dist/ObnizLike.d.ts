export interface ObnizOptionsLike {
    auto_connect?: boolean;
}
export interface ObnizLike {
    onconnect: (obniz: ObnizLike) => Promise<void> | void;
    onloop: (obniz: ObnizLike) => Promise<void> | void;
    onclose: (obniz: ObnizLike) => Promise<void> | void;
    closeWait: () => Promise<void>;
    connect: () => void;
    autoConnect: boolean;
    options: {
        auto_connect: boolean;
    };
}
export interface ObnizLikeClass {
    new (obnizId: string, options: ObnizOptionsLike): ObnizLike;
    version: string;
}
