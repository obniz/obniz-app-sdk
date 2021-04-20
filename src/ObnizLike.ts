export interface ObnizOptionsLike {
  auto_connect?: boolean;
}

export interface ObnizLike {
  onconnect: (obniz: ObnizLike) => Promise<void> | void;
  onloop: (obniz: ObnizLike) => Promise<void> | void;
  onclose: (obniz: ObnizLike) => Promise<void> | void;
  closeWait: () => Promise<void>;
}

export interface ObnizLikeClass {
  new (obnizId: string, options: ObnizOptionsLike): ObnizLike;
  version: string;
}
