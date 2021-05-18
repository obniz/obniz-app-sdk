export interface IObnizOptions {
    auto_connect?: boolean;
}
export interface IObniz {
    onconnect?: (obniz: any) => Promise<void> | void;
    onloop?: (obniz: any) => Promise<void> | void;
    onclose?: (obniz: any) => Promise<void> | void;
    closeWait: () => Promise<void>;
    connect: () => void;
    autoConnect: boolean;
}
export interface IObnizStatic<O> {
    new (obnizId: string, options: IObnizOptions): O;
    version: string;
}
