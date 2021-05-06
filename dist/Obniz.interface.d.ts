export interface IObnizOptions {
    auto_connect?: boolean;
}
export interface IObniz {
    onconnect?: (obniz: this) => Promise<void> | void;
    onloop?: (obniz: this) => Promise<void> | void;
    onclose?: (obniz: this) => Promise<void> | void;
    closeWait: () => Promise<void>;
    connect: () => void;
    autoConnect: boolean;
}
export interface IObnizStatic<O> {
    new (obnizId: string, options: IObnizOptions): O;
    version: string;
}
